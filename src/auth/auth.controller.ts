// src\auth\auth.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

const SESSION_COOKIE = 'session_fanaara_id';

const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 30,
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ===== SIGNUP =====
  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!dto.email || !dto.password) {
      throw new HttpException('Invalid data', HttpStatus.BAD_REQUEST);
    }

    const { user, sessionId } = await this.auth.signup(dto);

    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());

    return { user };
  }

  // ===== ME =====
  @Get('me')
  async me(@Req() req: Request) {
    console.log("get me in auth");
    
    const sessionId = req.cookies?.[SESSION_COOKIE];
    return this.auth.me(sessionId);
  }

  // ================= LOGOUT =================
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE];

    if (sessionId) {
      await this.auth.logout(sessionId);
    }

    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return { ok: true };
  }
}
