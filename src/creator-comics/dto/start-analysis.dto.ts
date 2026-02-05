// src\creator-comics\dto\start-analysis.dto.ts
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class StartAnalysisDto {
  @IsOptional()
  @IsString()
  model?: string; // default from env

  @IsOptional()
  @IsIn(['low', 'high'])
  detail?: 'low' | 'high';

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
