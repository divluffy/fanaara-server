// src\creator-comics\dto\create-chapter.dto.ts
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateChapterDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsInt()
  number?: number;
}
