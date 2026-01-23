import { Injectable } from '@nestjs/common';
import { ModerationDecision } from '../types';

@Injectable()
export class ModerationPolicyService {
  // ✅ سياسة بسيطة وفعّالة كبداية: flagged => block
  decideFromResult(result: any): ModerationDecision {
    const flagged = Boolean(result?.flagged);
    const categories = (result?.categories ?? {}) as Record<string, boolean>;

    const reasons = Object.entries(categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    if (flagged) {
      // تقدر لاحقًا تعمل "review" لبعض الحالات بدل delete
      return {
        allowed: false,
        action: 'delete',
        reasons: reasons.length ? reasons : ['flagged'],
        categories,
        raw: result,
      };
    }

    return {
      allowed: true,
      action: 'keep',
      reasons: [],
      categories,
      raw: result,
    };
  }
}
