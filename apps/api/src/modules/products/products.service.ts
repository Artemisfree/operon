import { Injectable, NotFoundException } from '@nestjs/common';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { serializeValue } from '../../common/serialization.js';
import { PrismaService } from '../db/prisma.service.js';
import type {
  CreateProductInput,
  UpdateProductInput,
} from './products.schemas.js';

@Injectable()
export class ProductsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateProductInput) {
    try {
      const product = await this.prisma.product.create({
        data: {
          name: input.name,
          description: input.description,
          price: new Prisma.Decimal(input.price),
          currency: input.currency.toUpperCase(),
          isActive: input.isActive ?? true,
        },
      });

      return serializeValue(product);
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async findAll() {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return serializeValue(products);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return serializeValue(product);
  }

  async update(id: string, input: UpdateProductInput) {
    await this.ensureExists(id);

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.price !== undefined
            ? { price: new Prisma.Decimal(input.price) }
            : {}),
          ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });

      return serializeValue(product);
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }

    return { success: true };
  }

  private async ensureExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  private handlePrismaError(error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Product with this name already exists');
    }

    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException('Product is used in existing orders');
    }
  }
}
