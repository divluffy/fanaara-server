// src\uploads\uploads.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { S3Service } from './s3.service';
import { ModerationModule } from 'src/moderation/moderation.module';

@Module({
  imports: [forwardRef(() => ModerationModule)],
  controllers: [UploadsController],
  providers: [UploadsService, S3Service],
  exports: [S3Service, UploadsService],
})
export class UploadsModule {}
