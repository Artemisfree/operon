import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';

import { parseBody } from '../../common/validation.js';
import { ChatService } from './chat.service.js';
import {
  chatMessageSchema,
  messagesQuerySchema,
} from './chat.schemas.js';

@Controller('chat')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post('message')
  async message(@Body() body: unknown) {
    return this.chatService.handleMessage(parseBody(chatMessageSchema, body));
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.chatService.getMessages(
      id,
      parseBody(messagesQuerySchema, query),
    );
  }
}
