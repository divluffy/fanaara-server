// src\creator-comics\services\openai-vision.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { PageAnalysisSchema } from '../openai/page-analysis.zod';
import { buildComicPagePrompt } from '../openai/prompt';
import { OPENAI_CLIENT } from 'src/integrations/openai/openai.constants';

/**
 * Responses API supports image inputs (`input_image` + `image_url`) :contentReference[oaicite:4]{index=4}
 * and supports Structured Outputs via `text.format` with Zod helper. :contentReference[oaicite:5]{index=5}
 */
@Injectable()
export class OpenAiVisionService {
  constructor(
    private readonly config: ConfigService,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
  ) {}

  async analyzeComicPage(params: {
    imageUrl: string;
    workType: string;
    artStyleCategory: string;
    pageWidth: number;
    pageHeight: number;
    model?: string;
    detail?: 'low' | 'high';
  }) {
    const model =
      params.model ??
      this.config.get<string>('OPENAI_VISION_MODEL') ??
      'gpt-4o-2024-08-06';
    const detail =
      params.detail ??
      (this.config.get<string>('OPENAI_VISION_DETAIL') as any) ??
      'high';
    const store =
      (this.config.get<string>('OPENAI_STORE_RESPONSES') ?? 'false') === 'true';

    const prompt = buildComicPagePrompt({
      workType: params.workType,
      artStyleCategory: params.artStyleCategory,
      pageWidth: params.pageWidth,
      pageHeight: params.pageHeight,
    });

    const response = await this.client.responses.parse({
      model,
      store, // false recommended in production unless you need retrieval :contentReference[oaicite:6]{index=6}
      temperature: 0,
      max_output_tokens: 2200,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_image',
              image_url: params.imageUrl,
              detail, // "high" for more detail
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(PageAnalysisSchema, 'page_analysis'),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error(
        'OpenAI returned null output_parsed (schema mismatch or model output not valid).',
      );
    }

    return {
      modelUsed: model,
      detailUsed: detail,
      parsed, // الآن non-null
    };
  }
}
