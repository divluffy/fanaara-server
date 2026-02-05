// src\uploads\s3.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { streamToBuffer } from 'src/common/utils/stream-to-buffer';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket = process.env.S3_BUCKET!;
  private readonly region = process.env.AWS_REGION!;
  private readonly client: S3Client;

  constructor() {
    if (!this.bucket) throw new Error('S3_BUCKET missing');
    if (!this.region) throw new Error('AWS_REGION missing');

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },

      // ✅ هذا يمنع إضافة checksum middleware في بعض الإصدارات
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  getBucket() {
    return this.bucket;
  }

  async presignPut(params: {
    key: string;
    contentType: string;
    tagging?: string; // "pending=true&purpose=avatar"
    metadata?: Record<string, string>;
    expiresInSeconds?: number;
  }) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
    });

    const url = await getSignedUrl(this.client, cmd, {
      expiresIn: params.expiresInSeconds ?? 60,
    });

    return url;
  }

  async signGetUrl(key: string, expiresInSeconds = 120) {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  async headObject(key: string) {
    return this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteObject(key: string) {
    this.logger.warn(`[s3] delete key=${key}`);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  // داخل class S3Service
  async deleteMany(keys: string[]): Promise<void> {
    if (!Array.isArray(keys) || keys.length === 0) return;

    // تنظيف + dedupe
    const uniq = Array.from(
      new Set(
        keys
          .filter(
            (k): k is string => typeof k === 'string' && k.trim().length > 0,
          )
          .map((k) => k.trim().replace(/^\/+/, '')), // remove leading slashes
      ),
    );

    if (uniq.length === 0) return;

    // S3 DeleteObjects limit = 1000 per request
    const BATCH_SIZE = 1000;

    const bucket =
      // عدّل اسم الخاصية حسب الموجود عندك في S3Service
      (this as any).bucketName ?? (this as any).bucket ?? (this as any).Bucket;

    if (!bucket || typeof bucket !== 'string') {
      throw new Error(
        'S3Service.deleteMany: bucket name is missing. Ensure you have bucket/bucketName property.',
      );
    }

    const client =
      // عدّل اسم الخاصية حسب الموجود عندك في S3Service
      (this as any).s3 ?? (this as any).client ?? (this as any).s3Client;

    if (!client?.send) {
      throw new Error(
        'S3Service.deleteMany: S3 client is missing (expected AWS SDK v3 client with .send())',
      );
    }

    let deletedTotal = 0;

    for (let i = 0; i < uniq.length; i += BATCH_SIZE) {
      const chunk = uniq.slice(i, i + BATCH_SIZE);

      // retry بسيط للـ transient errors
      const maxAttempts = 3;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects: chunk.map((Key) => ({ Key })),
                Quiet: true,
              },
            }),
          );

          // لو AWS رجع Errors (per-object)
          if (res?.Errors?.length) {
            const sample = res.Errors.slice(0, 5)
              .map((e: any) => `${e?.Key ?? 'unknown'}:${e?.Code ?? 'ERR'}`)
              .join(', ');
            throw new Error(
              `S3 deleteMany partial failure: errors=${res.Errors.length} sample=[${sample}]`,
            );
          }

          deletedTotal += chunk.length;
          lastErr = null;
          break; // success
        } catch (err: any) {
          lastErr = err;

          const msg = String(err?.message ?? err);
          const retryable =
            msg.includes('SlowDown') ||
            msg.includes('Throttl') ||
            msg.includes('Timeout') ||
            msg.includes('ECONN') ||
            msg.includes('503');

          if (!retryable || attempt === maxAttempts) {
            this.logger?.error?.(
              `S3 deleteMany failed: batch=${i / BATCH_SIZE + 1} size=${
                chunk.length
              } attempt=${attempt} err=${msg}`,
            );
            throw err;
          }

          const backoffMs = 200 * attempt * attempt;
          this.logger?.warn?.(
            `S3 deleteMany retrying: attempt=${attempt}/${maxAttempts} backoff=${backoffMs}ms err=${msg}`,
          );
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }

      if (lastErr) throw lastErr;
    }

    this.logger?.log?.(`S3 deleteMany ok: deleted=${deletedTotal}`);
  }

  async copyObject(fromKey: string, toKey: string, tagging?: string) {
    this.logger.log(`[s3] copy from=${fromKey} to=${toKey}`);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${fromKey}`,
        Key: toKey,
        TaggingDirective: tagging ? 'REPLACE' : undefined,
        Tagging: tagging,
      }),
    );
  }

  async moveObject(fromKey: string, toKey: string, tagging?: string) {
    await this.copyObject(fromKey, toKey, tagging);
    await this.deleteObject(fromKey);
  }

  async getObjectBuffer(key: string) {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const buffer = await streamToBuffer(res.Body);
    const contentType = res.ContentType;
    return { buffer, contentType };
  }

  publicUrlForKey(key: string) {
    // الأفضل CloudFront. هنا fallback عام:
    const base = process.env.S3_PUBLIC_BASE_URL;
    if (base) return `${base.replace(/\/$/, '')}/${key}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
