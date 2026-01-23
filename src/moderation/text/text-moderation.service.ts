// src\moderation\text\text-moderation.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OPENAI_CLIENT } from 'src/integrations/openai/openai.constants';
import { RedisService } from 'src/redis/redis.service';
import { sha256 } from 'src/common/utils/hash';
import { ModerationPolicyService } from '../policy/moderation-policy.service';
import { ModerationDecision, TextContext } from '../types';
import { ModerationRejectedException } from 'src/common/errors/moderation.exception';
import type OpenAI from 'openai';

@Injectable()
export class TextModerationService {
  private readonly logger = new Logger(TextModerationService.name);
  private readonly model =
    process.env.MODERATION_MODEL ?? 'omni-moderation-latest';
  private readonly cacheTtl = Number(
    process.env.MODERATION_TEXT_CACHE_TTL ?? 60 * 60 * 24,
  ); // 1 day

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    private readonly redis: RedisService,
    private readonly policy: ModerationPolicyService,
  ) {}

  normalize(text: string) {
    return (text ?? '').trim();
  }

  private cacheKey(context: TextContext | undefined, normalized: string) {
    return `mod:text:${context ?? 'general'}:${sha256(normalized)}`;
  }

  async moderateOne(
    text: string,
    context?: TextContext,
  ): Promise<ModerationDecision> {
    const normalized = this.normalize(text);
    if (!normalized) return { allowed: true, action: 'keep', reasons: [] };

    const key = this.cacheKey(context, normalized);
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as ModerationDecision;

    const res = await this.openai.moderations.create({
      model: this.model,
      input: normalized,
    });

    const result = res?.results?.[0];
    const decision = this.policy.decideFromResult(result);

    await this.redis.set(key, JSON.stringify(decision), this.cacheTtl);

    this.logger.log(
      `[text] context=${context ?? 'general'} allowed=${decision.allowed}`,
    );

    return decision;
  }

  async moderateMany(items: Array<{ text: string; context?: TextContext }>) {
    const normalized = items.map((i) => this.normalize(i.text));
    const out: ModerationDecision[] = new Array(items.length);

    // 1) cache hits
    const keys = normalized.map((t, idx) =>
      this.cacheKey(items[idx].context, t),
    );
    const pipe = this.redis.pipeline();
    keys.forEach((k) => pipe.get(k));
    const cached = (await pipe.exec()) ?? [];

    const toCall: { idx: number; text: string }[] = [];

    cached.forEach((row, idx) => {
      // ioredis-style: [Error | null, string | null]
      const val = (Array.isArray(row) ? row[1] : null) as string | null;

      if (val) out[idx] = JSON.parse(val) as ModerationDecision;
      else {
        if (!normalized[idx])
          out[idx] = { allowed: true, action: 'keep', reasons: [] };
        else toCall.push({ idx, text: normalized[idx] });
      }
    });

    // 2) call OpenAI in one batch for misses
    if (toCall.length) {
      const inputs = toCall.map((x) => x.text);
      console.log('inputs toCall text moderation: ', inputs);

      const res = await this.openai.moderations.create({
        model: this.model,
        input: inputs,
      });
      console.log('res: ', res);

      const results = res?.results ?? [];
      console.log('results check texts: ', results);

      const setPipe = this.redis.pipeline();
      toCall.forEach((x, j) => {
        const decision = this.policy.decideFromResult(results[j]);
        out[x.idx] = decision;
        setPipe.set(keys[x.idx], JSON.stringify(decision), 'EX', this.cacheTtl);
      });
      await setPipe.exec();
    }

    return out;
  }

  async assertAllowed(
    items: Array<{ text: string; context?: TextContext; field?: string }>,
  ) {
    const decisions = await this.moderateMany(
      items.map(({ text, context }) => ({ text, context })),
    );
    console.log('decisions: ', decisions);
    const rejected: { reasons: string[]; field?: string; categories?: any }[] =
      [];

    decisions.forEach((d, idx) => {
      if (!d.allowed)
        rejected.push({
          reasons: d.reasons,
          field: items[idx].field,
          categories: d.categories,
        });
    });

    if (rejected.length) {
      const reasons = rejected.flatMap((x) =>
        x.field ? x.reasons.map((r) => `${x.field}:${r}`) : x.reasons,
      );
      throw new ModerationRejectedException({
        code: 'MODERATION_REJECTED',
        target: 'text',
        reasons,
      });
    }
  }
}
