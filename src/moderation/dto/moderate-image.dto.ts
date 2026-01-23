import { IsArray, IsOptional, IsString } from 'class-validator';

export class ModerateImageDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  keys?: string[];

  @IsOptional()
  @IsArray()
  urls?: string[];
}
