// src\creator-comics\controllers\pages.controller.ts
import { Body, Controller, Param, Patch } from '@nestjs/common';
import { SaveAnnotationsDto } from '../dto/save-annotations.dto';
import { PagesService } from '../services/pages.service';

@Controller('creator/pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Patch(':pageId/annotations')
  async saveAnnotations(
    @Param('pageId') pageId: string,
    @Body() dto: SaveAnnotationsDto,
  ) {
    return this.pages.saveAnnotations(pageId, dto.annotations);
  }
}
