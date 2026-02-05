// src\creator-comics\services\works.service.ts
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkDto } from '../dto/create-work.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/uploads/s3.service';

@Injectable()
export class WorksService {
  private readonly logger = new Logger(WorksService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async createWork(ownerId: string, dto: CreateWorkDto) {
    return this.prisma.creativeWork.create({
      data: {
        ownerId,
        workType: dto.workType as any,
        artStyleCategory: dto.artStyleCategory as any,
        title: dto.title,
        description: dto.description ?? null,
        defaultLang: dto.defaultLang ?? null,
      },
    });
  }

  async deleteWork(ownerId: string, workId: string) {
    const work = await this.prisma.creativeWork.findUnique({
      where: { id: workId },
      select: { id: true, ownerId: true },
    });
    if (!work) throw new NotFoundException('Work not found');
    if (work.ownerId !== ownerId) throw new ForbiddenException('Not allowed');

    // collect s3 keys
    const pages = await this.prisma.chapterPage.findMany({
      where: { chapter: { workId } },
      select: { s3Key: true, id: true, chapterId: true },
    });
    const s3Keys = pages.map((p) => p.s3Key);

    const chapters = await this.prisma.chapter.findMany({
      where: { workId },
      select: { id: true },
    });
    const chapterIds = chapters.map((c) => c.id);
    const pageIds = pages.map((p) => p.id);

    // delete DB first (so UI consistent). S3 cleanup best-effort after.
    await this.prisma.$transaction([
      this.prisma.pageAnalysis.deleteMany({
        where: { pageId: { in: pageIds } },
      }),
      this.prisma.pageAnnotations.deleteMany({
        where: { pageId: { in: pageIds } },
      }),
      this.prisma.analysisJob.deleteMany({
        where: { chapterId: { in: chapterIds } },
      }),
      this.prisma.chapterPage.deleteMany({ where: { id: { in: pageIds } } }),
      this.prisma.chapter.deleteMany({ where: { id: { in: chapterIds } } }),
      this.prisma.creativeWork.delete({ where: { id: workId } }),
    ]);

    // best-effort S3 cleanup
    try {
      if (s3Keys.length) {
        // تحتاج تضيف method في S3Service: deleteMany(keys)
        await this.s3.deleteMany(s3Keys);
      }
    } catch (err: any) {
      this.logger.warn(
        `Work deleted in DB but S3 cleanup failed workId=${workId}: ${String(err?.message ?? err)}`,
      );
    }

    return { ok: true };
  }

  async listMyWorks(ownerId: string) {
    const works = await this.prisma.creativeWork.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        chapters: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            number: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const mapped = await Promise.all(
      works.map(async (w) => {
        const ch = w.chapters[0] ?? null;
        if (!ch) {
          return {
            ...w,
            latestChapter: null,
            state: 'DRAFT_NO_PAGES' as const,
          };
        }

        const totalPages = await this.prisma.chapterPage.count({
          where: { chapterId: ch.id },
        });
        const analyzedPages = await this.prisma.pageAnnotations.count({
          where: { page: { chapterId: ch.id } },
        });

        const latestJob = await this.prisma.analysisJob.findFirst({
          where: { chapterId: ch.id },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, status: true, updatedAt: true },
        });

        const coverPage = await this.prisma.chapterPage.findFirst({
          where: { chapterId: ch.id },
          orderBy: { orderIndex: 'asc' },
          select: { s3Key: true },
        });

        const coverUrl = coverPage
          ? await this.s3.signGetUrl(coverPage.s3Key, 600)
          : null;

        const state =
          totalPages === 0
            ? ('DRAFT_NO_PAGES' as const)
            : analyzedPages < totalPages
              ? latestJob?.status === 'RUNNING' ||
                latestJob?.status === 'PENDING'
                ? ('ANALYZING' as const)
                : ('PAGES_UPLOADED' as const)
              : ('READY' as const);

        return {
          id: w.id,
          title: w.title,
          workType: w.workType,
          artStyleCategory: w.artStyleCategory,
          updatedAt: w.updatedAt,
          latestChapter: {
            id: ch.id,
            title: ch.title,
            number: ch.number,
            totalPages,
            analyzedPages,
            latestJob: latestJob
              ? {
                  id: latestJob.id,
                  status: latestJob.status,
                  updatedAt: latestJob.updatedAt,
                }
              : null,
            coverUrl,
          },
          state,
        };
      }),
    );

    return { works: mapped };
  }
}
