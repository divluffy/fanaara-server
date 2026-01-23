import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { TextContext } from '../types';

class TextItemDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  context?: TextContext;
}

export class ModerateTextDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TextItemDto)
  items?: TextItemDto[];
}
