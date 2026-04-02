import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { parseBody } from '../../common/validation.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { OrdersService } from './orders.service.js';
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from './orders.schemas.js';

type AdminRequest = Request & {
  admin?: {
    id: string;
    email: string;
  };
};

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.ordersService.create(parseBody(createOrderSchema, body));
  }

  @UseGuards(AdminAuthGuard)
  @Get()
  async findAll() {
    return this.ordersService.findAll();
  }

  @UseGuards(AdminAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @UseGuards(AdminAuthGuard)
  @Post(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ) {
    const input = parseBody(updateOrderStatusSchema, body);
    return this.ordersService.updateStatus(
      id,
      input,
      request.admin?.email ?? 'admin',
    );
  }
}
