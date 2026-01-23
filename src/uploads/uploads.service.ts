// src\uploads\uploads.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from 'src/redis/redis.service';
import { ImageModerationService } from 'src/moderation/image/image-moderation.service';
import {
  ALLOWED_IMAGE_MIME,
  isSyncPurpose,
  MAX_AVATAR_BYTES,
  MAX_POST_IMAGE_BYTES,
  UPLOAD_TOKEN_PREFIX,
  UploadPurpose,
} from './uploads.constants';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { S3Service } from './s3.service';
import {
  UploadConflictException,
  UploadNotFoundException,
  UploadTokenInvalidException,
} from 'src/common/errors/uploads.exception';
import { ModerationRejectedException } from 'src/common/errors/moderation.exception';

type PendingUpload = {
  userId: string;
  purpose: UploadPurpose;
  key: string; // tmp key
  mimeType: string;
  fileName: string;
  fileSize: number;
  createdAt: number;
};

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly tmpPrefix = process.env.S3_TMP_PREFIX ?? 'tmp';
  private readonly tokenTtl = Number(
    process.env.UPLOAD_TOKEN_TTL_SECONDS ?? 15 * 60,
  ); // 15m

  constructor(
    private readonly redis: RedisService,
    private readonly s3: S3Service,
    private readonly imageModeration: ImageModerationService,
  ) {}

  private maxBytesForPurpose(purpose: UploadPurpose) {
    if (purpose === 'avatar') return MAX_AVATAR_BYTES;
    if (purpose === 'post_image') return MAX_POST_IMAGE_BYTES;
    return MAX_POST_IMAGE_BYTES;
  }

  private extFromMime(mime: string) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
    return 'bin';
  }

  async presign(userId: string, dto: PresignUploadDto) {
    const maxBytes = this.maxBytesForPurpose(dto.purpose);
    if (dto.fileSize > maxBytes) {
      throw new UploadConflictException('FILE_TOO_LARGE');
    }

    // avatar/post_image/cover: allow only image mimes for now
    if (!ALLOWED_IMAGE_MIME.has(dto.mimeType)) {
      throw new UploadConflictException('MIME_NOT_ALLOWED');
    }

    const ext = dto.extHint?.replace('.', '') || this.extFromMime(dto.mimeType);
    const key = `${this.tmpPrefix}/${userId}/${dto.purpose}/${randomUUID()}.${ext}`;

    const token = randomUUID();
    const record: PendingUpload = {
      userId,
      purpose: dto.purpose,
      key,
      mimeType: dto.mimeType,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      createdAt: Date.now(),
    };

    const redisKey = `${UPLOAD_TOKEN_PREFIX}${token}`;
    await this.redis.set(redisKey, JSON.stringify(record), this.tokenTtl);

    const uploadUrl = await this.s3.presignPut({
      key,
      contentType: dto.mimeType,
      tagging: `pending=true&purpose=${dto.purpose}&userId=${userId}`,
      metadata: {
        pending: 'true',
        purpose: dto.purpose,
        userId,
        fileName: dto.fileName,
      },
      expiresInSeconds: 60,
    });

    this.logger.log(
      `[presign] user=${userId} purpose=${dto.purpose} key=${key}`,
    );

    return {
      token,
      key,
      uploadUrl,
      expiresInSeconds: 60,
    };
  }

  private async getPending(token: string): Promise<PendingUpload> {
    if (!token) throw new UploadTokenInvalidException();
    const redisKey = `${UPLOAD_TOKEN_PREFIX}${token}`;
    const raw = await this.redis.get(redisKey);
    if (!raw) throw new UploadTokenInvalidException();
    return JSON.parse(raw) as PendingUpload;
  }

  private finalKeyFor(p: PendingUpload) {
    // ✅ هنا "التثبيت": نقل من tmp/ -> users/ أو posts/
    if (p.purpose === 'avatar')
      return `users/${p.userId}/avatar/${randomUUID()}.png`;
    if (p.purpose === 'cover')
      return `users/${p.userId}/cover/${randomUUID()}.jpg`;
    if (p.purpose === 'post_image')
      return `posts/${p.userId}/${randomUUID()}.jpg`;
    return `files/${p.userId}/${randomUUID()}.bin`;
  }

  async complete(userId: string, token: string) {
    const pending = await this.getPending(token);
    if (pending.userId !== userId) throw new UploadTokenInvalidException();

    // تأكد فعليًا أنه تم رفع الملف
    const head = await this.s3.headObject(pending.key).catch(() => null);
    if (!head) throw new UploadNotFoundException();

    const size = Number(head.ContentLength ?? 0);
    if (size <= 0) throw new UploadNotFoundException();

    if (size > this.maxBytesForPurpose(pending.purpose)) {
      await this.s3.deleteObject(pending.key);
      throw new UploadConflictException('FILE_TOO_LARGE');
    }

    this.logger.log(
      `[complete] user=${userId} purpose=${pending.purpose} key=${pending.key} size=${size}`,
    );

    // ✅ avatar/cover: sync moderation now
    if (isSyncPurpose(pending.purpose)) {
      try {
        await this.imageModeration.assertAllowedS3Key(pending.key);

        const finalKey = this.finalKeyFor(pending);
        await this.s3.moveObject(
          pending.key,
          finalKey,
          `pending=false&purpose=${pending.purpose}&userId=${userId}`,
        );

        // احذف التوكن (idempotency)
        await this.redis.del(`${UPLOAD_TOKEN_PREFIX}${token}`);

        const url = this.s3.publicUrlForKey(finalKey);
        return { status: 'APPROVED', key: finalKey, url };
      } catch (e) {
        // لو موديريشن رفضت أو أي خطأ: احذف من S3 tmp
        await this.s3.deleteObject(pending.key).catch(() => undefined);
        await this.redis.del(`${UPLOAD_TOKEN_PREFIX}${token}`);

        if (e instanceof ModerationRejectedException) throw e;
        throw e;
      }
    }

    // ✅ post_image: async via queue (هنا placeholder بسيط)
    // الحل: enqueue job + return PENDING
    // (سأعطيك ملف الـ queue تحت)
    return { status: 'PENDING', key: pending.key };
  }

  async abort(userId: string, token: string) {
    const pending = await this.getPending(token);
    if (pending.userId !== userId) throw new UploadTokenInvalidException();

    await this.s3.deleteObject(pending.key).catch(() => undefined);
    await this.redis.del(`${UPLOAD_TOKEN_PREFIX}${token}`);

    this.logger.warn(`[abort] user=${userId} key=${pending.key}`);
    return { ok: true };
  }
}
