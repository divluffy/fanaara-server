// src\redis\redis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  private readonly client: RedisClient;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      // ✅ تحت ضغط عالي: مهم لتجنب queue لا نهائي أثناء انقطاع الاتصال
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,

      // ✅ يحسن سلوك إعادة الاتصال
      retryStrategy: (times) => {
        // backoff بسيط: 50ms -> 2s
        const delay = Math.min(times * 50, 2000);
        return delay;
      },

      // ✅ لو عندك spikes كبيرة، هذا مفيد. (اختياري لكن عملي)
      lazyConnect: false,
      keepAlive: 10000,

      // ✅ تقليل delay بسبب Nagle في TCP
      noDelay: true,
    });

    // ✅ مراقبة أخطاء الاتصال
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err?.message ?? err}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis reconnecting...');
    });
  }

  get raw() {
    return this.client;
  }

  get(key: string) {
    return this.client.get(key);
  }

  set(key: string, value: string, ttlSeconds?: number) {
    return ttlSeconds
      ? this.client.set(key, value, 'EX', ttlSeconds)
      : this.client.set(key, value);
  }

  expire(key: string, ttlSeconds: number) {
    return this.client.expire(key, ttlSeconds);
  }

  sadd(key: string, ...members: string[]) {
    return this.client.sadd(key, ...members);
  }

  srem(key: string, ...members: string[]) {
    return this.client.srem(key, ...members);
  }

  smembers(key: string) {
    return this.client.smembers(key);
  }

  multi() {
    return this.client.multi();
  }

  pipeline() {
    return this.client.pipeline();
  }

  del(key: string) {
    return this.client.del(key);
  }

  // ==== graceful shutdown ====
  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    } catch {
      // fallback
      this.client.disconnect();
    }
  }
}
