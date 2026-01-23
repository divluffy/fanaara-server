// src/auth/guards/session.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from 'src/redis/redis.service';
import { SESSION_COOKIE, sessionKey } from '../auth.constants';

type AuthedRequest = Request & { user?: { id: string }; sessionId?: string };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const sessionId = this.extractSessionId(req);

    if (!sessionId) {
      throw new UnauthorizedException('NO_SESSION_ID');
    }

    const userId = await this.redis.get(sessionKey(sessionId));
    if (!userId) {
      throw new UnauthorizedException('SESSION_EXPIRED');
    }

    req.user = { id: userId };
    req.sessionId = sessionId;

    return true;
  }

  private extractSessionId(req: Request): string | null {
    const cookieSid = req.cookies?.[SESSION_COOKIE];
    if (cookieSid) return String(cookieSid);

    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);

    return null;
  }
}
