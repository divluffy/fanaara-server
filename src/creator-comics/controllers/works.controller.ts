// src\creator-comics\controllers\works.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreateWorkDto } from '../dto/create-work.dto';
import { WorksService } from '../services/works.service';

@Controller('creator/works')
export class WorksController {
  constructor(private readonly works: WorksService) {}

  @Post()
  async createWork(@Body() dto: CreateWorkDto) {
    // TODO: اربط ownerId من الـ auth (CurrentUser)
    const ownerId = 'dev-user';
    return this.works.createWork(ownerId, dto);
  }

  @Get('my')
  async myWorks() {
    // TODO: replace with auth user id
    const ownerId = 'dev-user';
    return this.works.listMyWorks(ownerId);
  }

  @Delete(':workId')
  async deleteWork(@Param('workId') workId: string) {
    const ownerId = 'dev-user'; // TODO auth
    return this.works.deleteWork(ownerId, workId);
  }
}
