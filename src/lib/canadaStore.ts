// カナダワーホリ準備チェックリストのローカル優先ストア。
// 項目の文言は canadaChecklist.ts の静的データ、チェック状態だけをサーバーと同期する。
// 仕組みは ./store.ts（タスク本体）と同じ：localStorage キャッシュ → 送信キュー → updatedAt で Last-Write-Wins。
import { api, HttpError } from './api';
import type { User } from './types';
import { DEFAULT_CHECKED } from './canadaChecklist';

type Check = { checked: boolean; updatedAt: number };
type Op = { id: string; checked: boolean; ts: number };

export interface CanadaState {
  user: User | null;
  ready: boolean;
  checks: Record<string, Check>;
  offline: boolean;
}

const K = { user: 'gt.v1.ca.user', checks: 'gt.v1.ca.checks', outbox: 'gt.v1.ca.outbox' } as const;

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

let state: CanadaState = {
  user: read<User | null>(K.user, null),
  ready: false,
  checks: read<Record<string, Check>>(K.checks, {}),
  offline: false,
};
let outbox: Op[] = read<Op[]>(K.outbox, []);
const listeners = new Set<() => void>();

function set(patch: Partial<CanadaState>) {
  state = { ...state, ...patch };
  if ('checks' in patch) write(K.checks, state.checks);
  if ('user' in patch) write(K.user, state.user);
  listeners.forEach((l) => l());
}

function enqueue(op: Op) {
  outbox = outbox.filter((o) => o.id !== op.id);
  outbox.push(op);
  write(K.outbox, outbox);
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
      await api.checklistPut(op.id, op.checked, op.ts);
    } catch (e) {
      if (!(e instanceof HttpError) || e.status === 401 || e.status >= 500) throw e;
    }
    outbox = outbox.filter((o) => o !== op);
    write(K.outbox, outbox);
  }
}

function merge(server: Record<string, Check>): Record<string, Check> {
  const out: Record<string, Check> = { ...server };
  for (const op of outbox) out[op.id] = { checked: op.checked, updatedAt: op.ts };
  return out;
}

function handleSyncError(e: unknown) {
  if (e instanceof HttpError && e.status === 401) set({ user: null, ready: true });
  else set({ offline: true, ready: true });
}

export const canadaStore = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  isChecked(id: string): boolean {
    return state.checks[id]?.checked ?? DEFAULT_CHECKED[id] ?? false;
  },

  async boot() {
    try {
      const { user } = await api.me();
      set({ user });
      await canadaStore.sync(true);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) set({ user: null, ready: true });
      else set({ offline: true, ready: true });
    }
  },

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
          const { checks } = await api.checklist();
          set({ checks: merge(checks), offline: false, ready: true });
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

  toggle(id: string) {
    const next = !canadaStore.isChecked(id);
    const ts = now();
    set({ checks: { ...state.checks, [id]: { checked: next, updatedAt: ts } } });
    enqueue({ id, checked: next, ts });
    void canadaStore.sync();
  },

  async logout() {
    try {
      await api.logout();
    } catch {
      /* 圏外でもローカルは消す */
    }
    outbox = [];
    for (const k of Object.values(K)) write(k, null);
    set({ user: null, checks: {}, ready: true });
  },
};
