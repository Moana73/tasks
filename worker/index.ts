import type { Env, Status, User } from './types';
import { currentUser, handleAuth } from './auth';
import { runAi, type AiMode } from './ai';
import { json } from './http';

const STATUSES: ReadonlySet<string> = new Set<Status>(['todo', 'doing', 'done']);
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const CHECKLIST_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

interface TaskRow {
  id: string;
  title: string;
  note: string;
  status: Status;
  created_at: number;
  updated_at: number;
}

interface ChecklistRow {
  item_id: string;
  checked: number;
  note: string;
  updated_at: number;
}

const toTask = (r: TaskRow) => ({
  id: r.id,
  title: r.title,
  note: r.note,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isTs(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e14;
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  // 書き込み系はカスタムヘッダー必須（クロスサイトからは CORS プリフライトなしに付けられない＝CSRF 対策）
  if (req.method !== 'GET' && req.headers.get('x-gt') !== '1') {
    return json({ error: 'forbidden' }, 403);
  }

  const user = await currentUser(req, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const path = url.pathname;

  if (path === '/api/me' && req.method === 'GET') return json({ user });

  if (path === '/api/tasks' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, title, note, status, created_at, updated_at FROM tasks
       WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 2000`,
    )
      .bind(user.id)
      .all<TaskRow>();
    return json({ tasks: results.map(toTask) });
  }

  const m = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1] ?? '');
    if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    if (req.method === 'PUT') return putTask(req, env, user, id);
    if (req.method === 'DELETE') return deleteTask(req, env, user, id);
  }

  if (path === '/api/checklist' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT item_id, checked, note, updated_at FROM checklist_checks WHERE user_id = ?')
      .bind(user.id)
      .all<ChecklistRow>();
    const checks: Record<string, { checked: boolean; note: string; updatedAt: number }> = {};
    for (const r of results) checks[r.item_id] = { checked: !!r.checked, note: r.note ?? '', updatedAt: r.updated_at };
    return json({ checks });
  }

  const cm = path.match(/^\/api\/checklist\/([^/]+)$/);
  if (cm && req.method === 'PUT') {
    const id = decodeURIComponent(cm[1] ?? '');
    if (!CHECKLIST_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    return putChecklistItem(req, env, user, id);
  }

  if (path === '/api/ai/tasks' && req.method === 'POST') {
    const body = await readJson(req);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const mode: AiMode = body?.mode === 'breakdown' ? 'breakdown' : 'split';
    if (!text) return json({ error: 'empty' }, 400);
    if (text.length > 2000) return json({ error: 'too_long' }, 413);
    try {
      const titles = await runAi(env, text, mode);
      return json({ titles });
    } catch (e) {
      console.error('ai_failed', e);
      return json({ error: 'ai_failed' }, 502);
    }
  }

  return json({ error: 'not_found' }, 404);
}

async function putTask(req: Request, env: Env, user: User, id: string): Promise<Response> {
  const body = await readJson(req);
  if (!body) return json({ error: 'bad_json' }, 400);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : '';
  const note = typeof body.note === 'string' ? body.note.slice(0, 5000) : '';
  const status = String(body.status);
  if (!title || !STATUSES.has(status) || !isTs(body.createdAt) || !isTs(body.updatedAt)) {
    return json({ error: 'invalid' }, 400);
  }
  // 他人の ID は上書きしない（WHERE user_id）＋ 新しい更新だけ反映（Last-Write-Wins）
  const res = await env.DB.prepare(
    `INSERT INTO tasks (id, user_id, title, note, status, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, note = excluded.note, status = excluded.status,
       updated_at = excluded.updated_at, deleted_at = NULL
     WHERE tasks.user_id = excluded.user_id AND excluded.updated_at >= tasks.updated_at`,
  )
    .bind(id, user.id, title, note, status, body.createdAt, body.updatedAt)
    .run();
  const applied = (res.meta?.changes ?? 0) > 0;
  if (!applied) {
    const owner = await env.DB.prepare('SELECT user_id FROM tasks WHERE id = ?').bind(id).first<{ user_id: string }>();
    if (owner && owner.user_id !== user.id) return json({ error: 'forbidden' }, 403);
  }
  return json({ ok: true, applied });
}

async function putChecklistItem(req: Request, env: Env, user: User, id: string): Promise<Response> {
  const body = await readJson(req);
  if (!body || typeof body.checked !== 'boolean' || !isTs(body.updatedAt)) return json({ error: 'invalid' }, 400);
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
  // カナダ準備チェックリストの項目は本人のものしかないので Last-Write-Wins だけでよい（他人の ID と衝突しない）
  await env.DB.prepare(
    `INSERT INTO checklist_checks (user_id, item_id, checked, note, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET
       checked = excluded.checked, note = excluded.note, updated_at = excluded.updated_at
     WHERE excluded.updated_at >= checklist_checks.updated_at`,
  )
    .bind(user.id, id, body.checked ? 1 : 0, note, body.updatedAt)
    .run();
  return json({ ok: true });
}

async function deleteTask(req: Request, env: Env, user: User, id: string): Promise<Response> {
  const tsParam = Number(new URL(req.url).searchParams.get('ts'));
  const ts = isTs(tsParam) ? tsParam : Date.now();
  await env.DB.prepare(
    'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND updated_at <= ?',
  )
    .bind(ts, ts, id, user.id, ts)
    .run();
  return json({ ok: true });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/auth/')) return await handleAuth(req, env, url);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, env, url);
      return await env.ASSETS.fetch(req);
    } catch (e) {
      console.error('unhandled', e);
      return json({ error: 'internal' }, 500);
    }
  },
};
