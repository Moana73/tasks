// 本番では Cloudflare が D1 / Workers AI / Assets の実体を注入する。
// ここでは使うメソッドだけを構造的に定義しておき、ローカルのテスト用シム（scripts/local-server.mjs）も同じ形を満たす。

export interface D1Result<T = unknown> {
  results: T[];
  meta?: { changes?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  AI?: AiBinding;
  ASSETS: AssetsBinding;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET?: string;
  AI_MODEL?: string;
  /** ログインを許可するメールアドレス（カンマ区切り）。未設定なら Google でログインできる人は全員可 */
  ALLOWED_EMAILS?: string;
  /** ローカルのテスト専用。"true" かつ localhost のときだけ /auth/dev-login が有効 */
  DEV_LOGIN?: string;
  /** ローカルのテスト専用。"true" なら Workers AI を呼ばず決定的な結果を返す */
  AI_MOCK?: string;
}

export type Status = 'todo' | 'doing' | 'done';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}
