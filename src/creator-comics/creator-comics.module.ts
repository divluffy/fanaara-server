// src\creator-comics\creator-comics.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { WorksController } from './controllers/works.controller';
import { UploadsController } from './controllers/uploads.controller';
import { ChaptersController } from './controllers/chapters.controller';
import { AnalysisJobsController } from './controllers/analysis-jobs.controller';
import { PagesController } from './controllers/pages.controller';

// Services
import { WorksService } from './services/works.service';
import { ChaptersService } from './services/chapters.service';
import { UploadsService } from './services/uploads.service';
import { PagesService } from './services/pages.service';
import { AnalysisJobsService } from './services/analysis-jobs.service';
import { OpenAiVisionService } from './services/openai-vision.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/uploads/s3.service';
import { OpenAIModule } from 'src/integrations/openai/openai.module';

@Module({
  imports: [ConfigModule, OpenAIModule],
  controllers: [
    WorksController,
    UploadsController,
    ChaptersController,
    AnalysisJobsController,
    PagesController,
  ],
  providers: [
    PrismaService,
    WorksService,
    ChaptersService,
    UploadsService,
    PagesService,
    AnalysisJobsService,
    S3Service,
    OpenAiVisionService,
  ],
  exports: [WorksService, ChaptersService, PagesService, UploadsService],
})
export class CreatorComicsModule {}
