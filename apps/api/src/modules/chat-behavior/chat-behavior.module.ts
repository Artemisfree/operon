import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ChatBehaviorController } from './chat-behavior.controller.js';
import { ChatBehaviorService } from './chat-behavior.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ChatBehaviorController],
  providers: [ChatBehaviorService],
  exports: [ChatBehaviorService],
})
export class ChatBehaviorModule {}
