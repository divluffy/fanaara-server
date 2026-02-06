// src/creator-comics/openai/mapper.ts
import { randomUUID, createHash } from 'crypto';
import { PageAnalysisSchema } from './page-analysis.zod';
import {
  PageAnnotationsDoc,
  PageElement,
} from '../contracts/annotations.contract';

export type PageAnalysis = ReturnType<typeof PageAnalysisSchema.parse>;

const DEFAULT_STYLE_BY_TEMPLATE: Record<string, any> = {
  bubble_ellipse: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 40,
    align: 'center',
  },
  bubble_roundrect: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 40,
    align: 'center',
  },
  bubble_cloud: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 40,
    align: 'center',
  },
  bubble_burst: {
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 40,
    align: 'center',
  },

  narration_rect: {
    fill: '#f7f7f7',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 34,
    align: 'center',
  },
  narration_roundrect: {
    fill: '#f7f7f7',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 34,
    align: 'center',
  },
  caption_box: {
    fill: '#f7f7f7',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 34,
    align: 'center',
  },

  scene_label: {
    fill: '#ffffffcc',
    stroke: '#111111',
    strokeWidth: 1,
    opacity: 1,
    fontSize: 28,
    align: 'center',
  },
  signage_label: {
    fill: '#ffffffcc',
    stroke: '#111111',
    strokeWidth: 1,
    opacity: 1,
    fontSize: 28,
    align: 'center',
  },

  sfx_burst: {
    fill: '#00000000',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 46,
    align: 'center',
  },
  sfx_outline: {
    fill: '#00000000',
    stroke: '#111111',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 46,
    align: 'center',
  },

  plain_text: {
    fill: '#00000000',
    stroke: '#00ff00',
    strokeWidth: 0,
    opacity: 1,
    fontSize: 34,
    align: 'center',
  },
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampBBox(b: any) {
  const x = clamp01(Number(b?.x ?? 0));
  const y = clamp01(Number(b?.y ?? 0));
  let w = clamp01(Number(b?.w ?? 0));
  let h = clamp01(Number(b?.h ?? 0));

  if (w < 0.0005) w = 0.0005;
  if (h < 0.0005) h = 0.0005;

  if (x + w > 1) w = clamp01(1 - x);
  if (y + h > 1) h = clamp01(1 - y);

  return { x, y, w, h };
}

function bboxCenter(b: { x: number; y: number; w: number; h: number }) {
  return { x: clamp01(b.x + b.w / 2), y: clamp01(b.y + b.h / 2) };
}

function deriveFontSizePx(params: {
  text: string;
  textBBoxNorm: { h: number } | null;
  containerBBoxNorm: { h: number };
  pageH: number;
  writingDirection: string;
  fallback: number;
}) {
  const {
    text,
    textBBoxNorm,
    containerBBoxNorm,
    pageH,
    writingDirection,
    fallback,
  } = params;

  const lines = (text ?? '').split('\n').filter((x) => x.trim().length > 0);
  const lineCount = Math.max(1, lines.length);

  const textHPx = (textBBoxNorm?.h ?? containerBBoxNorm.h * 0.6) * pageH;
  const lineHeight = 1.15;

  let fs = Math.round(textHPx / (lineCount * lineHeight));
  if (!Number.isFinite(fs) || fs <= 0) fs = fallback;

  // clamp sane range for manga pages
  fs = Math.max(12, Math.min(160, fs));

  // If TTB, sometimes lineCount blows up, so keep fallback safety
  if (writingDirection === 'TTB') fs = Math.max(14, Math.min(120, fs));

  return fs;
}

function derivePaddingPx(params: {
  containerNorm: { w: number; h: number };
  textNorm: { w: number; h: number } | null;
  pageW: number;
  pageH: number;
  fallback: number;
}) {
  const { containerNorm, textNorm, pageW, pageH, fallback } = params;
  if (!textNorm) return fallback;

  const cW = containerNorm.w * pageW;
  const cH = containerNorm.h * pageH;
  const tW = textNorm.w * pageW;
  const tH = textNorm.h * pageH;

  const padX = (cW - tW) / 2;
  const padY = (cH - tH) / 2;
  const pad = Math.floor(Math.max(0, Math.min(padX, padY)));

  return Math.max(4, Math.min(80, pad || fallback));
}

function stableId(pageId: string, el: any) {
  const c = el.geometry?.container_bbox ?? { x: 0, y: 0, w: 0, h: 0 };
  const t = String(el.text?.original ?? '').slice(0, 40);
  const key = `${pageId}|${el.elementType}|${Math.round(c.x * 500)}|${Math.round(c.y * 500)}|${Math.round(c.w * 500)}|${Math.round(c.h * 500)}|${t}`;
  return createHash('sha1').update(key).digest('hex').slice(0, 24);
}

export function mapAnalysisToAnnotations(params: {
  pageId: string;
  analysis: PageAnalysis;
  pageWidth: number;
  pageHeight: number;
}): PageAnnotationsDoc {
  const { pageId, analysis, pageWidth, pageHeight } = params;
  const now = new Date().toISOString();

  const keywords = (analysis.page_metadata.keywords ?? [])
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, 40);

  const sceneDescription = String(
    analysis.page_metadata.scene_description ?? '',
  ).slice(0, 400);

  const elements: PageElement[] = (analysis.elements ?? []).map((e) => {
    const id = stableId(pageId, e) || randomUUID();

    const templateId = e.container.template_id;
    const styleBase =
      DEFAULT_STYLE_BY_TEMPLATE[templateId] ??
      DEFAULT_STYLE_BY_TEMPLATE['plain_text'];

    const container_bbox = clampBBox(e.geometry.container_bbox);
    const text_bbox =
      e.geometry.text_bbox == null
        ? undefined
        : clampBBox(e.geometry.text_bbox);

    const anchor = bboxCenter(container_bbox);

    const textOriginal = String(e.text.original ?? '');

    const paddingPx =
      e.container.shape === 'none'
        ? null
        : derivePaddingPx({
            containerNorm: container_bbox,
            textNorm: text_bbox ?? null,
            pageW: pageWidth,
            pageH: pageHeight,
            fallback: 12,
          });

    const cornerRadiusPx =
      e.container.shape === 'roundrect'
        ? Math.max(
            8,
            Math.min(72, Number(e.container.params.cornerRadius ?? 18)),
          )
        : null;

    const spikes =
      e.container.shape === 'burst'
        ? Math.max(6, Math.min(24, Number(e.container.params.spikes ?? 10)))
        : null;

    const fontSizePx = deriveFontSizePx({
      text: textOriginal,
      textBBoxNorm: text_bbox ? { h: text_bbox.h } : null,
      containerBBoxNorm: { h: container_bbox.h },
      pageH: pageHeight,
      writingDirection: e.text.writingDirection,
      fallback: Number(styleBase.fontSize ?? 34),
    });

    return {
      id,
      source: 'ai',
      status: Number(e.confidence ?? 0) < 0.45 ? 'needs_review' : 'detected',
      elementType: e.elementType,
      readingOrder: Math.max(1, Math.floor(Number(e.readingOrder ?? 1))),
      confidence: clamp01(Number(e.confidence ?? 0)),

      geometry: {
        container_bbox,
        text_bbox,
        anchor,
      },

      container: {
        shape: e.container.shape,
        template_id: templateId,
        params: {
          padding: paddingPx,
          cornerRadius: cornerRadiusPx,
          spikes: spikes,
          // optional: tailEnabled etc can stay for UI
        },
      },

      text: {
        original: textOriginal,
        translated: '',
        lang: e.text.lang,
        writingDirection: e.text.writingDirection,
        sizeHint: e.text.sizeHint,
        styleHint: e.text.styleHint,
      },

      style: {
        ...styleBase,
        fontSize: fontSizePx, // ✅ px on original image
        strokeWidth: Number(styleBase.strokeWidth ?? 2),
        textRotation: Number(e.text.rotation_deg ?? 0), // ✅ send to client
      },

      notes: e.notes ?? undefined,
    };
  });

  // normalize readingOrder 1..N
  elements.sort((a, b) => a.readingOrder - b.readingOrder);
  elements.forEach((e, i) => (e.readingOrder = i + 1));

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
