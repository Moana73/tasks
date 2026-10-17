// フロントエンドのビルド（esbuild）
// - JS はハッシュ付きファイル名で出力（長期キャッシュ）
// - CSS は index.html にインライン化：JS より先にスケルトンと入力欄が描画され「開いた瞬間メモ」できる
// - Service Worker にはビルドごとのバージョンとプリキャッシュ一覧を埋め込む
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, basename } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const prod = process.env.NODE_ENV !== 'development';

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'assets'), { recursive: true });

const result = await build({
  entryPoints: { app: join(root, 'src', 'main.tsx') },
  bundle: true,
  format: 'esm',
  splitting: false,
  target: ['safari16.4', 'chrome115'],
  outdir: join(dist, 'assets'),
  entryNames: '[name]-[hash]',
  minify: prod,
  sourcemap: false,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development') },
  metafile: true,
  logLevel: 'warning',
});

const jsFile = Object.keys(result.metafile.outputs).find((f) => f.endsWith('.js'));
const jsName = basename(jsFile);

const cssSrc = await readFile(join(root, 'src', 'styles.css'), 'utf8');
const css = (
  await build({ stdin: { contents: cssSrc, loader: 'css' }, minify: prod, write: false, target: ['safari16.4'] })
).outputFiles[0].text;

const template = await readFile(join(root, 'src', 'index.html'), 'utf8');
const html = template.replace('/*__INLINE_CSS__*/', css).replaceAll('%APP_JS%', `/assets/${jsName}`);
await writeFile(join(dist, 'index.html'), html);

// public/ をコピー（manifest・アイコン）
if (!existsSync(join(root, 'public', 'icons', 'icon-512.png'))) {
  await import('./icons.mjs');
}
await cp(join(root, 'public'), dist, { recursive: true });

// Service Worker
const version = createHash('sha256').update(html).update(await readFile(join(dist, 'assets', jsName))).digest('hex').slice(0, 12);
const icons = (await readdir(join(dist, 'icons'))).map((f) => `/icons/${f}`);
const precache = ['/', `/assets/${jsName}`, '/manifest.webmanifest', ...icons];
const sw = (await readFile(join(root, 'src', 'sw.js'), 'utf8'))
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache));
await writeFile(join(dist, 'sw.js'), sw);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`built: assets/${jsName} (${kb(result.metafile.outputs[jsFile].bytes)}), inline css ${kb(css.length)}, sw ${version}`);
