import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUp, Sparkle } from './icons';

export interface ComposerHandle {
  focus(): void;
}

interface Props {
  thinking: boolean;
  /** from: 入力欄の位置（文字が飛んでいく演出の出発点） */
  onSubmit(text: string, from: DOMRect | null): void;
  onAi(text: string): Promise<boolean>;
}

const MAX_H = 168;

/** 起動直後の静的 HTML 内の入力欄（#boot-input）から、文字・カーソル・フォーカスを引き継ぐ */
function takeOverBootInput() {
  const el = document.getElementById('boot-input') as HTMLTextAreaElement | null;
  if (!el) return { value: '', focused: false, start: 0, end: 0 };
  return { value: el.value, focused: document.activeElement === el, start: el.selectionStart, end: el.selectionEnd };
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ thinking, onSubmit, onAi }, ref) {
  const input = useRef<HTMLTextAreaElement>(null);
  const boot = useRef(takeOverBootInput());
  const [value, setValue] = useState(boot.current.value);
  const has = value.trim().length > 0;

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus({ preventScroll: true }) }), []);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    const b = boot.current;
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (b.focused || !coarse) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(b.start || value.length, b.end || value.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 内容に合わせて高さを伸縮
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, [value]);

  // PC：どこで打ち始めても入力欄へ
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('.sheet.open')) return;
      input.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = () => {
    const text = value.trim();
    if (!text || thinking) return;
    onSubmit(text, input.current?.getBoundingClientRect() ?? null);
    setValue('');
    input.current?.focus({ preventScroll: true });
  };

  const ai = async () => {
    const text = value.trim();
    if (!text || thinking) return;
    const ok = await onAi(text);
    if (ok) setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語入力の変換確定 Enter では送信しない
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  };

  return (
    <div
      className={`composer glass${thinking ? ' thinking' : ''}`}
      data-testid="composer"
      onClick={(e) => {
        // 入力欄の外側（余白）をタップしても即フォーカス（iOS はタップ操作内の focus() でのみキーボードを出す）
        if (e.target !== input.current && !(e.target as HTMLElement).closest('button')) {
          input.current?.focus({ preventScroll: true });
        }
      }}
    >
      <textarea
        ref={input}
        className="composer-input"
        data-testid="composer-input"
        rows={1}
        placeholder="メモ"
        aria-label="メモ"
        enterKeyHint="send"
        value={value}
        readOnly={thinking}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {has && (
        <div className="composer-actions">
          <button type="button" className="icon-btn btn-ai pop-in" aria-label="AIでタスクに分ける" data-testid="ai-split" onClick={ai} disabled={thinking}>
            <Sparkle />
          </button>
          <button
            type="button"
            className="icon-btn btn-send pop-in"
            aria-label="追加"
            data-testid="send"
            onPointerDown={(e) => e.preventDefault() /* キーボードを閉じさせない */}
            onClick={submit}
            disabled={thinking}
          >
            <ArrowUp />
          </button>
        </div>
      )}
    </div>
  );
});
