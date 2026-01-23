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
import {
  SESSION_TTL_SECONDS,
  sessionKey,
  userSessionsKey,
} from './auth.constants';
import { Prisma } from 'generated/prisma/client';

type SignupUser = Prisma.UsersGetPayload<{
  select: { id: true; email: true; username: true; status: true };
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ===== SIGNUP =====
  async signup(dto: SignupDto) {
    const passwordHash = await argon2.hash(dto.password);

    let user: SignupUser;

    try {
      user = await this.prisma.users.create({
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
    } catch (e) {
      // منع race condition: الاعتماد على unique index في DB
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('messages.signup.email.taken');
      }
      throw e;
    }

    const sessionId = randomUUID();

    const sKey = sessionKey(sessionId);

    const uKey = userSessionsKey(user.id);

    // Atomic + أقل round-trips
    const tx = this.redis.multi();
    tx.set(sKey, user.id, 'EX', SESSION_TTL_SECONDS);
    tx.sadd(uKey, sessionId);
    tx.expire(uKey, SESSION_TTL_SECONDS);
    await tx.exec();

    return { user, sessionId };
  }

  // ===== ME =====
  async me(userId?: string) {
    if (!userId) throw new UnauthorizedException();

    const user = await this.prisma.users.findUnique({
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
    const sKey = sessionKey(sessionId);

    const userId = await this.redis.get(sKey);
    if (!userId) return;

    const uKey = userSessionsKey(userId);

    const tx = this.redis.multi();
    tx.del(sKey);
    tx.srem(uKey, sessionId);
    await tx.exec();
  }

  // ===== LOGOUT ALL DEVICES =====
  async logoutAll(userId: string) {
    const uKey = userSessionsKey(userId);

    const sessions = await this.redis.smembers(uKey);
    if (!sessions?.length) return;

    const pipe = this.redis.pipeline();
    for (const s of sessions) {
      pipe.del(sessionKey(s));
    }
    pipe.del(uKey);
    await pipe.exec();
  }
}
