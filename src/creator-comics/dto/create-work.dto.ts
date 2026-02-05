// src\creator-comics\dto\create-work.dto.ts
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum WorkType {
  MANGA = 'MANGA',
  MANHWA = 'MANHWA',
  MANHUA = 'MANHUA',
  COMIC = 'COMIC',
  WEBTOON = 'WEBTOON',
  OTHER = 'OTHER',
}

export enum ArtStyleCategory {
  BW_MANGA = 'BW_MANGA',
  FULL_COLOR = 'FULL_COLOR',
  WESTERN_COMIC = 'WESTERN_COMIC',
  SEMI_REALISTIC = 'SEMI_REALISTIC',
  REALISTIC = 'REALISTIC',
  CHIBI = 'CHIBI',
  PIXEL_ART = 'PIXEL_ART',
  OTHER = 'OTHER',
}

export class CreateWorkDto {
  @IsEnum(WorkType)
  workType!: WorkType;

  @IsEnum(ArtStyleCategory)
  artStyleCategory!: ArtStyleCategory;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  defaultLang?: string; // "ar" | "en" | ...
}
