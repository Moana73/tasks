// ローカル検証用サーバー（E2E テストで使用）
// 本番と同じ worker/index.ts をそのまま読み込み、Cloudflare のバインディングだけを差し替える:
//   DB     → Node 組み込みの SQLite（node:sqlite）で D1 の API を再現
//   ASSETS → dist/ の静的配信（SPA フォールバック付き。wrangler.jsonc の assets 設定と同じ振る舞い）
//   AI     → AI_MOCK=true で決定的な結果（Workers AI 実機はアカウントが必要なため）
// 普段の開発は `npm run dev`（wrangler dev = 本物の workerd ランタイム）を使ってください。
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 8788);
const DB_PATH = process.env.DB_PATH || join(root, '.local', 'dev.sqlite');

await mkdir(join(root, '.local'), { recursive: true });
if (process.env.FRESH_DB === 'true') await rm(DB_PATH, { force: true });

// --- Worker をバンドル ------------------------------------------------------
const workerOut = join(root, '.local', 'worker.mjs');
await build({
  entryPoints: [join(root, 'worker', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: workerOut,
  logLevel: 'warning',
});
const worker = (await import(pathToFileURL(workerOut).href + `?t=${Date.now()}`)).default;

// --- D1 互換シム -------------------------------------------------------------
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
for (const f of (await readdir(join(root, 'migrations'))).filter((f) => f.endsWith('.sql')).sort()) {
  sqlite.exec(await readFile(join(root, 'migrations', f), 'utf8'));
}

const norm = (v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);
function statement(sql, params = []) {
  return {
    bind: (...values) => statement(sql, values.map(norm)),
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params), meta: {} };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...params);
      return { results: [], meta: { changes: Number(r.changes) } };
    },
  };
}
const DB = {
  prepare: (sql) => statement(sql),
  async batch(stmts) {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  },
};

// --- Assets シム -------------------------------------------------------------
const dist = join(root, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = join(dist, p);
    if (!file.startsWith(dist) || !existsSync(file)) file = join(dist, 'index.html'); // SPA フォールバック
    const body = await readFile(file);
    const ext = extname(file);
    const immutable = /-[A-Z0-9]{8}\.(js|css)$/.test(file);
    return new Response(body, {
      headers: {
        'content-type': TYPES[ext] || 'application/octet-stream',
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      },
    });
  },
};

const env = {
  DB,
  ASSETS,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'local-test-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  DEV_LOGIN: process.env.DEV_LOGIN ?? 'true',
  AI_MOCK: process.env.AI_MOCK ?? 'true',
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS ?? '',
};

// --- HTTP サーバー ------------------------------------------------------------
createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const url = `http://${req.headers.host || `localhost:${PORT}`}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else if (v !== undefined) headers.set(k, v);
    }
    const request = new Request(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const r = await worker.fetch(request, env);
    const outHeaders = {};
    r.headers.forEach((v, k) => {
      if (k !== 'set-cookie') outHeaders[k] = v;
    });
    const setCookies = r.headers.getSetCookie?.() ?? [];
    if (setCookies.length) outHeaders['set-cookie'] = setCookies;
    res.writeHead(r.status, outHeaders);
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('local server error');
  }
}).listen(PORT, () => console.log(`glass-tasks local: http://localhost:${PORT}`));
