// src\auth\auth.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from './auth.constants';
import { SessionGuard } from './guards/session.guard';

type AuthedRequest = Request & { user: { id: string }; sessionId?: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ===== SIGNUP =====
  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, sessionId } = await this.auth.signup(dto);

    res.cookie(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);

    return { user };
  }

  // ===== ME =====
  @UseGuards(SessionGuard)
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    console.log('get me -- auth');

    return this.auth.me(req.user.id);
  }

  // ================= LOGOUT =================
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;

    if (sessionId) {
      await this.auth.logout(sessionId);
    }

    res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS);
    return { ok: true };
  }
}
