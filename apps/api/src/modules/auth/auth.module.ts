import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminAuthGuard],
  exports: [AuthService, AdminAuthGuard],
})
export class AuthModule {}
