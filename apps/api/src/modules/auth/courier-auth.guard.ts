import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { compare } from 'bcryptjs';

import { PrismaService } from '../db/prisma.service.js';

type RequestWithCourier = Request & {
  headers: Record<string, string | string[] | undefined>;
  courier?: {
    id: string;
    displayName: string;
    phone: string | null;
  };
};

@Injectable()
export class CourierAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCourier>();
    const rawAuthorization = request.headers.authorization;
    const authorization = Array.isArray(rawAuthorization)
      ? rawAuthorization[0]
      : rawAuthorization;

    if (!authorization) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    const couriers = await this.prisma.courier.findMany({
      where: { isActive: true },
    });

    for (const courier of couriers) {
      const matches = await compare(token, courier.apiTokenHash);

      if (matches) {
        request.courier = {
          id: courier.id,
          displayName: courier.displayName,
          phone: courier.phone,
        };

        return true;
      }
    }

    throw new UnauthorizedException('Invalid courier token');
  }
}
