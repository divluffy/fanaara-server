// src\moderation\moderation.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { TextModerationService } from './text/text-moderation.service';
import { ImageModerationService } from './image/image-moderation.service';
import { ModerateTextDto } from './dto/moderate-text.dto';
import { ModerateImageDto } from './dto/moderate-image.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly text: TextModerationService,
    private readonly image: ImageModerationService,
  ) {}

  @Throttle({ short: { ttl: 1000, limit: 3 } })
  @Post('text')
  async moderateText(@Body() dto: ModerateTextDto) {
    if (dto.items?.length) {
      const decisions = await this.text.moderateMany(dto.items);
      const allowed = decisions.every((d) => d.allowed);
      return { allowed, decisions };
    }

    const decision = await this.text.moderateOne(dto.text ?? '');
    return { allowed: decision.allowed, decision };
  }

  @Throttle({ short: { ttl: 1000, limit: 3 } })
  @Post('image')
  async moderateImage(@Body() dto: ModerateImageDto) {
    if (dto.keys?.length) {
      const decisions = await Promise.all(
        dto.keys.map((k) => this.image.moderateS3Key(k)),
      );
      return { allowed: decisions.every((d) => d.allowed), decisions };
    }
    if (dto.urls?.length) {
      const decisions = await Promise.all(
        dto.urls.map((u) => this.image.moderateImageUrl(u)),
      );
      return { allowed: decisions.every((d) => d.allowed), decisions };
    }

    if (dto.key) {
      const decision = await this.image.moderateS3Key(dto.key);
      return { allowed: decision.allowed, decision };
    }
    if (dto.url) {
      const decision = await this.image.moderateImageUrl(dto.url);
      return { allowed: decision.allowed, decision };
    }

    return {
      allowed: true,
      decision: { allowed: true, action: 'keep', reasons: [] },
    };
  }
}
