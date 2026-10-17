// Claude 内デモ用の API（src/lib/api.ts と同じ形）
// サーバーの代わりにブラウザ内の localStorage を使い、AI は Claude（sample capability）が答える。
import type { Task, User } from '../lib/types';

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

const DB_KEY = 'gt.demo.db';
const AUTH_KEY = 'gt.demo.auth';
const DEMO_USER: User = { id: 'demo:you', email: 'demo@glass-tasks.app', name: 'Demo', picture: '' };

const mem = new Map<string, string>();
function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return mem.get(key) ?? null;
  }
}
function put(key: string, value: string) {
  mem.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* メモリ上だけで動かす */
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function seed(): Task[] {
  const now = Date.now();
  const mk = (title: string, status: Task['status'], ago: number): Task => ({
    id: crypto.randomUUID(),
    title,
    note: '',
    status,
    createdAt: now - ago,
    updatedAt: now - ago,
  });
  return [
    mk('例：週末の旅行の宿を探す', 'todo', 4 * 60e3),
    mk('例：企画書のドラフトを書いて部長に送る', 'doing', 50 * 60e3),
    mk('例：歯医者の予約を取る', 'todo', 3 * 3600e3),
    mk('例：牛乳とパンを買う', 'todo', 26 * 3600e3),
    mk('例：ジムに行く', 'done', 30 * 3600e3),
  ];
}

function load(): Task[] {
  const raw = get(DB_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Task[];
    } catch {
      /* 壊れていたら作り直す */
    }
  }
  const s = seed();
  put(DB_KEY, JSON.stringify(s));
  return s;
}
const save = (tasks: Task[]) => put(DB_KEY, JSON.stringify(tasks));
const authed = () => get(AUTH_KEY) !== '0';
function guard() {
  if (!authed()) throw new HttpError(401);
}

export function demoLogin() {
  put(AUTH_KEY, '1');
}

type Sample = ((input: string, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string, opts?: Record<string, unknown>) => Promise<T>;
};
let samplePromise: Promise<Sample | null> | null = null;
function getSample(): Promise<Sample | null> {
  const c = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  if (!c?.use) return Promise.resolve(null);
  samplePromise ??= c.use('sample').then((s) => (s as Sample) ?? null).catch(() => null);
  return samplePromise;
}

const PROMPTS = {
  split:
    'あなたはタスク整理アシスタントです。次のメモ（音声入力や走り書き）を、実行可能なタスクに分割してください。' +
    '各タスクは日本語で、動詞で終わる短い一文（30文字以内）。メモにないタスクは作らない。\n' +
    '{"tasks": ["...", "..."]} の形の JSON だけを返してください。\n\nメモ:\n',
  breakdown:
    'あなたはタスク分解アシスタントです。次のタスクを、今日すぐ着手できる具体的なステップ3〜6個に分解してください。' +
    '各ステップは日本語で、動詞で終わる短い一文（30文字以内）、実行順に並べる。\n' +
    '{"tasks": ["...", "..."]} の形の JSON だけを返してください。\n\nタスク:\n',
};

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((t) => String(t).replace(/^[\s\-・*•\d.、)）]+/, '').trim().slice(0, 120)).filter(Boolean))].slice(0, 12);
}

/** Claude が使えないとき（Claude の外で開いた等）の簡易分割 */
function fallback(text: string, mode: 'split' | 'breakdown'): string[] {
  if (mode === 'breakdown') {
    const base = text.split('\n')[0]!.replace(/^例：/, '').slice(0, 40);
    return [`${base}の準備をする`, `${base}を進める`, `${base}を見直す`];
  }
  return clean(text.split(/[\n、。,，]/));
}

export const api = {
  async me() {
    await delay(650); // 本番の通信に近い待ち時間（スケルトンが見えるように）
    guard();
    return { user: DEMO_USER };
  },
  async tasks() {
    await delay(120);
    guard();
    return { tasks: load().sort((a, b) => b.createdAt - a.createdAt) };
  },
  async put(t: Task) {
    await delay(60);
    guard();
    const all = load();
    const i = all.findIndex((x) => x.id === t.id);
    if (i < 0) all.push(t);
    else if (t.updatedAt >= all[i]!.updatedAt) all[i] = t;
    save(all);
    return { ok: true as const };
  },
  async del(id: string, ts: number) {
    await delay(60);
    guard();
    save(load().filter((x) => !(x.id === id && x.updatedAt <= ts)));
    return { ok: true as const };
  },
  async ai(text: string, mode: 'split' | 'breakdown') {
    guard();
    const sample = await getSample();
    if (!sample) {
      await delay(900);
      return { titles: fallback(text, mode) };
    }
    const out = await sample.json<{ tasks?: unknown }>(PROMPTS[mode] + text.slice(0, 2000), { modelTier: 'quick' });
    return { titles: clean(out?.tasks) };
  },
  async logout() {
    put(AUTH_KEY, '0');
    return { ok: true as const };
  },
};
