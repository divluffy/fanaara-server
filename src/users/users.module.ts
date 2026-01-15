import { PrismaService } from 'src/prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Module } from '@nestjs/common';

// users.module.ts
@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
