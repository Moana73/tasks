// 画面全体のジェスチャーと、スクロールに連動する演出
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { haptic, reducedMotion } from './motion';

/** 少しスクロールしたらヘッダーをすりガラス強めに切り替える */
export function useScrolled(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ref.current?.classList.toggle('scrolled', window.scrollY > 6));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [ref]);
}

const TRIGGER = 72; // これ以上引っ張って離すと更新
const MAX = 120;
const HOLD = 58; // 更新中に保つ位置

/** 一番上で下に引っ張ると、ガラスのしずくが伸びて同期する */
export function usePullToRefresh(onRefresh: () => Promise<unknown>, enabled: boolean): { node: ReactNode } {
  const [state, setState] = useState<'idle' | 'pulling' | 'refreshing' | 'settling'>('idle');
  const pull = useRef(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const armed = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const busy = useRef(false);

  const setPull = (v: number) => {
    pull.current = v;
    const root = document.documentElement;
    root.style.setProperty('--pull', `${v}px`);
    root.style.setProperty('--pull-p', String(Math.min(1, v / TRIGGER)));
  };

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (!enabledRef.current || busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('textarea, input, button, .sheet, .composer')) return;
      const touch = e.touches[0]!;
      start.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
      armed.current = false;
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const touch = [...e.touches].find((x) => x.identifier === s.id);
      if (!touch) return;
      const dy = touch.clientY - s.y;
      const dx = touch.clientX - s.x;
      if (pull.current === 0 && (dy <= 4 || Math.abs(dx) > dy)) {
        if (Math.abs(dx) > 10 || dy < -4) start.current = null; // 横フリックや上スクロールには譲る
        return;
      }
      if (window.scrollY > 0) return;
      // ゴムのような抵抗：引くほど重くなる
      const v = Math.max(0, Math.min(MAX, MAX * (1 - Math.exp(-dy / 190))));
      setPull(v);
      setState('pulling');
      const nowArmed = v >= TRIGGER;
      if (nowArmed !== armed.current) {
        armed.current = nowArmed;
        if (nowArmed) haptic();
      }
    };
    const onEnd = () => {
      if (!start.current) return;
      start.current = null;
      if (pull.current === 0) return;
      if (armed.current) {
        busy.current = true;
        setState('refreshing');
        setPull(HOLD);
        const began = performance.now();
        void onRefresh()
          .catch(() => {})
          .finally(() => {
            // 一瞬で終わっても回転が見えるよう、最低 600ms は保つ
            const wait = Math.max(0, 600 - (performance.now() - began));
            window.setTimeout(() => {
              setState('settling');
              setPull(0);
              window.setTimeout(() => {
                busy.current = false;
                setState('idle');
              }, 520);
            }, wait);
          });
      } else {
        setState('settling');
        setPull(0);
        window.setTimeout(() => setState((st) => (st === 'settling' ? 'idle' : st)), 520);
      }
      armed.current = false;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.pull = state;
  }, [state]);

  const node =
    state === 'idle' || reducedMotion() ? null : (
      <div className={`pull pull-${state}`} aria-hidden="true" data-testid="pull">
        <div className="pull-drop glass">
          <svg viewBox="0 0 24 24">
            <circle className="pull-track" cx="12" cy="12" r="8" />
            <circle className="pull-arc" cx="12" cy="12" r="8" />
          </svg>
        </div>
      </div>
    );
  return { node };
}
