import { IsString } from 'class-validator';

export class CompleteUploadDto {
  @IsString()
  token: string;
}
