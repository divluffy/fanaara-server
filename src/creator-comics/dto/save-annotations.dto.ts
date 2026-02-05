// src\creator-comics\dto\save-annotations.dto.ts
import { IsObject } from 'class-validator';

export class SaveAnnotationsDto {
  @IsObject()
  annotations!: any; // PageAnnotationsDoc (يمكن تشديده لاحقاً)
}
