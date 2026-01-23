//  src\users\users.module.ts
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Module } from '@nestjs/common';
import { ModerationModule } from 'src/moderation/moderation.module';

// users.module.ts
@Module({
  imports: [ModerationModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
