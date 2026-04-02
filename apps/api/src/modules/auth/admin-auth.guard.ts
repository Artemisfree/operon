import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';

type RequestWithAdmin = Request & {
  headers: Record<string, string | string[] | undefined>;
  admin?: {
    id: string;
    email: string;
    role: string;
  };
};

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    const payload = this.authService.verifyToken(token);
    request.admin = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }
}
