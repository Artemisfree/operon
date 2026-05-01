import { normalizeAdminApiBaseUrl } from './api';
import type {
  BehaviorDefinition,
  BehaviorProfileDetail,
  BehaviorProfileListItem,
  BehaviorPreview,
  BehaviorVersionRecord,
} from './behaviorTypes';

const API_BASE_URL = normalizeAdminApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

async function adminRequest<T>(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as {
        message?: string | string[];
      };
      if (typeof payload.message === 'string') {
        message = payload.message;
      } else if (Array.isArray(payload.message)) {
        message = payload.message.join(', ');
      }
    } catch {
      // ignore parse failure and keep generic message
    }

    if (response.status === 401) {
      message = 'Сессия истекла или токен невалиден. Войдите заново.';
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function listBehaviorProfiles(token: string) {
  return adminRequest<BehaviorProfileListItem[]>('/admin/ai-behaviors', token);
}

export async function getBehaviorProfile(token: string, profileId: string) {
  return adminRequest<BehaviorProfileDetail>(`/admin/ai-behaviors/${profileId}`, token);
}

export async function createBehaviorProfile(
  token: string,
  payload: {
    name: string;
    description?: string;
    templateId?: 'default' | 'concise' | 'handoff-first';
  },
) {
  return adminRequest<BehaviorProfileDetail>('/admin/ai-behaviors', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function saveBehaviorDraft(
  token: string,
  profileId: string,
  payload: {
    name?: string;
    description?: string | null;
    definition: BehaviorDefinition;
  },
) {
  return adminRequest<BehaviorProfileDetail>(
    `/admin/ai-behaviors/${profileId}/draft`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
}

export async function previewBehaviorDraft(
  token: string,
  profileId: string,
  definition: BehaviorDefinition,
) {
  return adminRequest<BehaviorPreview>(
    `/admin/ai-behaviors/${profileId}/preview`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ definition }),
    },
  );
}

export async function publishBehaviorProfile(token: string, profileId: string) {
  return adminRequest<BehaviorProfileDetail>(
    `/admin/ai-behaviors/${profileId}/publish`,
    token,
    {
      method: 'POST',
    },
  );
}

export async function listBehaviorVersions(token: string, profileId: string) {
  return adminRequest<BehaviorVersionRecord[]>(
    `/admin/ai-behaviors/${profileId}/versions`,
    token,
  );
}
