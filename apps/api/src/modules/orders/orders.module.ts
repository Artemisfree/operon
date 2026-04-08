import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ReviewModule } from '../review/review.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, ReviewModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
