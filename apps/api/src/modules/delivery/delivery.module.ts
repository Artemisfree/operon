import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CourierAuthGuard } from '../auth/courier-auth.guard.js';
import { CouriersController } from './couriers.controller.js';
import { CouriersService } from './couriers.service.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DeliveryController, CouriersController],
  providers: [DeliveryService, CouriersService, CourierAuthGuard],
})
export class DeliveryModule {}
