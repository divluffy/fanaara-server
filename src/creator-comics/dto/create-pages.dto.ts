// src\creator-comics\dto\create-pages.dto.ts
import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreatePageItemDto {
  @IsInt()
  orderIndex!: number;

  @IsString()
  objectKey!: string;

  @IsString()
  originalFilename!: string;

  @IsInt()
  width!: number;

  @IsInt()
  height!: number;
}

export class CreatePagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePageItemDto)
  pages!: CreatePageItemDto[];
}
