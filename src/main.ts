// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.use(cookieParser());
  app.use(helmet());

  // ✅ مهم جدًا: Validation على كل DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // يشيل أي حقول زيادة
      transform: true, // يفعّل @Transform
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API running: http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] fatal:', err);
  process.exit(1);
});
