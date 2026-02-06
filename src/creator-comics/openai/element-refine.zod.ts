// src/creator-comics/openai/element-refine.zod.ts
import { z } from 'zod';
import { TextLang, WritingDirection } from './page-analysis.zod';

/**
 * Refine schema: extract EXACT text with line breaks for a single element crop.
 */
export const ElementRefineSchema = z.object({
  original: z.string(),
  lang: TextLang,
  writingDirection: WritingDirection,
  rotation_deg: z.number(),
  confidence: z.number(),
  notes: z.string().nullable(),
});

export type ElementRefine = ReturnType<typeof ElementRefineSchema.parse>;
