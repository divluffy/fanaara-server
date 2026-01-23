import { IsString } from 'class-validator';

export class AbortUploadDto {
  @IsString()
  token: string;
}
