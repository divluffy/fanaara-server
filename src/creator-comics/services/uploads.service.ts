// src/creator-comics/services/uploads.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PresignDto } from '../dto/presign.dto';
import { S3Service } from 'src/uploads/s3.service';
import { PrismaService } from 'src/prisma/prisma.service';

function safeSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly s3: S3Service,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async presignChapterPageUploads(dto: PresignDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: dto.chapterId },
      select: { id: true, workId: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.workId !== dto.workId) {
      throw new BadRequestException('chapterId does not belong to workId');
    }

    const prefix = this.config.get<string>('S3_UPLOAD_PREFIX') || 'fanaara';
    const expiresInSeconds = 15 * 60;

    if (dto.files.length > 60) {
      throw new BadRequestException('Too many files');
    }

    const uploads = await Promise.all(
      dto.files.map(async (f) => {
        const key = `${prefix}/works/${dto.workId}/chapters/${dto.chapterId}/pages/${randomUUID()}-${safeSlug(
          f.filename,
        )}`;

        const putUrl = await this.s3.presignPut({
          key,
          contentType: f.contentType,
          expiresInSeconds,
        });

        return {
          clientFileId: f.clientFileId,
          objectKey: key,
          putUrl,
          expiresInSeconds,
        };
      }),
    );

    return { uploads };
  }
}
