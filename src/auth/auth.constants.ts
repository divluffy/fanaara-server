// src/auth/auth.constants.ts
import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'session_fanaara_id';

// TTL (Time To Live)
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
};

export const sessionKey = (sessionId: string) => `session:${sessionId}`;
export const userSessionsKey = (userId: string) => `user:${userId}:sessions`;
