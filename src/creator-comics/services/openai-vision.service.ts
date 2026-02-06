// src/creator-comics/services/openai-vision.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import sharp from 'sharp';

import { PageAnalysisSchema } from '../openai/page-analysis.zod';
import { TileAnalysisSchema, TileAnalysis } from '../openai/tile-analysis.zod';
import {
  ElementRefineSchema,
  ElementRefine,
} from '../openai/element-refine.zod';

import {
  buildComicPagePromptFull,
  buildComicPagePromptTile,
  buildComicElementRefinePrompt,
} from '../openai/prompt';

import { OPENAI_CLIENT } from 'src/integrations/openai/openai.constants';

type PageAnalysis = ReturnType<typeof PageAnalysisSchema.parse>;

type TileRect = { x: number; y: number; w: number; h: number; id: string };

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function iou(a: any, b: any) {
  const ax1 = a.x,
    ay1 = a.y,
    ax2 = a.x + a.w,
    ay2 = a.y + a.h;
  const bx1 = b.x,
    by1 = b.y,
    bx2 = b.x + b.w,
    by2 = b.y + b.h;

  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  if (union <= 0) return 0;
  return inter / union;
}

function normBBoxToFull(params: {
  tileBBox: { x: number; y: number; w: number; h: number };
  tile: TileRect;
  fullW: number;
  fullH: number;
}) {
  const { tileBBox, tile, fullW, fullH } = params;

  const xPx = tile.x + tileBBox.x * tile.w;
  const yPx = tile.y + tileBBox.y * tile.h;
  const wPx = tileBBox.w * tile.w;
  const hPx = tileBBox.h * tile.h;

  return {
    x: clamp01(xPx / fullW),
    y: clamp01(yPx / fullH),
    w: clamp01(wPx / fullW),
    h: clamp01(hPx / fullH),
  };
}

function normPointToFull(params: {
  tilePt: { x: number; y: number };
  tile: TileRect;
  fullW: number;
  fullH: number;
}) {
  const { tilePt, tile, fullW, fullH } = params;
  const xPx = tile.x + tilePt.x * tile.w;
  const yPx = tile.y + tilePt.y * tile.h;
  return { x: clamp01(xPx / fullW), y: clamp01(yPx / fullH) };
}

function computeTiles(params: {
  fullW: number;
  fullH: number;
  tileW?: number;
  tileH?: number;
  overlap?: number;
}) {
  const { fullW, fullH } = params;
  const tileW = Math.min(params.tileW ?? 1024, fullW);
  const tileH = Math.min(params.tileH ?? 1024, fullH);
  const overlap = Math.max(0, Math.min(0.45, params.overlap ?? 0.2));

  const stepX = Math.max(1, Math.floor(tileW * (1 - overlap)));
  const stepY = Math.max(1, Math.floor(tileH * (1 - overlap)));

  const xs: number[] = [];
  for (let x = 0; x < fullW; x += stepX) {
    xs.push(Math.min(x, fullW - tileW));
    if (x + tileW >= fullW) break;
  }

  const ys: number[] = [];
  for (let y = 0; y < fullH; y += stepY) {
    ys.push(Math.min(y, fullH - tileH));
    if (y + tileH >= fullH) break;
  }

  const tiles: TileRect[] = [];
  let idx = 1;
  for (const y of ys) {
    for (const x of xs) {
      tiles.push({ x, y, w: tileW, h: tileH, id: `tile_${idx++}_${x}_${y}` });
    }
  }
  return tiles;
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
) {
  const results: T[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (i < tasks.length) {
      const my = i++;
      results[my] = await tasks[my]();
    }
  });

  await Promise.all(workers);
  return results;
}

@Injectable()
export class OpenAiVisionService {
  constructor(
    private readonly config: ConfigService,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
  ) {}

  private getModel(paramsModel?: string) {
    return (
      paramsModel ??
      this.config.get<string>('OPENAI_VISION_MODEL') ??
      'gpt-4o-2024-08-06'
    );
  }

  private getDetail(paramsDetail?: 'low' | 'high') {
    return (
      paramsDetail ??
      (this.config.get<string>('OPENAI_VISION_DETAIL') as any) ??
      'high'
    );
  }

  private getStore() {
    return (
      (this.config.get<string>('OPENAI_STORE_RESPONSES') ?? 'false') === 'true'
    );
  }

  private async fetchImageBuffer(url: string) {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }

  private toDataUrlJpeg(buf: Buffer) {
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  /**
   * Full pass: good for metadata + global context
   */
  async analyzeComicPageFull(params: {
    imageUrl: string;
    workType: string;
    artStyleCategory: string;
    pageWidth: number;
    pageHeight: number;
    model?: string;
    detail?: 'low' | 'high';
  }) {
    const model = this.getModel(params.model);
    const detail = this.getDetail(params.detail);
    const store = this.getStore();

    const max_output_tokens = Number(
      this.config.get<string>('OPENAI_VISION_MAX_OUTPUT_TOKENS') ?? 7000,
    );

    const prompt = buildComicPagePromptFull({
      workType: params.workType,
      artStyleCategory: params.artStyleCategory,
      pageWidth: params.pageWidth,
      pageHeight: params.pageHeight,
    });

    const response = await this.client.responses.parse({
      model,
      store,
      temperature: 0,
      max_output_tokens,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: params.imageUrl, detail },
          ],
        },
      ],
      text: { format: zodTextFormat(PageAnalysisSchema, 'page_analysis') },
    });

    const parsed = response.output_parsed;
    if (!parsed)
      throw new Error('OpenAI returned null output_parsed (schema mismatch).');

    return { modelUsed: model, detailUsed: detail, parsed };
  }

  /**
   * Tiles pass: high recall for small SFX / small texts
   */
  async analyzeComicPageTiles(params: {
    imageUrl: string;
    workType: string;
    artStyleCategory: string;
    pageWidth: number;
    pageHeight: number;
    model?: string;
    detail?: 'low' | 'high';
  }) {
    const model = this.getModel(params.model);
    const detail = this.getDetail(params.detail);
    const store = this.getStore();

    const tileMaxTokens = Number(
      this.config.get<string>('OPENAI_VISION_TILE_MAX_OUTPUT_TOKENS') ?? 2500,
    );
    const tileConcurrency = Number(
      this.config.get<string>('OPENAI_VISION_TILE_CONCURRENCY') ?? 2,
    );

    const fullBuf = await this.fetchImageBuffer(params.imageUrl);

    const tiles = computeTiles({
      fullW: params.pageWidth,
      fullH: params.pageHeight,
      tileW: 1024,
      tileH: 1024,
      overlap: 0.2,
    });

    const tasks = tiles.map((tile) => async () => {
      const crop = await sharp(fullBuf)
        .extract({ left: tile.x, top: tile.y, width: tile.w, height: tile.h })
        .jpeg({ quality: 95 })
        .toBuffer();

      const prompt = buildComicPagePromptTile({
        workType: params.workType,
        artStyleCategory: params.artStyleCategory,
        fullWidth: params.pageWidth,
        fullHeight: params.pageHeight,
        tileX: tile.x,
        tileY: tile.y,
        tileW: tile.w,
        tileH: tile.h,
      });

      const response = await this.client.responses.parse({
        model,
        store,
        temperature: 0,
        max_output_tokens: tileMaxTokens,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              {
                type: 'input_image',
                image_url: this.toDataUrlJpeg(crop),
                detail,
              },
            ],
          },
        ],
        text: { format: zodTextFormat(TileAnalysisSchema, 'tile_analysis') },
      });

      const parsed = response.output_parsed;
      if (!parsed) throw new Error(`Tile parse failed: ${tile.id}`);

      return { tile, parsed };
    });

    const results = await runWithConcurrency(tasks, tileConcurrency);

    // Convert tile elements to FULL normalized coords
    const fullElements: PageAnalysis['elements'] = [];

    for (const r of results) {
      const tile = r.tile;
      const ta: TileAnalysis = r.parsed;

      for (const e of ta.elements) {
        const container_bbox = normBBoxToFull({
          tileBBox: e.geometry.container_bbox,
          tile,
          fullW: params.pageWidth,
          fullH: params.pageHeight,
        });

        const text_bbox =
          e.geometry.text_bbox == null
            ? null
            : normBBoxToFull({
                tileBBox: e.geometry.text_bbox,
                tile,
                fullW: params.pageWidth,
                fullH: params.pageHeight,
              });

        const anchor = normPointToFull({
          tilePt: e.geometry.anchor,
          tile,
          fullW: params.pageWidth,
          fullH: params.pageHeight,
        });

        fullElements.push({
          ...e,
          geometry: { container_bbox, text_bbox, anchor },
        } as any);
      }
    }

    return {
      modelUsed: model,
      detailUsed: detail,
      tilesCount: tiles.length,
      elements: fullElements,
    };
  }

  /**
   * Merge elements (dedupe) by IoU
   */
  private mergeElements(params: {
    full: PageAnalysis['elements'];
    tiles: PageAnalysis['elements'];
  }) {
    const out: PageAnalysis['elements'] = [];

    const all = [...params.full, ...params.tiles];

    for (const el of all) {
      const c = el.geometry.container_bbox;
      let bestIdx = -1;
      let bestIoU = 0;

      for (let i = 0; i < out.length; i++) {
        const iouVal = iou(c, out[i].geometry.container_bbox);
        if (iouVal > bestIoU) {
          bestIoU = iouVal;
          bestIdx = i;
        }
      }

      if (bestIdx === -1 || bestIoU < 0.65) {
        out.push(el);
        continue;
      }

      // Merge strategy: keep higher confidence, but preserve richer text
      const cur = out[bestIdx];
      const a = cur.confidence ?? 0;
      const b = el.confidence ?? 0;

      const prefer = b > a ? el : cur;
      const other = b > a ? cur : el;

      const preferText = (prefer.text?.original ?? '').trim();
      const otherText = (other.text?.original ?? '').trim();

      out[bestIdx] = {
        ...prefer,
        text: {
          ...prefer.text,
          // take longer text or with more line breaks
          original:
            preferText.length >= otherText.length ||
            preferText.split('\n').length >= otherText.split('\n').length
              ? preferText
              : otherText,
        },
        confidence: Math.max(a, b),
      } as any;
    }

    return out;
  }

  private normalizeReadingOrder(
    elements: PageAnalysis['elements'],
    languageHint: string,
  ) {
    const rtl = languageHint === 'ar'; // you can extend for ja manga reading later
    const sorted = elements.slice().sort((a, b) => {
      const ay = a.geometry.anchor.y;
      const by = b.geometry.anchor.y;
      const dy = ay - by;
      if (Math.abs(dy) > 0.02) return dy;

      const ax = a.geometry.anchor.x;
      const bx = b.geometry.anchor.x;
      return rtl ? bx - ax : ax - bx;
    });

    return sorted.map((e, idx) => ({ ...e, readingOrder: idx + 1 }));
  }

  /**
   * Refine per element crop to get exact line breaks, rotation, etc.
   */
  async refineElements(params: {
    imageUrl: string;
    pageWidth: number;
    pageHeight: number;
    elements: PageAnalysis['elements'];
    model?: string;
    detail?: 'low' | 'high';
  }) {
    const model = this.getModel(params.model);
    const detail = this.getDetail(params.detail);
    const store = this.getStore();

    const refineMax = Number(
      this.config.get<string>('OPENAI_VISION_REFINE_MAX') ?? 120,
    );
    const refineConcurrency = Number(
      this.config.get<string>('OPENAI_VISION_REFINE_CONCURRENCY') ?? 2,
    );
    const refineTokens = Number(
      this.config.get<string>('OPENAI_VISION_REFINE_MAX_OUTPUT_TOKENS') ?? 900,
    );

    const fullBuf = await this.fetchImageBuffer(params.imageUrl);

    const targets = params.elements.slice(0, refineMax);

    const tasks = targets.map((el) => async () => {
      const c = el.geometry.container_bbox;
      const pad = 0.02; // add a little margin
      const x1 = Math.max(0, Math.floor((c.x - pad) * params.pageWidth));
      const y1 = Math.max(0, Math.floor((c.y - pad) * params.pageHeight));
      const x2 = Math.min(
        params.pageWidth,
        Math.ceil((c.x + c.w + pad) * params.pageWidth),
      );
      const y2 = Math.min(
        params.pageHeight,
        Math.ceil((c.y + c.h + pad) * params.pageHeight),
      );

      const w = Math.max(1, x2 - x1);
      const h = Math.max(1, y2 - y1);

      const crop = await sharp(fullBuf)
        .extract({ left: x1, top: y1, width: w, height: h })
        .jpeg({ quality: 95 })
        .toBuffer();

      const prompt = buildComicElementRefinePrompt({
        fullWidth: params.pageWidth,
        fullHeight: params.pageHeight,
      });

      const response = await this.client.responses.parse({
        model,
        store,
        temperature: 0,
        max_output_tokens: refineTokens,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              {
                type: 'input_image',
                image_url: this.toDataUrlJpeg(crop),
                detail,
              },
            ],
          },
        ],
        text: { format: zodTextFormat(ElementRefineSchema, 'element_refine') },
      });

      const refined: ElementRefine | null = response.output_parsed ?? null;
      if (!refined) return el;

      return {
        ...el,
        text: {
          ...el.text,
          original: refined.original,
          lang: refined.lang,
          writingDirection: refined.writingDirection,
          styleHint: el.text.styleHint,
          sizeHint: el.text.sizeHint,
          rotation_deg: refined.rotation_deg,
        },
        confidence: Math.max(el.confidence ?? 0, refined.confidence ?? 0),
      } as any;
    });

    const refined = await runWithConcurrency(tasks, refineConcurrency);

    // keep any remaining elements (not refined)
    const tail = params.elements.slice(refineMax);
    return [...refined, ...tail];
  }

  /**
   * ✅ Pro end-to-end: Full + Tiles + Merge + Normalize + Refine
   * returns PageAnalysis compatible object (same structure as PageAnalysisSchema)
   */
  async analyzeComicPagePro(params: {
    imageUrl: string;
    workType: string;
    artStyleCategory: string;
    pageWidth: number;
    pageHeight: number;
    model?: string;
    detail?: 'low' | 'high';
    refine?: boolean;
  }) {
    const full = await this.analyzeComicPageFull(params);
    const tiles = await this.analyzeComicPageTiles(params);

    const merged = this.mergeElements({
      full: full.parsed.elements ?? [],
      tiles: tiles.elements ?? [],
    });
    const ordered = this.normalizeReadingOrder(
      merged,
      full.parsed.page_metadata.language_hint,
    );

    const maybeRefined =
      params.refine === false
        ? ordered
        : await this.refineElements({
            imageUrl: params.imageUrl,
            pageWidth: params.pageWidth,
            pageHeight: params.pageHeight,
            elements: ordered,
            model: params.model,
            detail: params.detail,
          });

    const final: PageAnalysis = {
      page_metadata: full.parsed.page_metadata,
      elements: this.normalizeReadingOrder(
        maybeRefined,
        full.parsed.page_metadata.language_hint,
      ) as any,
    };

    return {
      modelUsed: full.modelUsed,
      detailUsed: full.detailUsed,
      parsed: final,
      debug: {
        tilesCount: tiles.tilesCount,
        fullCount: full.parsed.elements?.length ?? 0,
        mergedCount: final.elements.length,
      },
    };
  }
}
