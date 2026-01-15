// src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { SignupDto } from './dto/signup.dto';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ===== SIGNUP =====
  async signup(dto: SignupDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException('Email already used');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: { create: { hash: passwordHash } },
      },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
      },
    });

    const sessionId = randomUUID();

    // حفظ session لكل مستخدم
    await this.redis.set(
      `session:${sessionId}`,
      JSON.stringify({ userId: user.id }),
      SESSION_TTL_SECONDS,
    );

    // إضافة sessionId للقائمة الخاصة بالمستخدم
    const userSessionsKey = `user:${user.id}:sessions`;
    const existing = await this.redis.get(userSessionsKey);
    const sessions = existing ? JSON.parse(existing) : [];
    sessions.push(sessionId);
    await this.redis.set(
      userSessionsKey,
      JSON.stringify(sessions),
      SESSION_TTL_SECONDS,
    );

    return { user, sessionId };
  }

  // ===== ME =====
  async me(sessionId?: string) {
    if (!sessionId) throw new UnauthorizedException();

    const data = await this.redis.get(`session:${sessionId}`);
    if (!data) throw new UnauthorizedException();

    const { userId } = JSON.parse(data);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        first_name: true,
        last_name: true,
        status: true,
      },
    });

    if (!user) throw new UnauthorizedException();

    return { user };
  }

  // ===== LOGOUT =====
  async logout(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`);
    if (!data) return;

    const { userId } = JSON.parse(data);

    // حذف session الحالي
    await this.redis.del(`session:${sessionId}`);

    // إزالة من قائمة الجلسات الخاصة بالمستخدم
    const userSessionsKey = `user:${userId}:sessions`;
    const existing = await this.redis.get(userSessionsKey);
    if (existing) {
      const sessions = JSON.parse(existing).filter(
        (s: string) => s !== sessionId,
      );
      await this.redis.set(
        userSessionsKey,
        JSON.stringify(sessions),
        SESSION_TTL_SECONDS,
      );
    }
  }

  // ===== LOGOUT ALL DEVICES =====
  async logoutAll(userId: string) {
    const userSessionsKey = `user:${userId}:sessions`;
    const existing = await this.redis.get(userSessionsKey);
    if (existing) {
      const sessions: string[] = JSON.parse(existing);
      for (const s of sessions) {
        await this.redis.del(`session:${s}`);
      }
      await this.redis.del(userSessionsKey);
    }
  }
}
