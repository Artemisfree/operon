import { Body, Controller, Inject, Post } from '@nestjs/common';

import { parseBody } from '../../common/validation.js';
import { AuthService } from './auth.service.js';
import { loginSchema } from './auth.schemas.js';

@Controller('admin/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: unknown) {
    const input = parseBody(loginSchema, body);
    return this.authService.login(input);
  }
}
