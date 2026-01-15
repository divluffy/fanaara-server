import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { SessionGuard } from 'src/auth/guards/session.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 🔎 check username availability
  @Get('check-username')
  checkUsername(@Query('username') username: string) {
    console.log('username: ', username);
    return this.usersService.checkUsername(username);
  }

  // 👤 get user by username
  @Get(':username')
  getByUsername(@Param('username') username: string) {
    return this.usersService.getByUsername(username);
  }

  @UseGuards(SessionGuard)
  @Patch('me')
  updateProfile(@Req() req: Request, @Body() body: UpdateProfileDto) {
    console.log('get me in users');
    // return this.usersService.updateProfile(req.user!.id, body);
  }
}
