import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReviewController, MetricsController],
  providers: [ReviewService, MetricsService],
  exports: [ReviewService],
})
export class ReviewModule {}
