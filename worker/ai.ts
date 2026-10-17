import type { Env } from './types';

export type AiMode = 'split' | 'breakdown';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_ITEMS = 12;

const PROMPTS: Record<AiMode, string> = {
  split:
    'あなたはタスク整理アシスタントです。ユーザーが音声入力や走り書きで書いたメモを、' +
    '実行可能なタスクに分割してください。各タスクは日本語で、動詞で終わる短い一文（30文字以内）にします。' +
    'メモに書かれていないタスクは作らないでください。挨拶や説明は不要です。',
  breakdown:
    'あなたはタスク分解アシスタントです。与えられたタスクを、今日すぐ着手できる具体的なステップに3〜6個に分解してください。' +
    '各ステップは日本語で、動詞で終わる短い一文（30文字以内）にします。順番は実行順にしてください。',
};

const SCHEMA = {
  type: 'object',
  properties: { tasks: { type: 'array', items: { type: 'string' } } },
  required: ['tasks'],
};

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const t = String(typeof item === 'object' && item && 'title' in item ? (item as { title: unknown }).title : item)
      .replace(/^[\s\-・*•\d.、)）]+/, '')
      .trim()
      .slice(0, 120);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** モデルの出力形式の揺れ（オブジェクト / JSON 文字列 / 箇条書き）を吸収する */
export function extractTasks(raw: unknown): string[] {
  const r = (raw as { response?: unknown })?.response ?? raw;
  if (r && typeof r === 'object') return clean((r as { tasks?: unknown }).tasks);
  if (typeof r === 'string') {
    const m = r.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return clean(JSON.parse(m[0]).tasks);
      } catch {
        /* fallthrough */
      }
    }
    return clean(r.split(/\n+/));
  }
  return [];
}

/** テスト用の決定的な結果（AI_MOCK=true のときのみ） */
export function mockTasks(text: string, mode: AiMode): string[] {
  if (mode === 'breakdown') {
    const base = text.trim().slice(0, 40);
    return [`${base}の準備をする`, `${base}を進める`, `${base}を見直す`];
  }
  return clean(text.split(/[\n、。,，]/));
}

export async function runAi(env: Env, text: string, mode: AiMode): Promise<string[]> {
  if (env.AI_MOCK === 'true') return mockTasks(text, mode);
  if (!env.AI) throw new Error('AI binding is not configured');
  const raw = await env.AI.run(env.AI_MODEL || DEFAULT_MODEL, {
    messages: [
      { role: 'system', content: PROMPTS[mode] },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
    max_tokens: 600,
    temperature: 0.2,
  });
  return extractTasks(raw);
}
