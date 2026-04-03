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
import { ChatService } from './chat.service.js';
import { handoffSchema, operatorMessageSchema } from './chat.schemas.js';

type AdminRequest = Request & {
  admin?: {
    email: string;
  };
};

@UseGuards(AdminAuthGuard)
@Controller('admin/conversations')
export class ChatAdminController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Get()
  async listConversations() {
    return this.chatService.listConversations();
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversationDetails(id);
  }

  @Post(':id/messages')
  async postOperatorMessage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ) {
    const input = parseBody(operatorMessageSchema, body);
    return this.chatService.postOperatorMessage(
      id,
      input,
      request.admin?.email ?? 'operator',
    );
  }

  @Post(':id/handoff/start')
  async startHandoff(@Param('id') id: string) {
    return this.chatService.startHandoff(id);
  }

  @Post(':id/handoff/stop')
  async stopHandoff(@Param('id') id: string) {
    return this.chatService.stopHandoff(id);
  }
}
