export type ConversationListItem = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  handoffState: 'ai' | 'operator';
  updatedAt: string;
  lastMessage: {
    content: string;
    role: string;
  } | null;
};

export type ConversationDetails = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  handoffState: 'ai' | 'operator';
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
};

export function normalizeAdminApiBaseUrl(input?: string) {
  const fallback = 'http://localhost:3000/api';
  const value = (input || fallback).trim();
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const API_BASE_URL = normalizeAdminApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string) {
  return request<{
    accessToken: string;
  }>('/admin/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
}

export async function listConversations(token: string) {
  return request<ConversationListItem[]>('/admin/conversations', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getConversation(token: string, conversationId: string) {
  return request<ConversationDetails>(`/admin/conversations/${conversationId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function postOperatorMessage(
  token: string,
  conversationId: string,
  text: string,
) {
  return request(`/admin/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
}

export async function startHandoff(token: string, conversationId: string) {
  return request(`/admin/conversations/${conversationId}/handoff/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function stopHandoff(token: string, conversationId: string) {
  return request(`/admin/conversations/${conversationId}/handoff/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
