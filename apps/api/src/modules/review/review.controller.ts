import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { parseBody } from '../../common/validation.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { ReviewService } from './review.service.js';

const scheduleBodySchema = z.object({
  orderId: z.string().uuid(),
});

@Controller('review')
@UseGuards(AdminAuthGuard)
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly reviewService: ReviewService) {}

  @Post('schedule')
  async schedule(@Body() body: unknown) {
    const parsed = parseBody(scheduleBodySchema, body);
    return this.reviewService.scheduleReviewForOrderOrThrow(parsed.orderId);
  }

  /** Process due review rows (same as the cron worker). */
  @Post('send')
  async send() {
    return this.reviewService.processDueReviews();
  }
}
