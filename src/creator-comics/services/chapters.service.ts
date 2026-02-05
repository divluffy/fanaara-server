// src\creator-comics\services\chapters.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { CreatePagesDto } from '../dto/create-pages.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/uploads/s3.service';

@Injectable()
export class ChaptersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async createChapter(workId: string, dto: CreateChapterDto) {
    const work = await this.prisma.creativeWork.findUnique({
      where: { id: workId },
    });
    if (!work) throw new NotFoundException('Work not found');

    return this.prisma.chapter.create({
      data: {
        workId,
        title: dto.title,
        number: dto.number ?? null,
      },
    });
  }

  async createPages(chapterId: string, dto: CreatePagesDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    // bulk insert
    await this.prisma.chapterPage.createMany({
      data: dto.pages.map((p) => ({
        chapterId,
        orderIndex: p.orderIndex,
        originalFilename: p.originalFilename,
        s3Key: p.objectKey,
        width: p.width,
        height: p.height,
      })),
    });

    return this.prisma.chapterPage.findMany({
      where: { chapterId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getEditorPayload(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        work: true,
        pages: {
          orderBy: { orderIndex: 'asc' },
          include: { analysis: true, annotations: true },
        },
      },
    });

    if (!chapter) throw new NotFoundException('Chapter not found');

    const pages = await Promise.all(
      chapter.pages.map(async (p) => {
        const url = await this.s3.signGetUrl(p.s3Key, 3600);
        return {
          id: p.id,
          orderIndex: p.orderIndex,
          image: {
            url,
            width: p.width,
            height: p.height,
            originalFilename: p.originalFilename,
            s3Key: p.s3Key,
          },
          analysis: p.analysis?.rawJson ?? null,
          annotations: p.annotations?.json ?? null,
        };
      }),
    );

    const totalPages = chapter.pages.length;
    const analyzedPages = chapter.pages.filter((p) => !!p.annotations).length;

    const latestJob = await this.prisma.analysisJob.findFirst({
      where: { chapterId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        progress: true,
        updatedAt: true,
        error: true,
      },
    });

    return {
      work: {
        id: chapter.work.id,
        title: chapter.work.title,
        workType: chapter.work.workType,
        artStyleCategory: chapter.work.artStyleCategory,
      },
      chapter: {
        id: chapter.id,
        title: chapter.title,
        number: chapter.number,
      },
      stats: { totalPages, analyzedPages },
      latestJob: latestJob ?? null,
      pages,
    };
  }

  async reorderPages(
    chapterId: string,
    order: Array<{ pageId: string; orderIndex: number }>,
  ) {
    // basic guard: ensure pages belong to chapter
    const pages = await this.prisma.chapterPage.findMany({
      where: { chapterId },
      select: { id: true },
    });
    const allowed = new Set(pages.map((p) => p.id));

    const updates = order
      .filter((x) => allowed.has(x.pageId))
      .map((x) =>
        this.prisma.chapterPage.update({
          where: { id: x.pageId },
          data: { orderIndex: x.orderIndex },
        }),
      );

    await this.prisma.$transaction(updates);

    return { ok: true };
  }
}
