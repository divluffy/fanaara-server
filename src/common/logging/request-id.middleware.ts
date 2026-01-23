import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    req: Request & { requestId?: string },
    res: Response,
    next: NextFunction,
  ) {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' ? incoming : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}
