// src/creator-comics/openai/page-analysis.zod.ts
import { z } from 'zod';

/**
 * IMPORTANT for OpenAI Structured Outputs (Responses API):
 * - Do NOT use .optional()
 * - All fields must be required
 * - Use .nullable() for "optional-like" fields
 */

export const TextLang = z.enum(['ar', 'en', 'ja', 'ko', 'zh', 'unknown']);
export const WritingDirection = z.enum(['RTL', 'LTR', 'TTB']);

export const ElementType = z.enum([
  'SPEECH',
  'THOUGHT',
  'NARRATION',
  'CAPTION',
  'SFX',
  'SCENE_TEXT',
  'SIGNAGE',
  'UI_TEXT',
]);

export const ContainerShape = z.enum([
  'ellipse',
  'roundrect',
  'rect',
  'cloud',
  'burst',
  'none',
]);

export const TemplateId = z.enum([
  'bubble_ellipse',
  'bubble_roundrect',
  'bubble_cloud',
  'bubble_burst',
  'narration_rect',
  'narration_roundrect',
  'caption_box',
  'scene_label',
  'signage_label',
  'sfx_burst',
  'sfx_outline',
  'plain_text',
]);

/**
 * NOTE:
 * Removing min/max constraints reduces schema mismatch frequency.
 * We will clamp in mapper before saving annotations.
 */
export const NormalizedBBox = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const NormalizedPoint = z.object({
  x: z.number(),
  y: z.number(),
});

/**
 * Standardize params to a simple shape. This dramatically improves Structured Outputs reliability.
 * Always include these keys. If not applicable, set null.
 */
export const ContainerParams = z.object({
  padding: z.number().nullable(),
  cornerRadius: z.number().nullable(),
  spikes: z.number().nullable(),
});

export const PageAnalysisSchema = z.object({
  page_metadata: z.object({
    keywords: z.array(z.string()),
    scene_description: z.string(),
    language_hint: TextLang,
  }),

  // keep it unbounded to avoid mismatch; we enforce practical cap in the prompt
  elements: z.array(
    z.object({
      local_id: z.string(),

      elementType: ElementType,
      readingOrder: z.number(),
      confidence: z.number(),

      geometry: z.object({
        container_bbox: NormalizedBBox,
        text_bbox: NormalizedBBox.nullable(), // required + nullable
        anchor: NormalizedPoint,
      }),

      container: z.object({
        shape: ContainerShape,
        template_id: TemplateId,
        params: ContainerParams, // required object
      }),

      text: z.object({
        original: z.string(),
        lang: TextLang,
        writingDirection: WritingDirection,
        sizeHint: z.enum(['small', 'medium', 'large']),
        styleHint: z.enum([
          'normal',
          'bold',
          'outlined',
          'shadowed',
          'handwritten',
          'distorted',
          '3d',
          'gradient',
          'none',
        ]),
      }),

      notes: z.string().nullable(), // required + nullable
    }),
  ),
});
