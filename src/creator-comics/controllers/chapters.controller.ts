// src\creator-comics\controllers\chapters.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateChapterDto } from '../dto/create-chapter.dto';
import { CreatePagesDto } from '../dto/create-pages.dto';
import { ChaptersService } from '../services/chapters.service';

@Controller('creator')
export class ChaptersController {
  constructor(private readonly chapters: ChaptersService) {}

  @Patch('chapters/:chapterId/pages/reorder')
  async reorder(
    @Param('chapterId') chapterId: string,
    @Body() body: { order: Array<{ pageId: string; orderIndex: number }> },
  ) {
    return this.chapters.reorderPages(chapterId, body.order);
  }

  @Post('works/:workId/chapters')
  async createChapter(
    @Param('workId') workId: string,
    @Body() dto: CreateChapterDto,
  ) {
    // TODO: auth/ownership validation
    return this.chapters.createChapter(workId, dto);
  }

  @Post('chapters/:chapterId/pages')
  async createPages(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreatePagesDto,
  ) {
    return this.chapters.createPages(chapterId, dto);
  }

  @Get('chapters/:chapterId/editor')
  async getEditorPayload(@Param('chapterId') chapterId: string) {
    return this.chapters.getEditorPayload(chapterId);
  }
}
