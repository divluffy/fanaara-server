import { BadRequestException } from '@nestjs/common';

export class ModerationRejectedException extends BadRequestException {
  constructor(
    public readonly payload: {
      code: 'MODERATION_REJECTED';
      target: 'text' | 'image';
      reasons: string[];
      categories?: Record<string, boolean>;
    },
  ) {
    super(payload);
  }
}
