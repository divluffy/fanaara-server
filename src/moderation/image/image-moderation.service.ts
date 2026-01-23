import { Inject, Injectable, Logger } from '@nestjs/common';
import { OPENAI_CLIENT } from 'src/integrations/openai/openai.constants';
import { ModerationPolicyService } from '../policy/moderation-policy.service';
import { ModerationDecision } from '../types';
import { S3Service } from 'src/uploads/s3.service';
import { ModerationRejectedException } from 'src/common/errors/moderation.exception';

@Injectable()
export class ImageModerationService {
  private readonly logger = new Logger(ImageModerationService.name);
  private readonly model =
    process.env.MODERATION_MODEL ?? 'omni-moderation-latest';

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: any,
    private readonly policy: ModerationPolicyService,
    private readonly s3: S3Service,
  ) {}

  async moderateImageUrl(
    url: string,
    textHint?: string,
  ): Promise<ModerationDecision> {
    const input = [
      ...(textHint ? [{ type: 'text', text: textHint }] : []),
      { type: 'image_url', image_url: { url } },
    ];

    const res = await this.openai.moderations.create({
      model: this.model,
      input,
    });

    const result = res?.results?.[0];
    const decision = this.policy.decideFromResult(result);

    this.logger.log(
      `[image] allowed=${decision.allowed} reasons=${decision.reasons.join(',')}`,
    );
    return decision;
  }

  async moderateS3Key(key: string): Promise<ModerationDecision> {
    // 1) Signed GET
    const signedUrl = await this.s3.signGetUrl(key, 120);

    try {
      return await this.moderateImageUrl(signedUrl);
    } catch (e: any) {
      this.logger.warn(
        `[image] signedUrl failed, fallback base64. err=${e?.message ?? e}`,
      );

      // 2) fallback base64
      const { buffer, contentType } = await this.s3.getObjectBuffer(key);
      const ct = contentType ?? 'image/jpeg';
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${ct};base64,${base64}`;

      return await this.moderateImageUrl(dataUrl);
    }
  }

  async assertAllowedS3Key(key: string) {
    const decision = await this.moderateS3Key(key);
    if (!decision.allowed) {
      throw new ModerationRejectedException({
        code: 'MODERATION_REJECTED',
        target: 'image',
        reasons: decision.reasons,
        categories: decision.categories,
      });
    }
  }
}
