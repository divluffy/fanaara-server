// src\app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { PrismaService } from './prisma/prisma.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RedisService } from './redis/redis.service';
import { UsersModule } from './users/users.module';
import { OpenAIModule } from './integrations/openai/openai.module';
import { UploadsModule } from './uploads/uploads.module';
import { ModerationModule } from './moderation/moderation.module';
import { ModerationQueuesModule } from './queues/moderation/moderation-queues.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Global Modules and static configurations
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }), // For global .env access
    HealthModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000,
          limit: 3,
        },
        {
          name: 'medium',
          ttl: 10000,
          limit: 20,
        },
        {
          name: 'long',
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    // Application Modules
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    OpenAIModule,
    UploadsModule,
    ModerationModule,
    ScheduleModule.forRoot(),
    ModerationQueuesModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    RedisService,
  ],
})
export class AppModule {}
