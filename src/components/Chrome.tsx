// ヘッダーのタブ・アバター、スケルトン、ログイン、空状態、トースト
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Filter, User } from '../lib/types';
import { Check, GoogleG } from './icons';
import { startLogin } from '../lib/auth';
import { dur, haptic } from '../lib/motion';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'todo', label: '未着手' },
  { key: 'doing', label: '進行中' },
  { key: 'done', label: '完了' },
];

/** 件数が変わると数字がくるっと入れ替わる */
function Count({ value, testid }: { value: number; testid: string }) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 'up' : 'down';
  const changed = value !== prev.current;
  prev.current = value;
  return (
    <span className="count" data-testid={testid}>
      {value ? (
        <span key={value} className={changed ? `roll roll-${dir}` : 'roll'}>
          {value}
        </span>
      ) : null}
    </span>
  );
}

export function Tabs({ value, counts, onChange }: { value: Filter; counts: Record<Filter, number>; onChange(f: Filter): void }) {
  const box = useRef<HTMLDivElement>(null);
  const indEl = useRef<HTMLSpanElement>(null);
  const last = useRef<{ x: number; w: number } | null>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = (animate: boolean) => {
      const btn = el.querySelector<HTMLElement>(`[data-filter="${value}"]`);
      if (!btn) return;
      const next = { x: btn.offsetLeft, w: btn.offsetWidth };
      const from = last.current;
      last.current = next;
      setInd(next);
      const node = indEl.current;
      if (!animate || !from || !node || (from.x === next.x && from.w === next.w)) return;
      // 液体のように伸びて移動し、縮んで止まる
      const left = Math.min(from.x, next.x);
      const span = Math.max(from.x + from.w, next.x + next.w) - left;
      node.animate(
        [
          { transform: `translateX(${from.x}px) scaleY(1)`, width: `${from.w}px` },
          { transform: `translateX(${left}px) scaleY(.86)`, width: `${span}px`, offset: 0.42 },
          { transform: `translateX(${next.x}px) scaleY(1.04)`, width: `${next.w}px`, offset: 0.78 },
          { transform: `translateX(${next.x}px) scaleY(1)`, width: `${next.w}px` },
        ],
        { duration: dur(560), easing: 'cubic-bezier(.3,.7,.2,1)' },
      );
    };
    measure(true);
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div className="tabs glass" role="tablist" ref={box} data-testid="tabs">
      {ind && <span ref={indEl} className="tab-indicator" style={{ width: ind.w, transform: `translateX(${ind.x}px)` } as CSSProperties} />}
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          role="tab"
          className="tab"
          data-filter={f.key}
          data-testid={`tab-${f.key}`}
          aria-selected={value === f.key}
          onClick={() => {
            if (f.key !== value) haptic();
            onChange(f.key);
          }}
        >
          {f.label}
          <Count value={counts[f.key]} testid={`count-${f.key}`} />
        </button>
      ))}
    </div>
  );
}

export function Avatar({ user, onClick }: { user: User | null; onClick(): void }) {
  if (!user) return null;
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <button type="button" className="avatar glass" aria-label="アカウント" data-testid="avatar" onClick={onClick}>
      {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span style={{ position: 'relative', zIndex: 3 }}>{initial}</span>}
    </button>
  );
}

export function TabsSkeleton() {
  return (
    <>
      <div className="tabs glass skeleton-fade">
        <i className="sk sk-tab" />
        <i className="sk sk-tab" />
        <i className="sk sk-tab" />
        <i className="sk sk-tab" />
      </div>
      <div className="avatar glass skeleton-fade">
        <i className="sk" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
      </div>
    </>
  );
}

const WIDTHS = [72, 54, 84, 46, 66, 58, 76];
export function ListSkeleton() {
  return (
    <div data-testid="skeleton" aria-busy="true" aria-label="読み込み中">
      {WIDTHS.map((w, i) => (
        <div key={i} className="sk-row glass">
          <i className="sk sk-dot" />
          <div className="sk-lines">
            <i className="sk sk-line" style={{ width: `${w}%` }} />
            <i className="sk sk-line" style={{ width: `${20 + ((i * 7) % 12)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoginCard() {
  return (
    <section className="login glass" data-testid="login">
      <img className="login-mark" src="/icons/icon.svg" alt="" />
      <button type="button" className="btn-google" data-testid="google-login" onClick={startLogin}>
        <GoogleG />
        Googleでログイン
      </button>
    </section>
  );
}

export function Empty() {
  return (
    <div className="empty" data-testid="empty" aria-label="タスクなし">
      <div className="empty-orb glass">
        <Check />
      </div>
    </div>
  );
}

export interface ToastData {
  id: number;
  text: string;
  action?: { label: string; run(): void };
  out?: boolean;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast glass${toast.out ? ' out' : ''}`} role="status" data-testid="toast">
      <span>{toast.text}</span>
      {toast.action && (
        <button type="button" data-testid="toast-action" onClick={toast.action.run}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
