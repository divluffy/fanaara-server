// src/creator-comics/openai/mapper.ts
import {
  PageAnnotationsDoc,
  PageElement,
} from '../contracts/annotations.contract';
import { PageAnalysisSchema } from './page-analysis.zod';
import { randomUUID } from 'crypto';

export type PageAnalysis = ReturnType<typeof PageAnalysisSchema.parse>;

const DEFAULT_STYLE_BY_TEMPLATE: Record<string, any> = {
  bubble_ellipse: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 22,
    align: 'center',
  },
  bubble_roundrect: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 22,
    align: 'center',
  },
  bubble_cloud: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 22,
    align: 'center',
  },
  bubble_burst: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 22,
    align: 'center',
  },

  narration_rect: {
    fill: '#f7f7f7',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 20,
    align: 'center',
  },
  narration_roundrect: {
    fill: '#f7f7f7',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 20,
    align: 'center',
  },
  caption_box: {
    fill: '#f7f7f7',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 20,
    align: 'center',
  },

  scene_label: {
    fill: '#ffffffcc',
    stroke: '#111111',
    strokeWidth: 1,
    opacity: 1,
    fontSize: 18,
    align: 'center',
  },
  signage_label: {
    fill: '#ffffffcc',
    stroke: '#111111',
    strokeWidth: 1,
    opacity: 1,
    fontSize: 18,
    align: 'center',
  },

  sfx_burst: {
    fill: '#00000000',
    stroke: '#ff00ff',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 26,
    align: 'center',
  },
  sfx_outline: {
    fill: '#00000000',
    stroke: '#ff00ff',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 26,
    align: 'center',
  },

  plain_text: {
    fill: '#00000000',
    stroke: '#00ff00',
    strokeWidth: 0,
    opacity: 1,
    fontSize: 20,
    align: 'center',
  },
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampBBox(b: any) {
  const x = clamp01(Number(b?.x ?? 0));
  const y = clamp01(Number(b?.y ?? 0));
  let w = clamp01(Number(b?.w ?? 0));
  let h = clamp01(Number(b?.h ?? 0));

  // ensure bbox doesn't overflow image bounds
  if (x + w > 1) w = clamp01(1 - x);
  if (y + h > 1) h = clamp01(1 - y);

  return { x, y, w, h };
}

function clampPoint(p: any) {
  return {
    x: clamp01(Number(p?.x ?? 0)),
    y: clamp01(Number(p?.y ?? 0)),
  };
}

export function mapAnalysisToAnnotations(
  pageId: string,
  analysis: PageAnalysis,
): PageAnnotationsDoc {
  const now = new Date().toISOString();

  const keywords = (analysis.page_metadata.keywords ?? [])
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, 40);

  const sceneDescription = String(
    analysis.page_metadata.scene_description ?? '',
  ).slice(0, 400);

  const elements: PageElement[] = (analysis.elements ?? []).map((e) => {
    const id = randomUUID();

    const style =
      DEFAULT_STYLE_BY_TEMPLATE[e.container.template_id] ??
      DEFAULT_STYLE_BY_TEMPLATE['bubble_ellipse'];

    const container_bbox = clampBBox(e.geometry.container_bbox);

    const anchor =
      e.geometry.anchor != null
        ? clampPoint(e.geometry.anchor)
        : {
            x: clamp01(container_bbox.x + container_bbox.w / 2),
            y: clamp01(container_bbox.y + container_bbox.h / 2),
          };

    const text_bbox =
      e.geometry.text_bbox == null ? undefined : clampBBox(e.geometry.text_bbox);

    return {
      id,
      source: 'ai',
      status: e.confidence < 0.45 ? 'needs_review' : 'detected',
      elementType: e.elementType,
      readingOrder: Math.max(0, Math.floor(Number(e.readingOrder ?? 0))),
      confidence: Number.isFinite(Number(e.confidence))
        ? clamp01(Number(e.confidence))
        : 0,

      geometry: {
        container_bbox,
        text_bbox,
        anchor,
      },

      container: {
        shape: e.container.shape,
        template_id: e.container.template_id,
        // params is now a standardized object; keep as-is
        params: e.container.params ?? { padding: null, cornerRadius: null, spikes: null },
      },

      text: {
        original: String(e.text.original ?? ''),
        translated: '',
        lang: e.text.lang,
        writingDirection: e.text.writingDirection,
        sizeHint: e.text.sizeHint,
        styleHint: e.text.styleHint,
      },

      style,
      notes: e.notes ?? undefined,
    };
  });

  return {
    version: 1,
    pageId,
    meta: {
      keywords,
      sceneDescription,
      languageHint: analysis.page_metadata.language_hint ?? 'unknown',
    },
    elements,
    updatedAt: now,
  };
}
