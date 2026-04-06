import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { CouriersService } from './couriers.service.js';

@Controller('couriers')
export class CouriersController {
  constructor(
    @Inject(CouriersService)
    private readonly couriersService: CouriersService,
  ) {}

  @UseGuards(AdminAuthGuard)
  @Get()
  async findAll() {
    return this.couriersService.findAll();
  }
}
