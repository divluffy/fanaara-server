// src\users\users.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TextModerationService } from 'src/moderation/text/text-moderation.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly textModeration: TextModerationService,
  ) {}

  async checkUsername(username: string) {
    if (!username || username.length < 3) return { available: false };

    const exists = await this.prisma.users.findUnique({
      where: { username },
      select: { id: true },
    });

    return { available: !exists };
  }

  async getByUsername(username: string) {
    return this.prisma.users.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        first_name: true,
        last_name: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.textModeration.assertAllowed([
      {
        text: dto.first_name ?? '',
        context: 'first_name',
        field: 'first_name',
      },
      { text: dto.last_name ?? '', context: 'last_name', field: 'last_name' },
      { text: dto.username ?? '', context: 'username', field: 'username' },
    ]);

    if (dto.username) {
      const exists = await this.prisma.users.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });

      if (exists) throw new BadRequestException('USERNAME_TAKEN');
    }

    return this.prisma.users.update({
      where: { id: userId },
      data: dto,
    });
  }
}
