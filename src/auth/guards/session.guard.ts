import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from 'src/redis/redis.service';

/**
 * الشكل الوحيد المسموح به لبيانات الجلسة
 * (لا تضع أشياء غير ضرورية هنا)
 */
export type SessionPayload = {
  userId: string;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const sessionId = this.extractSessionId(req);
    if (!sessionId) {
      throw new UnauthorizedException('NO_SESSION_ID');
    }

    const sessionRaw = await this.redis.get(`session:${sessionId}`);
    if (!sessionRaw) {
      throw new UnauthorizedException('SESSION_EXPIRED');
    }

    let payload: SessionPayload;

    try {
      payload = JSON.parse(sessionRaw) as SessionPayload;
    } catch {
      throw new UnauthorizedException('INVALID_SESSION');
    }

    if (!payload.userId) {
      throw new UnauthorizedException('INVALID_SESSION_PAYLOAD');
    }

    /**
     * نُرفق user object (وليس userId فقط)
     * هذا قرار معماري مهم
     */
    req.user = {
      id: payload.userId,
    };

    return true;
  }

  private extractSessionId(req: Request): string | null {
    if (req.cookies?.session_fanaara_id) {
      return req.cookies.session_fanaara_id;
    }

    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }

    return null;
  }
}
