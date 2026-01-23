// src\uploads\s3.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
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
      ContentType: params.contentType,
      Metadata: params.metadata,
      Tagging: params.tagging,
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
