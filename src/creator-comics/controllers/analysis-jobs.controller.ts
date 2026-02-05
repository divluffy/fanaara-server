// src\creator-comics\controllers\analysis-jobs.controller.ts
import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { StartAnalysisDto } from '../dto/start-analysis.dto';
import { AnalysisJobsService } from '../services/analysis-jobs.service';

@Controller('creator')
export class AnalysisJobsController {
  private readonly logger = new Logger(AnalysisJobsController.name);

  constructor(private readonly jobs: AnalysisJobsService) {}

  @Post('chapters/:chapterId/analyze')
  async start(
    @Param('chapterId') chapterId: string,
    @Body() dto: StartAnalysisDto,
  ) {
    this.logger.log(`start analysis chapterId=${chapterId}`);
    return this.jobs.startChapterAnalysis(chapterId, dto);
  }

  @Get('analysis-jobs/:jobId')
  async status(@Param('jobId') jobId: string): Promise<any> {
    return this.jobs.getJobStatus(jobId);
  }
}
