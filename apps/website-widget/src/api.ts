export type WidgetMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'operator' | 'system';
  content: string;
  createdAt: string;
};

export type ChatResponse = {
  conversation_id: string;
  reply: string;
  handoff_state: 'ai' | 'operator';
};

export function normalizeApiBaseUrl(input?: string) {
  const fallback = 'http://localhost:3000/api';
  const value = (input || fallback).trim();
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export async function postChatMessage(payload: {
  conversationId?: string;
  text: string;
  customerName?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_id: payload.conversationId,
      text: payload.text,
      customer_meta: payload.customerName
        ? {
            name: payload.customerName,
          }
        : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Widget request failed with status ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<{ handoff_state: 'ai' | 'operator'; messages: WidgetMessage[] }> {
  const response = await fetch(
    `${API_BASE_URL}/chat/conversations/${conversationId}/messages`,
  );

  if (!response.ok) {
    throw new Error(`Messages request failed with status ${response.status}`);
  }

  return (await response.json()) as {
    handoff_state: 'ai' | 'operator';
    messages: WidgetMessage[];
  };
}
