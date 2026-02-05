// src/creator-comics/services/analysis-jobs.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import pLimit from 'p-limit';
import { StartAnalysisDto } from '../dto/start-analysis.dto';
import { OpenAiVisionService } from './openai-vision.service';
import { mapAnalysisToAnnotations } from '../openai/mapper';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/uploads/s3.service';
import { Prisma } from 'generated/prisma/client';

type PageProgressError = {
  errorCode: string;
  errorMessage: string;
  fixHint: string;
};

type PageProgress = {
  pageId: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error?: PageProgressError;
};

function isSchemaMismatch(err: any) {
  const msg = String(err?.message ?? err ?? '');
  const low = msg.toLowerCase();
  return low.includes('schema') || low.includes('output_parsed');
}

function mapAnalysisError(err: any): PageProgressError {
  const msg = String(err?.message ?? err ?? 'Unknown error');
  const low = msg.toLowerCase();

  if (msg.includes('429') || low.includes('rate limit')) {
    return {
      errorCode: 'RATE_LIMIT',
      errorMessage: msg,
      fixHint: 'قلل concurrency أو أعد المحاولة بعد قليل.',
    };
  }
  if (low.includes('timeout')) {
    return {
      errorCode: 'TIMEOUT',
      errorMessage: msg,
      fixHint: 'قلل detail أو استخدم صور أصغر/أخف.',
    };
  }
  if (low.includes('403') || low.includes('access denied')) {
    return {
      errorCode: 'IMAGE_FETCH_FORBIDDEN',
      errorMessage: msg,
      fixHint: 'تأكد signed GET URL صالح وأن S3 يسمح بالـ GET.',
    };
  }
  if (isSchemaMismatch(err)) {
    return {
      errorCode: 'SCHEMA_MISMATCH',
      errorMessage: msg,
      fixHint:
        'حاول retry. لو تتكرر: استخدم detail=low + زد max_output_tokens في OpenAiVisionService.',
    };
  }

  return {
    errorCode: 'UNKNOWN',
    errorMessage: msg,
    fixHint: 'أعد المحاولة. لو تكرر راجع logs.',
  };
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class AnalysisJobsService {
  private readonly logger = new Logger(AnalysisJobsService.name);

  // serialize progress writes per jobId
  private progressWriteChain = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly openai: OpenAiVisionService,
  ) {}

  async startChapterAnalysis(chapterId: string, dto: StartAnalysisDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { work: true, pages: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    if (chapter.pages.length === 0) {
      throw new BadRequestException('No pages uploaded for this chapter');
    }

    // Guard: prevent duplicate RUNNING/PENDING jobs unless force
    if (!dto.force) {
      const existing = await this.prisma.analysisJob.findFirst({
        where: { chapterId, status: { in: ['RUNNING', 'PENDING'] as any } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      });
      if (existing) {
        return { jobId: existing.id, status: existing.status };
      }
    }

    const progress = {
      totalPages: chapter.pages.length,
      donePages: 0,
      pages: chapter.pages.map((p) => ({
        pageId: p.id,
        status: 'pending' as const,
      })),
    };

    const job = await this.prisma.analysisJob.create({
      data: {
        chapterId,
        status: 'PENDING' as any,
        progress,
      },
    });

    this.logger.log(
      `created analysisJob jobId=${job.id} chapterId=${chapterId} totalPages=${chapter.pages.length}`,
    );

    void this.processJob(job.id, dto).catch(async (err) => {
      this.logger.error(
        `processJob failed jobId=${job.id} chapterId=${chapterId}: ${String(
          err?.message ?? err,
        )}`,
        err?.stack,
      );
      await this.prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED' as any,
          error: String(err?.message ?? err),
        },
      });
    });

    return { jobId: job.id, status: job.status };
  }

  async getJobStatus(jobId: string) {
    const job = await this.prisma.analysisJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private async processJob(jobId: string, dto: StartAnalysisDto) {
    await this.prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING' as any },
    });

    const job = await this.prisma.analysisJob.findUnique({
      where: { id: jobId },
      include: { chapter: { include: { work: true, pages: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');

    const chapter = job.chapter;
    const work = chapter.work;

    const limit = pLimit(3);

    const pages = await this.prisma.chapterPage.findMany({
      where: { chapterId: chapter.id },
      orderBy: { orderIndex: 'asc' },
      include: { analysis: true, annotations: true },
    });

    const preferredDetail = (dto.detail ?? 'high') as 'low' | 'high';
    const detailAttempts: Array<'low' | 'high'> =
      preferredDetail === 'high' ? ['high', 'low'] : ['low', 'high'];

    const tasks = pages.map((p) =>
      limit(async () => {
        await this.updatePageProgressQueued(jobId, p.id, 'running');

        try {
          // ✅ Skip only if annotations exist (not just analysis)
          if (!dto.force && p.annotations) {
            await this.updatePageProgressQueued(jobId, p.id, 'done');
            return;
          }

          const signedGet = await this.s3.signGetUrl(p.s3Key, 3600);

          const t0 = Date.now();

          let lastErr: any = null;
          let result: any = null;

          for (const det of detailAttempts) {
            try {
              result = await this.openai.analyzeComicPage({
                imageUrl: signedGet,
                workType: String(work.workType),
                artStyleCategory: String(work.artStyleCategory),
                pageWidth: p.width,
                pageHeight: p.height,
                model: dto.model,
                detail: det,
              });
              break;
            } catch (err: any) {
              lastErr = err;

              // retry only for schema mismatch
              if (
                isSchemaMismatch(err) &&
                det !== detailAttempts[detailAttempts.length - 1]
              ) {
                this.logger.warn(
                  `schema mismatch retry jobId=${jobId} pageId=${p.id} detail=${det} -> retry next detail`,
                );
                continue;
              }

              throw err;
            }
          }

          if (!result) throw lastErr ?? new Error('OpenAI returned no result');

          const ms = Date.now() - t0;
          const parsed = result.parsed;

          await this.prisma.pageAnalysis.upsert({
            where: { pageId: p.id },
            create: {
              pageId: p.id,
              model: result.modelUsed,
              detail: result.detailUsed,
              promptVersion: 'v1-comics-page-geometry',
              rawJson: toInputJson(parsed),
            },
            update: {
              model: result.modelUsed,
              detail: result.detailUsed,
              rawJson: toInputJson(parsed),
              promptVersion: 'v1-comics-page-geometry',
            },
          });

          const annotations = mapAnalysisToAnnotations(p.id, parsed as any);

          await this.prisma.pageAnnotations.upsert({
            where: { pageId: p.id },
            create: { pageId: p.id, json: toInputJson(annotations) },
            update: { json: toInputJson(annotations) },
          });

          this.logger.log(
            `page analyzed jobId=${jobId} pageId=${p.id} ms=${ms} detail=${result.detailUsed} model=${result.modelUsed}`,
          );

          await this.updatePageProgressQueued(jobId, p.id, 'done');
        } catch (err: any) {
          const mapped = mapAnalysisError(err);
          this.logger.warn(
            `page failed jobId=${jobId} pageId=${p.id} code=${mapped.errorCode} msg=${mapped.errorMessage}`,
          );
          await this.updatePageProgressQueued(jobId, p.id, 'failed', mapped);
        }
      }),
    );

    await Promise.all(tasks);

    const finalJob = await this.prisma.analysisJob.findUnique({
      where: { id: jobId },
    });

    const progress = (finalJob?.progress as any) ?? {};
    const pagesProgress: PageProgress[] = progress.pages ?? [];
    const failed = pagesProgress.some((x) => x.status === 'failed');
    const donePages = pagesProgress.filter((x) => x.status === 'done').length;
    const totalPages = progress.totalPages ?? pages.length;

    await this.prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: (failed ? 'FAILED' : 'COMPLETED') as any,
        progress: { ...progress, donePages, totalPages },
      },
    });

    this.logger.log(
      `job finished jobId=${jobId} status=${failed ? 'FAILED' : 'COMPLETED'} donePages=${donePages}/${totalPages}`,
    );
  }

  private async updatePageProgressQueued(
    jobId: string,
    pageId: string,
    status: PageProgress['status'],
    error?: PageProgressError,
  ) {
    const prev = this.progressWriteChain.get(jobId) ?? Promise.resolve();

    const next = prev.then(async () => {
      const job = await this.prisma.analysisJob.findUnique({
        where: { id: jobId },
      });
      if (!job) return;

      const progress = (job.progress as any) ?? {
        pages: [],
        totalPages: 0,
        donePages: 0,
      };

      const pages: PageProgress[] = progress.pages ?? [];

      const nextPages = pages.map((p) => {
        if (p.pageId !== pageId) return p;

        const updated: any = { ...p, status };

        if (status === 'failed' && error) updated.error = error;
        else delete updated.error;

        return updated as PageProgress;
      });

      const donePages = nextPages.filter((x) => x.status === 'done').length;

      await this.prisma.analysisJob.update({
        where: { id: jobId },
        data: { progress: { ...progress, pages: nextPages, donePages } },
      });
    });

    this.progressWriteChain.set(
      jobId,
      next.catch(() => {}),
    );

    await next;
  }
}
