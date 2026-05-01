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
import {
  createBehaviorProfileSchema,
  previewBehaviorSchema,
  updateBehaviorDraftSchema,
} from './chat-behavior.schemas.js';
import { ChatBehaviorService } from './chat-behavior.service.js';

type AdminRequest = Request & {
  admin?: {
    email: string;
  };
};

@UseGuards(AdminAuthGuard)
@Controller('admin/ai-behaviors')
export class ChatBehaviorController {
  constructor(
    @Inject(ChatBehaviorService)
    private readonly chatBehaviorService: ChatBehaviorService,
  ) {}

  @Get()
  async listProfiles() {
    return this.chatBehaviorService.listProfiles();
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.chatBehaviorService.getProfile(id);
  }

  @Post()
  async createProfile(@Body() body: unknown, @Req() request: AdminRequest) {
    const input = parseBody(createBehaviorProfileSchema, body);
    return this.chatBehaviorService.createProfile(
      input,
      request.admin?.email ?? 'admin',
    );
  }

  @Post(':id/draft')
  async updateDraft(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
  ) {
    const input = parseBody(updateBehaviorDraftSchema, body);
    return this.chatBehaviorService.updateDraft(
      id,
      input,
      request.admin?.email ?? 'admin',
    );
  }

  @Post(':id/preview')
  async preview(@Body() body: unknown) {
    const input = parseBody(previewBehaviorSchema, body);
    return this.chatBehaviorService.preview(input);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @Req() request: AdminRequest) {
    return this.chatBehaviorService.publish(id, request.admin?.email ?? 'admin');
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    return this.chatBehaviorService.listVersions(id);
  }
}
