// src\integrations\openai\openai.module.ts
import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './openai.constants';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        const ORG_ID = process.env.ORG_ID;
        if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
        return new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          organization: ORG_ID,
        });
      },
    },
  ],
  exports: [OPENAI_CLIENT],
})
export class OpenAIModule {}
