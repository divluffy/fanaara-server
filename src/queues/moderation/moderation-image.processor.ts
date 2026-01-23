import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ImageModerationService } from 'src/moderation/image/image-moderation.service';
import { S3Service } from 'src/uploads/s3.service';

type JobData = {
  key: string; // tmp or final
  finalKey?: string; // optional
  purpose: 'post_image';
  userId: string;
};

@Processor('moderation-image')
export class ModerationImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationImageProcessor.name);

  constructor(
    private readonly image: ImageModerationService,
    private readonly s3: S3Service,
  ) {
    super();
  }

  async process(job: Job<JobData>) {
    const { key, finalKey, userId } = job.data;

    this.logger.log(`[job:image] id=${job.id} user=${userId} key=${key}`);

    try {
      const decision = await this.image.moderateS3Key(key);

      if (!decision.allowed) {
        await this.s3.deleteObject(key).catch(() => undefined);
        this.logger.warn(
          `[job:image] rejected key=${key} reasons=${decision.reasons.join(',')}`,
        );
        return { status: 'REJECTED', decision };
      }

      if (finalKey) {
        await this.s3.moveObject(
          key,
          finalKey,
          `pending=false&purpose=post_image&userId=${userId}`,
        );
        return {
          status: 'APPROVED',
          finalKey,
          url: this.s3.publicUrlForKey(finalKey),
        };
      }

      return { status: 'APPROVED', key };
    } catch (e: any) {
      this.logger.error(`[job:image] failed key=${key} err=${e?.message ?? e}`);
      throw e;
    }
  }
}
