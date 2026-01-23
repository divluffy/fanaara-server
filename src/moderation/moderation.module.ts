// src\moderation\moderation.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { OpenAIModule } from 'src/integrations/openai/openai.module';
import { ModerationController } from './moderation.controller';
import { ModerationPolicyService } from './policy/moderation-policy.service';
import { TextModerationService } from './text/text-moderation.service';
import { ImageModerationService } from './image/image-moderation.service';
import { UploadsModule } from 'src/uploads/uploads.module';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [OpenAIModule, forwardRef(() => UploadsModule), RedisModule],
  controllers: [ModerationController],
  providers: [
    ModerationPolicyService,
    TextModerationService,
    ImageModerationService,
  ],
  exports: [TextModerationService, ImageModerationService],
})
export class ModerationModule {}
