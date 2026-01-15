// src\redis\redis.service.ts
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private client = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    },
  );

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

  del(key: string) {
    return this.client.del(key);
  }
}
