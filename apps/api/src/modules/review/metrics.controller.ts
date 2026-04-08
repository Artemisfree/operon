import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { MetricsService } from './metrics.service.js';

@Controller('admin/metrics')
@UseGuards(AdminAuthGuard)
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly metricsService: MetricsService) {}

  @Get()
  async get() {
    return this.metricsService.getSnapshot();
  }
}
