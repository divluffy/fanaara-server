// src\auth\dto\signup.dto.ts
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { IsNotTempEmail } from 'src/common/email-blocklist/is-not-temp-email.decorator';

export class SignupDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as string),
  )
  @IsEmail({}, { message: 'messages.signup.email.invalid' })
  @IsNotEmpty({ message: 'messages.signup.email.required' })
  @IsNotTempEmail({ message: 'messages.signup.email.temp_not_allowed' })
  email: string;

  @IsString({ message: 'messages.signup.password.string' })
  @IsNotEmpty({ message: 'messages.signup.password.required' })
  @MinLength(8, { message: 'messages.signup.password.min' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'messages.signup.password.pattern',
  })
  password: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true' || value === '1';
    return false;
  })
  @IsBoolean({ message: 'messages.signup.agree.required' })
  agree: boolean;
}
