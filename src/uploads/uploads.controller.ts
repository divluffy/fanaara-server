
// src\uploads\uploads.controller.ts
import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { SessionGuard } from 'src/auth/guards/session.guard';
import { UploadsService } from './uploads.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { AbortUploadDto } from './dto/abort-upload.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { user: { id: string } };

@UseGuards(SessionGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  // ✅ 1) احصل على presigned PUT
  @Post('presign')
  presign(@Req() req: AuthedRequest, @Body() dto: PresignUploadDto) {
    return this.uploads.presign(req.user.id, dto);
  }

  // ✅ 2) بعد ما ترفع للـ S3 مباشرة: نعمل moderation + finalize
  @Post('complete')
  complete(@Req() req: AuthedRequest, @Body() dto: CompleteUploadDto) {
    return this.uploads.complete(req.user.id, dto.token);
  }

  // ✅ 3) لو المستخدم كنسل
  @Post('abort')
  abort(@Req() req: AuthedRequest, @Body() dto: AbortUploadDto) {
    return this.uploads.abort(req.user.id, dto.token);
  }
}
