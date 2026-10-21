import type { Task, User } from './types';

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'x-gt': '1', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  if (!res.ok) throw new HttpError(res.status);
  return (await res.json()) as T;
}

export const api = {
  me: () => call<{ user: User }>('/api/me'),
  tasks: () => call<{ tasks: Task[] }>('/api/tasks'),
  put: (t: Task) =>
    call<{ ok: true }>(`/api/tasks/${encodeURIComponent(t.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ title: t.title, note: t.note, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt }),
    }),
  del: (id: string, ts: number) => call<{ ok: true }>(`/api/tasks/${encodeURIComponent(id)}?ts=${ts}`, { method: 'DELETE' }),
  ai: (text: string, mode: 'split' | 'breakdown') =>
    call<{ titles: string[] }>('/api/ai/tasks', { method: 'POST', body: JSON.stringify({ text, mode }) }),
  logout: () => call<{ ok: true }>('/auth/logout', { method: 'POST' }),
  checklist: () => call<{ checks: Record<string, { checked: boolean; note?: string; updatedAt: number }> }>('/api/checklist'),
  checklistPut: (id: string, checked: boolean, note: string, updatedAt: number) =>
    call<{ ok: true }>(`/api/checklist/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ checked, note, updatedAt }),
    }),
};
