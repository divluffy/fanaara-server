import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.headers['x-correlation-id'];
  const cid =
    typeof incoming === 'string' && incoming.length ? incoming : randomUUID();

  (req as any).correlationId = cid;
  res.setHeader('x-correlation-id', cid);

  next();
}
