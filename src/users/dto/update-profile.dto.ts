// src/users/dto/update-profile.dto.ts
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NA = 'NA',
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/)
  username?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsUrl()
  avatar?: string;
}
