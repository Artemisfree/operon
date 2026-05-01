export function normalizeApiBaseUrl(input?: string) {
  const fallback = 'http://localhost:3000/api';
  const value = (input || fallback).trim();
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export type CourierJob = {
  id: string;
  hasProofPhoto: boolean;
  assignedAt: string;
  deliveredAt: string | null;
  courier: {
    id: string;
    displayName: string;
    phone: string | null;
  };
  order: {
    id: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    status: string;
    totalAmount: number;
    comment: string | null;
  };
};

async function courierRequest<T>(path: string, token: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listJobs(token: string) {
  return courierRequest<CourierJob[]>('/delivery/jobs', token);
}

export async function markDelivered(token: string, jobId: string) {
  return courierRequest<CourierJob>(`/delivery/${jobId}/status`, token, {
    method: 'POST',
    body: JSON.stringify({ status: 'delivered' }),
  });
}

export async function uploadProof(token: string, jobId: string, imageBase64: string) {
  return courierRequest<CourierJob>(`/delivery/${jobId}/proof-photo`, token, {
    method: 'POST',
    body: JSON.stringify({ imageBase64 }),
  });
}
