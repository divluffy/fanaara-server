import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ModerationModule } from 'src/moderation/moderation.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { ModerationImageProcessor } from './moderation-image.processor';
import { ModerationTextProcessor } from './moderation-text.processor';

function redisConnectionFromUrl(url: string) {
  // BullMQ يستخدم ioredis options
  // REDIS_URL مثل: redis://localhost:6379
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password || undefined,
  };
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnectionFromUrl(
        process.env.REDIS_URL ?? 'redis://localhost:6379',
      ),
    }),
    BullModule.registerQueue(
      { name: 'moderation-image' },
      { name: 'moderation-text' },
    ),
    ModerationModule,
    UploadsModule,
  ],
  providers: [ModerationImageProcessor, ModerationTextProcessor],
  exports: [],
})
export class ModerationQueuesModule {}
