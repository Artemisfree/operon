import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { parseBody } from '../../common/validation.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { ProductsService } from './products.service.js';
import {
  createProductSchema,
  updateProductSchema,
} from './products.schemas.js';

@UseGuards(AdminAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService)
    private readonly productsService: ProductsService,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.productsService.create(parseBody(createProductSchema, body));
  }

  @Get()
  async findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.productsService.update(id, parseBody(updateProductSchema, body));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
