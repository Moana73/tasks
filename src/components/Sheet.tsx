import { useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as RPointerEvent, CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export function usePresence(open: boolean, ms: number) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, visible };
}

interface Props {
  open: boolean;
  onClose(): void;
  children: ReactNode;
  testid?: string;
  label: string;
}

/** 下から出るガラスのシート。下方向へのドラッグでも閉じられる */
export function Sheet({ open, onClose, children, testid, label }: Props) {
  const { mounted, visible } = usePresence(open, 480);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const st = useRef<{ id: number; y0: number; lastY: number; lastT: number; v: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setDrag(0);
  }, [open]);

  if (!mounted) return null;

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('textarea, input, button')) return;
    st.current = { id: e.pointerId, y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    const dy = e.clientY - s.y0;
    if (!dragging && Math.abs(dy) < 6) return;
    if (!dragging) {
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    const dt = e.timeStamp - s.lastT;
    if (dt > 0) s.v = (e.clientY - s.lastY) / dt;
    s.lastY = e.clientY;
    s.lastT = e.timeStamp;
    setDrag(dy > 0 ? dy : dy * 0.15);
  };
  const up = () => {
    const s = st.current;
    st.current = null;
    if (!dragging) return;
    setDragging(false);
    if (drag > 110 || (s && s.v > 0.6 && drag > 20)) onClose();
    else setDrag(0);
  };

  return createPortal(
    <>
      <div className={`backdrop${visible ? ' open' : ''}`} onClick={onClose} data-testid={testid ? `${testid}-backdrop` : undefined} />
      <div
        className={`sheet glass${visible ? ' open' : ''}${dragging ? ' dragging' : ''}`}
        style={{ '--drag': `${drag}px` } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testid}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="grabber" />
        <div className="sheet-inner">{children}</div>
      </div>
    </>,
    document.body,
  );
}
