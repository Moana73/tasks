// デモ版（Claude 内のアーティファクト用）の API。
// バックエンドの代わりにブラウザ内で同じ振る舞いをする：ログインはボタン一つ、データは端末内、AI は簡易分割。
import type { Task, User } from './types';
import { mockTasks } from '../../worker/ai';

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

const K_SERVER = 'gt.demo.server';
const K_LOGGED = 'gt.demo.loggedIn';
const USER: User = { id: 'demo', email: 'demo@example.com', name: 'デモ', picture: '' };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function get<T>(k: string, fb: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
}
function put(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

let memLogged = get<boolean>(K_LOGGED, true);
let server: Task[] = get<Task[] | null>(K_SERVER, null) ?? seed();

function seed(): Task[] {
  const now = Date.now();
  const mk = (title: string, status: Task['status'], minAgo: number, note = ''): Task => ({
    id: crypto.randomUUID(),
    title,
    note,
    status,
    createdAt: now - minAgo * 60000,
    updatedAt: now - minAgo * 60000,
  });
  const list = [
    mk('（例）歯医者の予約を取る', 'todo', 4),
    mk('（例）企画書のドラフトを書いて部長に送る', 'doing', 50, '金曜の定例までに'),
    mk('（例）牛乳とパンを買う', 'todo', 130),
    mk('（例）ジムに行く', 'done', 600),
  ];
  put(K_SERVER, list);
  return list;
}

const save = () => put(K_SERVER, server);

export const demo = {
  login() {
    memLogged = true;
    put(K_LOGGED, true);
  },
};

export const api = {
  async me() {
    await wait(650); // スケルトンが見えるよう、本番の通信に近い待ち時間
    if (!memLogged) throw new HttpError(401);
    return { user: USER };
  },
  async tasks() {
    await wait(120);
    if (!memLogged) throw new HttpError(401);
    return { tasks: server.slice().sort((a, b) => b.createdAt - a.createdAt) };
  },
  async put(t: Task) {
    await wait(60);
    const i = server.findIndex((x) => x.id === t.id);
    if (i < 0) server = [t, ...server];
    else if (t.updatedAt >= server[i]!.updatedAt) server[i] = t;
    save();
    return { ok: true as const };
  },
  async del(id: string) {
    await wait(60);
    server = server.filter((x) => x.id !== id);
    save();
    return { ok: true as const };
  },
  async ai(text: string, mode: 'split' | 'breakdown') {
    await wait(1100);
    return { titles: mockTasks(text, mode) };
  },
  async logout() {
    memLogged = false;
    put(K_LOGGED, false);
    return { ok: true as const };
  },
};
