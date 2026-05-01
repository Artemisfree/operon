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

async function adminRequest<T>(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type OrderRecord = {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  comment: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: { id: string; name: string };
  }>;
  statusHistory: Array<{
    id: string;
    status: string;
    note: string | null;
    changedBy: string | null;
    createdAt: string;
  }>;
  deliveryJob: null | {
    id: string;
    courierId: string;
    assignedAt: string;
    deliveredAt: string | null;
    courier: {
      id: string;
      displayName: string;
      phone: string | null;
    };
  };
};

export type CourierRecord = {
  id: string;
  displayName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listOrders(token: string) {
  return adminRequest<OrderRecord[]>('/orders', token);
}

export async function getOrder(token: string, orderId: string) {
  return adminRequest<OrderRecord>(`/orders/${orderId}`, token);
}

export async function updateOrderStatus(
  token: string,
  orderId: string,
  status: string,
  note?: string,
) {
  return adminRequest<OrderRecord>(`/orders/${orderId}/status`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, note }),
  });
}

export async function listCouriers(token: string) {
  return adminRequest<CourierRecord[]>('/couriers', token);
}

export async function assignDelivery(
  token: string,
  orderId: string,
  courierId: string,
) {
  return adminRequest<{ deliveryJob: { id: string; order: OrderRecord } }>(
    '/delivery/assign',
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, courierId }),
    },
  );
}

export type MetricsSnapshot = {
  ordersTotal: number;
  ordersDelivered: number;
  deliveredPct: number;
  conversationsTotal: number;
  conversationsWithOperatorReply: number;
  handoffPct: number;
  reviewRequestsSent: number;
};

export async function getMetrics(token: string) {
  return adminRequest<MetricsSnapshot>('/admin/metrics', token);
}
