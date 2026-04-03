export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatLlmMessage = {
  role: ChatMessageRole;
  content: string;
};

export type ChatToolCall = {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatToolResult = {
  toolCallId?: string;
  name: string;
  success: boolean;
  result?: unknown;
  error?: string;
};

export type ChatLlmResponse = {
  reply: string;
  toolCalls: ChatToolCall[];
  model: string;
};

export type ChatLlmRequest = {
  messages: ChatLlmMessage[];
  conversationId: string;
  customerMeta?: Record<string, unknown>;
  toolResults?: ChatToolResult[];
};

export interface ChatLlmClient {
  respond(input: ChatLlmRequest): Promise<ChatLlmResponse>;
  getModel(): string;
}
