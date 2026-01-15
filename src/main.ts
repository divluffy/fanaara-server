import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

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

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(Number(process.env.PORT ?? 4000));
}

bootstrap();
