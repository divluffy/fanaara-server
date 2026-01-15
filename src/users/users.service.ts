import { Injectable, BadRequestException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async checkUsername(username: string) {
    if (!username || username.length < 3) {
      return { available: false };
    }

    const exists = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return { available: !exists };
  }

  async getByUsername(username: string) {
    return this.prisma.user.findUnique({
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
    if (dto.username) {
      const exists = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });

      if (exists) {
        throw new BadRequestException('USERNAME_TAKEN');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }
}
