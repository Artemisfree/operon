import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../db/prisma.service.js';
import type { LoginInput } from './auth.schemas.js';

type AdminTokenPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async login(input: LoginInput) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await compare(input.password, admin.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AdminTokenPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const secret = this.configService.getOrThrow<string>('auth.jwtSecret');
    const accessToken = jwt.sign(payload, secret, {
      expiresIn: '12h',
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  verifyToken(token: string): AdminTokenPayload {
    try {
      const secret = this.configService.getOrThrow<string>('auth.jwtSecret');
      return jwt.verify(token, secret) as AdminTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
