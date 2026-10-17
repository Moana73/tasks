// ローカル優先ストア
// - 表示データは localStorage にキャッシュ → 2回目以降は通信を待たずに一覧が出る
// - 変更は outbox に積んでから送信 → 圏外やログイン前に書いたメモも消えない
// - サーバーとの競合は updatedAt による Last-Write-Wins
import { api, HttpError } from './api';
import type { Status, Task, User } from './types';

type Op = { kind: 'put'; task: Task } | { kind: 'del'; id: string; ts: number };

export interface State {
  user: User | null;
  /** 一覧を描画してよいか（false の間は全画面スケルトン） */
  ready: boolean;
  tasks: Task[];
  offline: boolean;
}

const K = { user: 'gt.v1.user', tasks: 'gt.v1.tasks', outbox: 'gt.v1.outbox', owner: 'gt.v1.owner' } as const;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* プライベートモード等では保存しない */
  }
}

const cachedUser = read<User | null>(K.user, null);
let state: State = {
  user: cachedUser,
  ready: cachedUser !== null,
  tasks: read<Task[]>(K.tasks, []),
  offline: false,
};
let outbox: Op[] = read<Op[]>(K.outbox, []);
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if ('tasks' in patch) write(K.tasks, state.tasks);
  if ('user' in patch) write(K.user, state.user);
  listeners.forEach((l) => l());
}

function enqueue(op: Op) {
  const id = op.kind === 'put' ? op.task.id : op.id;
  outbox = outbox.filter((o) => (o.kind === 'put' ? o.task.id : o.id) !== id);
  outbox.push(op);
  write(K.outbox, outbox);
}

const byCreatedDesc = (a: Task, b: Task) => b.createdAt - a.createdAt;

function merge(server: Task[]): Task[] {
  const pendingPut = new Map<string, Task>();
  const pendingDel = new Set<string>();
  for (const o of outbox) {
    if (o.kind === 'put') pendingPut.set(o.task.id, o.task);
    else pendingDel.add(o.id);
  }
  const out = new Map<string, Task>();
  for (const t of server) if (!pendingDel.has(t.id)) out.set(t.id, t);
  for (const [id, t] of pendingPut) out.set(id, t);
  return [...out.values()].sort(byCreatedDesc);
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let lastTs = 0;
const now = () => (lastTs = Math.max(Date.now(), lastTs + 1));

let running: Promise<void> | null = null;
let again = false;
let againFull = false;

async function flush() {
  while (outbox.length) {
    const op = outbox[0]!;
    try {
      if (op.kind === 'put') await api.put(op.task);
      else await api.del(op.id, op.ts);
    } catch (e) {
      // 4xx（401 以外）は再送しても通らないので破棄、それ以外は後で再送
      if (!(e instanceof HttpError) || e.status === 401 || e.status >= 500) throw e;
    }
    // 送信中に同じタスクの新しい変更が積まれていることがあるので、送った op だけを取り除く
    outbox = outbox.filter((o) => o !== op);
    write(K.outbox, outbox);
  }
}

function handleSyncError(e: unknown) {
  if (e instanceof HttpError && e.status === 401) set({ user: null, ready: true });
  else set({ offline: true, ready: true });
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** 起動時：セッション確認 → 未送信分を送る → 最新を取得 */
  async boot() {
    try {
      const { user } = await api.me();
      const owner = read<string | null>(K.owner, null);
      if (owner && owner !== user.id) {
        // 別アカウントでログインし直した：前のユーザーのローカルデータは持ち込まない
        outbox = [];
        write(K.outbox, outbox);
        set({ tasks: [] });
      }
      write(K.owner, user.id);
      set({ user });
      await store.sync(true);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) set({ user: null, ready: true });
      else set({ offline: true, ready: true });
    }
  },

  /** full=false は送信のみ、true は送信後にサーバーの最新も取り込む */
  sync(full = false): Promise<void> {
    if (!state.user) return Promise.resolve();
    if (running) {
      again = true;
      againFull ||= full;
      return running;
    }
    running = (async () => {
      let doFull = full;
      do {
        again = false;
        await flush();
        if (doFull) {
          const { tasks } = await api.tasks();
          set({ tasks: merge(tasks), offline: false, ready: true });
        } else if (state.offline) {
          set({ offline: false });
        }
        doFull = againFull;
        againFull = false;
      } while (again);
    })()
      .catch(handleSyncError)
      .finally(() => {
        running = null;
        if (!state.ready) set({ ready: true });
      });
    return running;
  },

  add(title: string, status: Status = 'todo'): Task {
    const ts = now();
    const task: Task = { id: uuid(), title: title.trim(), note: '', status, createdAt: ts, updatedAt: ts };
    set({ tasks: [task, ...state.tasks] });
    enqueue({ kind: 'put', task });
    void store.sync();
    return task;
  },

  update(id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'status'>>) {
    const cur = state.tasks.find((t) => t.id === id);
    if (!cur) return;
    const next: Task = { ...cur, ...patch, updatedAt: now() };
    if (!next.title.trim()) next.title = cur.title;
    set({ tasks: state.tasks.map((t) => (t.id === id ? next : t)) });
    enqueue({ kind: 'put', task: next });
    void store.sync();
  },

  remove(id: string): Task | undefined {
    const cur = state.tasks.find((t) => t.id === id);
    if (!cur) return undefined;
    set({ tasks: state.tasks.filter((t) => t.id !== id) });
    enqueue({ kind: 'del', id, ts: now() });
    void store.sync();
    return cur;
  },

  /** 削除の取り消し */
  restore(task: Task) {
    const restored = { ...task, updatedAt: now() };
    set({ tasks: [...state.tasks.filter((t) => t.id !== task.id), restored].sort(byCreatedDesc) });
    enqueue({ kind: 'put', task: restored });
    void store.sync();
  },

  async logout() {
    try {
      await api.logout();
    } catch {
      /* 圏外でもローカルは消す */
    }
    outbox = [];
    for (const k of Object.values(K)) write(k, null);
    set({ user: null, tasks: [], ready: true });
  },
};
