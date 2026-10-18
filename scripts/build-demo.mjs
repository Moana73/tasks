// Claude の Artifact で触れる 1 ファイル版デモを作る
// - src/lib/api.ts → src/demo/api.ts（ブラウザ内保存 + Claude による AI）
// - src/lib/auth.ts → src/demo/auth.ts（Google の代わりにデモアカウント）
// - JS と CSS はすべてインライン、Service Worker なし
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, '.local', 'demo');
await mkdir(out, { recursive: true });

const swap = {
  name: 'demo-swap',
  setup(b) {
    const map = {
      [join(root, 'src', 'lib', 'api')]: join(root, 'src', 'demo', 'api.ts'),
      [join(root, 'src', 'lib', 'auth')]: join(root, 'src', 'demo', 'auth.ts'),
    };
    b.onResolve({ filter: /(api|auth)$/ }, (args) => {
      const target = map[join(args.resolveDir, args.path)];
      return target ? { path: target } : undefined;
    });
  },
};

const js = (
  await build({
    entryPoints: [join(root, 'src', 'main.tsx')],
    bundle: true,
    format: 'esm',
    target: ['safari16.4', 'chrome115'],
    minify: true,
    jsx: 'automatic',
    write: false,
    define: { 'process.env.NODE_ENV': '"production"', __DEMO__: 'true' },
    plugins: [swap],
    logLevel: 'warning',
  })
).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const cssSrc = await readFile(join(root, 'src', 'styles.css'), 'utf8');
// Artifact の枠に合わせた上書き：上端の安全領域は枠側が確保するので、固定ヘッダーはその下に止める
const demoCss = `
html, body { background: #fbfbfd; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 30; background: #fbfbfd; }
.top { top: env(safe-area-inset-top, 0px); padding-top: 10px; }
`;
const css = (await build({ stdin: { contents: cssSrc + demoCss, loader: 'css' }, minify: true, write: false, target: ['safari16.4'] }))
  .outputFiles[0].text;

const template = await readFile(join(root, 'src', 'index.html'), 'utf8');
let body = template.match(/<body>([\s\S]*)<\/body>/)[1];
body = body.replace(/<script type="module" src="%APP_JS%"><\/script>/, '');

const svgIcon = await readFile(join(root, 'public', 'icons', 'icon.svg'), 'utf8');
const iconData = `data:image/svg+xml;base64,${Buffer.from(svgIcon).toString('base64')}`;

const html = `<title>tasks</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#ffffff">
<style>${css}</style>
${body.replace(/\/icons\/icon\.svg/g, iconData)}
<script type="module">${js.replace(/\/icons\/icon\.svg/g, iconData)}</script>
`;
await writeFile(join(out, 'tasks.html'), html);
console.log(`demo: ${(html.length / 1024).toFixed(1)} KB → .local/demo/tasks.html`);
