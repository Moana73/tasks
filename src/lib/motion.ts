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
