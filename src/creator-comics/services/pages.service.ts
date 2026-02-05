// src\creator-comics\services\pages.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveAnnotations(pageId: string, annotations: any) {
    const page = await this.prisma.chapterPage.findUnique({
      where: { id: pageId },
    });
    if (!page) throw new NotFoundException('Page not found');

    const nowIso = new Date().toISOString();
    const safe = {
      ...(annotations ?? {}),
      pageId,
      version: 1,
      updatedAt: nowIso,
    };

    const upserted = await this.prisma.pageAnnotations.upsert({
      where: { pageId },
      create: { pageId, json: toInputJson(safe) },
      update: { json: toInputJson(safe) },
    });

    return { ok: true, updatedAt: upserted.updatedAt };
  }
}
