import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { parseBody } from '../../common/validation.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { CourierAuthGuard } from '../auth/courier-auth.guard.js';
import { DeliveryService } from './delivery.service.js';
import {
  assignDeliverySchema,
  deliveryStatusSchema,
  proofPhotoSchema,
} from './delivery.schemas.js';

type AdminRequest = Request & {
  admin?: {
    id: string;
    email: string;
  };
};

type CourierRequest = Request & {
  courier?: {
    id: string;
    displayName: string;
    phone: string | null;
  };
};

@Controller('delivery')
export class DeliveryController {
  constructor(
    @Inject(DeliveryService)
    private readonly deliveryService: DeliveryService,
  ) {}

  @UseGuards(AdminAuthGuard)
  @Post('assign')
  async assign(@Body() body: unknown, @Req() request: AdminRequest) {
    const input = parseBody(assignDeliverySchema, body);

    return this.deliveryService.assign(
      input,
      request.admin?.email ?? 'admin',
    );
  }

  @UseGuards(CourierAuthGuard)
  @Get('jobs')
  async listJobs(@Req() request: CourierRequest) {
    const courierId = request.courier?.id;

    if (!courierId) {
      throw new InternalServerErrorException('Courier context missing');
    }

    return this.deliveryService.listJobsForCourier(courierId);
  }

  @UseGuards(CourierAuthGuard)
  @Post(':id/status')
  async updateStatus(
    @Param('id') jobId: string,
    @Body() body: unknown,
    @Req() request: CourierRequest,
  ) {
    parseBody(deliveryStatusSchema, body);

    const courierId = request.courier?.id;

    if (!courierId) {
      throw new InternalServerErrorException('Courier context missing');
    }

    return this.deliveryService.markDelivered(
      jobId,
      courierId,
      `courier:${courierId}`,
    );
  }

  @UseGuards(CourierAuthGuard)
  @Post(':id/proof-photo')
  async uploadProof(
    @Param('id') jobId: string,
    @Body() body: unknown,
    @Req() request: CourierRequest,
  ) {
    const input = parseBody(proofPhotoSchema, body);

    const courierId = request.courier?.id;

    if (!courierId) {
      throw new InternalServerErrorException('Courier context missing');
    }

    return this.deliveryService.saveProofPhoto(jobId, courierId, input);
  }
}
