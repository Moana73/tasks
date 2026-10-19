import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import { stepStatus, STATUS_LABEL, type Status, type Task } from '../lib/types';
import { burst, dur, EASE_OUT, flying, haptic, relTime, SPRING } from '../lib/motion';
import { Back, Check, Play, StatusIcon } from './icons';

const COLOR: Record<Status, string> = { todo: '#8e8e93', doing: '#0a7aff', done: '#2fb455' };
const PULSE: Record<Status, string> = {
  todo: 'rgba(142,142,147,.45)',
  doing: 'rgba(10,122,255,.45)',
  done: 'rgba(47,180,85,.45)',
};

interface Props {
  task: Task;
  exiting: boolean;
  enter: boolean;
  /** AI が作ったばかりのタスク（光が一度走る） */
  glow?: boolean;
  revealIndex: number | null;
  now: number;
  /** 戻り値 true＝このカードは一覧から外れる（フィルタ中など） */
  onStatus(task: Task, next: Status, dir: 1 | -1): boolean;
  onOpen(task: Task): void;
  onExited(id: string): void;
  register(id: string, el: HTMLDivElement | null): void;
}

interface Drag {
  id: number;
  x0: number;
  y0: number;
  dx: number;
  decided: boolean;
  active: boolean;
  lastX: number;
  lastT: number;
  v: number;
}

const COMMIT_RATIO = 0.3;
const FLICK_V = 0.5; // px/ms

export const TaskItem = memo(function TaskItem(p: Props) {
  const { task } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const moved = useRef(false);
  const lastDir = useRef<0 | 1 | -1>(0);
  const [target, setTarget] = useState<{ dir: 1 | -1; to: Status | null } | null>(null);
  const [flyIn] = useState(() => flying.has(task.id));
  const prevStatus = useRef(task.status);
  const bursted = useRef(false);

  const iconCenter = (shiftX = 0) => {
    const icon = card.current?.querySelector('.status');
    if (!icon) return null;
    const r = icon.getBoundingClientRect();
    return { x: r.left + r.width / 2 - shiftX, y: r.top + r.height / 2 };
  };

  // 詳細シートなどで「完了」になったときも光の粒を出す
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = task.status;
    if (was === task.status || task.status !== 'done' || p.exiting) return;
    if (bursted.current) {
      bursted.current = false;
      return;
    }
    const c = iconCenter();
    if (c) burst(c.x, c.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.status]);

  const setRef = (el: HTMLDivElement | null) => {
    wrap.current = el;
    p.register(task.id, el);
  };

  // ---- 退場アニメーション（フィルタから外れた / 削除）----
  useLayoutEffect(() => {
    if (!p.exiting) return;
    const w = wrap.current;
    const c = card.current;
    if (!w || !c) {
      p.onExited(task.id);
      return;
    }
    const h = w.offsetHeight;
    const width = c.offsetWidth;
    w.style.overflow = 'visible';
    const dir = lastDir.current;
    const cur = getComputedStyle(c).transform;
    c.animate(
      dir
        ? [{ transform: cur === 'none' ? 'translateX(0)' : cur }, { transform: `translateX(${dir * width * 1.15}px)`, opacity: 0.6 }]
        : [{ transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(0.9)', opacity: 0, filter: 'blur(6px)' }],
      { duration: dur(dir ? 260 : 300), easing: dir ? 'cubic-bezier(.4,0,1,1)' : EASE_OUT, fill: 'forwards' },
    );
    if (track.current) track.current.animate([{ opacity: track.current.style.opacity || '0' }, { opacity: 0 }], { duration: dur(200), fill: 'forwards' });
    const a = w.animate([{ height: `${h}px` }, { height: '0px', paddingBottom: '0px' }], {
      duration: dur(380),
      delay: dur(dir ? 160 : 140),
      easing: EASE_OUT,
      fill: 'forwards',
    });
    a.onfinish = () => p.onExited(task.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.exiting]);

  // ---- フリック ----
  const paint = (dx: number) => {
    const c = card.current;
    const t = track.current;
    if (!c || !t) return;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    const to = stepStatus(task.status, dir);
    const offset = to ? dx : dx * 0.18; // 行き先がない方向はゴムのように抵抗
    c.style.transform = `translate3d(${offset}px,0,0) rotate(${offset * 0.008}deg)`;
    c.classList.add('dragging');
    const threshold = c.offsetWidth * COMMIT_RATIO;
    const prog = Math.min(1, Math.abs(offset) / threshold);
    t.style.opacity = to ? String(Math.min(1, Math.abs(offset) / 36)) : '0';
    t.style.setProperty('--p', String(prog));
    t.classList.toggle('armed', !!to && prog >= 1);
    // 状態アイコンが行き先を予告する（進む：リングが満ちる／戻る：くるっと回る）
    c.style.setProperty('--pf', to && dir === 1 ? String(prog) : '0');
    c.style.setProperty('--pb', to && dir === -1 ? String(prog) : '0');
    if (to) c.style.setProperty('--next-color', COLOR[to]);
    if (!target || target.dir !== dir || target.to !== to) setTarget({ dir, to });
  };

  const springBack = (from: number) => {
    const c = card.current;
    const t = track.current;
    if (!c) return;
    c.style.transform = '';
    c.style.setProperty('--pf', '0');
    c.style.setProperty('--pb', '0');
    c.animate([{ transform: `translate3d(${from}px,0,0) rotate(${from * 0.008}deg)` }, { transform: 'translate3d(0,0,0)' }], {
      duration: dur(560),
      easing: SPRING,
    });
    if (t) {
      t.classList.remove('armed');
      t.animate([{ opacity: t.style.opacity || '0' }, { opacity: 0 }], { duration: dur(220), easing: EASE_OUT });
      t.style.opacity = '0';
    }
  };

  const commit = (dir: 1 | -1, to: Status, from: number) => {
    const c = card.current;
    if (!c) return;
    haptic();
    lastDir.current = dir;
    const out = dir * c.offsetWidth * 0.5;
    c.style.transform = '';
    const a = c.animate([{ transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${out}px,0,0)` }], {
      duration: dur(130),
      easing: 'ease-out',
      fill: 'forwards',
    });
    a.onfinish = () => {
      c.style.setProperty('--pf', '0');
      c.style.setProperty('--pb', '0');
      if (to === 'done') {
        // 元の位置のアイコンから弾けさせる
        const pt = iconCenter(out);
        if (pt) burst(pt.x, pt.y);
        bursted.current = true;
      }
      const leaving = p.onStatus(task, to, dir);
      if (leaving) return; // 退場アニメーションに引き継ぐ
      c.animate([{ transform: `translate3d(${out}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: dur(620), easing: SPRING });
      a.cancel();
      const t = track.current;
      if (t) {
        t.classList.remove('armed');
        t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur(260), easing: EASE_OUT });
        t.style.opacity = '0';
      }
      c.classList.remove('pulse');
      void c.offsetWidth; // アニメーションを再始動
      c.classList.add('pulse');
      lastDir.current = 0;
    };
  };

  const light = (e: RPointerEvent, on: boolean) => {
    const c = card.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
    c.style.setProperty('--lit', on ? '1' : '0');
  };

  /** 押している指の位置に合わせて、カードがわずかに傾く */
  const tilt = (e: RPointerEvent) => {
    const c = card.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    c.style.setProperty('--ry', `${(nx * 7).toFixed(2)}deg`);
    c.style.setProperty('--rx', `${(-ny * 9).toFixed(2)}deg`);
  };

  const release = () => {
    const c = card.current;
    if (!c || !c.classList.contains('pressing')) return;
    const from = getComputedStyle(c).transform;
    c.classList.remove('pressing');
    if (from && from !== 'none') c.animate([{ transform: from }, { transform: 'none' }], { duration: dur(520), easing: SPRING });
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (p.exiting || (e.pointerType === 'mouse' && e.button !== 0)) return;
    tilt(e);
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, decided: false, active: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    moved.current = false;
    light(e, true);
    card.current?.classList.add('pressing');
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        tilt(e);
        return;
      }
      d.decided = true;
      d.active = Math.abs(dx) > Math.abs(dy) * 1.1;
      moved.current = true;
      card.current?.classList.remove('pressing');
      if (!d.active) {
        light(e, false);
        drag.current = null; // 縦スクロールに譲る
        return;
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = 0.7 * ((e.clientX - d.lastX) / dt) + 0.3 * d.v;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    d.dx = dx;
    light(e, true);
    paint(dx);
  };

  const end = (e: RPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d?.active && !cancelled) release();
    card.current?.classList.remove('pressing', 'dragging');
    light(e, false);
    drag.current = null;
    if (!d || !d.active) return;
    const c = card.current;
    if (!c) return;
    const dir: 1 | -1 = d.dx >= 0 ? 1 : -1;
    const to = stepStatus(task.status, dir);
    const offset = to ? d.dx : d.dx * 0.18;
    const far = Math.abs(d.dx) > c.offsetWidth * COMMIT_RATIO;
    const flick = Math.abs(d.v) > FLICK_V && Math.abs(d.dx) > 24 && Math.sign(d.v) === dir;
    if (!cancelled && to && (far || flick)) commit(dir, to, offset);
    else springBack(offset);
  };

  const t = target;
  const trackColor = t?.to ? COLOR[t.to] : COLOR.todo;
  const wrapClass = `task-wrap${p.enter ? (flyIn ? ' enter-fly' : ' enter') : ''}${p.revealIndex !== null ? ' reveal' : ''}`;

  return (
    <div
      ref={setRef}
      className={wrapClass}
      style={p.revealIndex !== null ? ({ '--i': p.revealIndex } as CSSProperties) : undefined}
      data-testid="task"
      data-id={task.id}
      data-status={task.status}
    >
      <div
        ref={track}
        className="track"
        aria-hidden="true"
        style={{ '--track-color': trackColor, '--track-justify': t?.dir === -1 ? 'flex-end' : 'flex-start' } as CSSProperties}
      >
        {t?.to && (
          <span className="track-label">
            {t.dir === 1 ? t.to === 'done' ? <Check /> : <Play /> : <Back />}
            {STATUS_LABEL[t.to]}
          </span>
        )}
      </div>
      <div
        ref={card}
        className="task glass lit"
        style={{ '--pulse-color': PULSE[task.status] } as CSSProperties}
        data-s={task.status}
        role="button"
        tabIndex={0}
        aria-label={`${task.title}（${STATUS_LABEL[task.status]}）`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => end(e, false)}
        onPointerCancel={(e) => end(e, true)}
        onClick={() => {
          if (moved.current) return;
          p.onOpen(task);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') p.onOpen(task);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const to = stepStatus(task.status, dir);
            if (to) commit(dir, to, 0);
          }
        }}
      >
        {p.glow && <span className="ai-sheen" aria-hidden="true" />}
        <StatusIcon status={task.status} />
        <div className="task-body">
          <span className="task-title" data-testid="task-title">
            {task.title}
          </span>
          <div className="task-meta">
            {task.status === 'doing' && (
              <span className="chip" data-s="doing">
                {STATUS_LABEL.doing}
              </span>
            )}
            <span>{relTime(task.createdAt, p.now)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
