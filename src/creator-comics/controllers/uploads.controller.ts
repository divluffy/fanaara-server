// src\creator-comics\controllers\uploads.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { PresignDto } from '../dto/presign.dto';
import { UploadsService } from '../services/uploads.service';

@Controller('creator/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  async presign(@Body() dto: PresignDto) {
    return this.uploads.presignChapterPageUploads(dto);
  }
}
