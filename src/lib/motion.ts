// アニメーションの共通設定（外部ライブラリなし：Web Animations API と CSS だけで 60fps を狙う）
const linearSpring =
  'linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)';

const supportsLinear = typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)');

export const SPRING = supportsLinear ? linearSpring : 'cubic-bezier(0.34, 1.56, 0.64, 1)';
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const dur = (ms: number) => (reducedMotion() ? 1 : ms);

let hapticLabel: HTMLLabelElement | null = null;

/** 触覚フィードバック。iOS 18 以降の Safari は <input switch> の切り替えで Taptic が鳴る */
export function haptic() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* noop */
  }
  try {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    if (!ios) return;
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.tabIndex = -1;
      input.setAttribute('switch', '');
      hapticLabel.appendChild(input);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch {
    /* noop */
  }
}

export function relTime(ts: number, nowMs = Date.now()): string {
  const d = Math.max(0, nowMs - ts);
  const min = Math.floor(d / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const day = Math.floor(h / 24);
  if (day === 1) return '昨日';
  if (day < 7) return `${day}日前`;
  const dt = new Date(ts);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// ---------------------------------------------------------------------------
// 完了したときに状態アイコンから弾ける光の粒
// ---------------------------------------------------------------------------
const BURST_COLORS = ['#2fb455', '#5ad27a', '#0a7aff', '#6b5cff', '#ffb340', '#3fd5b0'];

export function burst(x: number, y: number) {
  if (reducedMotion() || typeof document === 'undefined') return;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  document.body.appendChild(layer);

  const ring = document.createElement('i');
  ring.className = 'fx-ring';
  layer.appendChild(ring);
  ring.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 },
    ],
    { duration: 620, easing: EASE_OUT, fill: 'forwards' },
  );

  const N = 18;
  let longest = 620;
  for (let i = 0; i < N; i++) {
    const p = document.createElement('i');
    p.className = i % 3 === 0 ? 'fx-dot fx-star' : 'fx-dot';
    p.style.background = BURST_COLORS[i % BURST_COLORS.length]!;
    layer.appendChild(p);
    const angle = (i / N) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 34 + Math.random() * 40;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const d = 560 + Math.random() * 260;
    longest = Math.max(longest, d);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx * 0.8}px,${dy * 0.8}px) scale(1.1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy + 10}px) scale(0)`, opacity: 0 },
      ],
      { duration: d, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' },
    );
  }
  window.setTimeout(() => layer.remove(), longest + 60);
}

// ---------------------------------------------------------------------------
// 入力欄の文字が、追加されたカードのタイトル位置へ飛んでいく
// ---------------------------------------------------------------------------
/** 飛行中のタスク ID（そのカードは登場演出を控えめにし、タイトルを着地まで隠す） */
export const flying = new Set<string>();

export function flyText(from: DOMRect, text: string, id: string) {
  if (reducedMotion() || typeof document === 'undefined') return;
  flying.add(id);
  const ghost = document.createElement('div');
  ghost.className = 'fx-fly';
  ghost.textContent = text;
  ghost.style.left = `${from.left}px`;
  ghost.style.top = `${from.top + 11}px`;
  ghost.style.width = `${from.width}px`;
  document.body.appendChild(ghost);

  const done = (target: HTMLElement | null) => {
    flying.delete(id);
    ghost.remove();
    if (target) {
      target.style.opacity = '';
      target.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 160 });
    }
  };

  // カードが描画されるのを 2 フレーム待ってから着地点を測る
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"] .task-title`);
      if (!target) return done(null);
      target.style.opacity = '0';
      const to = target.getBoundingClientRect();
      const dx = to.left - from.left;
      const dy = to.top - (from.top + 11);
      const s = 16 / 17;
      const a = ghost.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1, filter: 'blur(0)' },
          { transform: `translate(${dx * 0.55}px,${dy * 0.5 - 18}px) scale(1.04)`, opacity: 1, filter: 'blur(.4px)', offset: 0.45 },
          { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 1, filter: 'blur(0)' },
        ],
        { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' },
      );
      a.onfinish = () => done(target);
      a.oncancel = () => done(target);
    }),
  );
}
