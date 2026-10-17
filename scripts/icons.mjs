// アプリアイコンを SVG から生成（白ベースのガラス調タイル＋チェック）
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'public', 'icons');
await mkdir(out, { recursive: true });

const svg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef2fb"/>
    </linearGradient>
    <radialGradient id="b1" cx="0.22" cy="0.2" r="0.6">
      <stop offset="0" stop-color="#9fc3ff" stop-opacity=".75"/><stop offset="1" stop-color="#9fc3ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b2" cx="0.85" cy="0.9" r="0.6">
      <stop offset="0" stop-color="#c8b6ff" stop-opacity=".7"/><stop offset="1" stop-color="#c8b6ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".92"/><stop offset="1" stop-color="#ffffff" stop-opacity=".55"/>
    </linearGradient>
    <linearGradient id="ck" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b8bff"/><stop offset="1" stop-color="#6b5cff"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#b1)"/>
  <rect width="1024" height="1024" fill="url(#b2)"/>
  <g transform="translate(${pad} ${pad}) scale(${(1024 - pad * 2) / 1024})">
    <rect x="212" y="212" width="600" height="600" rx="170" fill="url(#glass)" stroke="#ffffff" stroke-width="10"/>
    <path d="M372 520 L470 616 L660 418" fill="none" stroke="url(#ck)" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const targets = [
  ['icon-180.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['maskable-512.png', 512, 90],
];
for (const [name, size, pad] of targets) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(join(out, name));
}
await writeFile(join(out, 'icon.svg'), svg(0).trim());
console.log('icons generated');
