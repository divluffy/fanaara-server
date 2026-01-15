// src\auth\dto\signup.dto.ts
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'صيغة البريد الإلكتروني غير صحيحة' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'لازم تحتوي على حروف وأرقام',
  })
  password: string;

  @IsBoolean({ message: 'agree يجب أن تكون true/false' })
  agree: boolean;
}
