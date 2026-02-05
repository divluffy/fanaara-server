// src\creator-comics\dto\presign.dto.ts
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PresignFileItemDto {
  @IsString()
  clientFileId!: string; // id في الواجهة لتتبع التقدم

  @IsString()
  filename!: string;

  @IsString()
  contentType!: string;
}

export class PresignDto {
  @IsString()
  workId!: string;

  @IsString()
  chapterId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PresignFileItemDto)
  files!: PresignFileItemDto[];
}
