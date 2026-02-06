// src/creator-comics/openai/tile-analysis.zod.ts
import { z } from 'zod';
import {
  TextLang,
  WritingDirection,
  ElementType,
  ContainerShape,
  TemplateId,
  NormalizedBBox,
  NormalizedPoint,
  ContainerParams,
} from './page-analysis.zod';

/**
 * Tile schema: all geometry normalized to the TILE image (0..1 in the crop),
 * server will convert to FULL PAGE normalized coords.
 */
export const TileAnalysisSchema = z.object({
  elements: z.array(
    z.object({
      local_id: z.string(),

      elementType: ElementType,
      readingOrder: z.number(),
      confidence: z.number(),

      geometry: z.object({
        container_bbox: NormalizedBBox,
        text_bbox: NormalizedBBox.nullable(),
        anchor: NormalizedPoint,
      }),

      container: z.object({
        shape: ContainerShape,
        template_id: TemplateId,
        params: ContainerParams,
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
        rotation_deg: z.number(),
      }),

      notes: z.string().nullable(),
    }),
  ),
});

export type TileAnalysis = ReturnType<typeof TileAnalysisSchema.parse>;
