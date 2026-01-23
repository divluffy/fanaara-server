import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { UploadPurpose } from '../uploads.constants';

export class PresignUploadDto {
  @IsIn(['avatar', 'post_image', 'cover', 'attachment'])
  purpose: UploadPurpose;

  @IsString()
  mimeType: string;

  @IsString()
  fileName: string;

  @IsInt()
  @Min(1)
  @Max(50_000_000)
  fileSize: number;

  @IsOptional()
  @IsString()
  extHint?: string;
}
