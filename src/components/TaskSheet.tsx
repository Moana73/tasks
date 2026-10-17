import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { STATUS_LABEL, type Status, type Task } from '../lib/types';
import { Sheet } from './Sheet';
import { Sparkle, Trash } from './icons';

const ORDER: Status[] = ['todo', 'doing', 'done'];

interface Props {
  task: Task | null;
  open: boolean;
  aiBusy: boolean;
  onClose(): void;
  onChange(id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'status'>>): void;
  onDelete(task: Task): void;
  onBreakdown(task: Task): void;
}

function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string, max = 220) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [ref, value, max]);
}

export function TaskSheet({ task, open, aiBusy, onClose, onChange, onDelete, onBreakdown }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (task && task.id !== lastId.current) {
      lastId.current = task.id;
      setTitle(task.title);
      setNote(task.note);
    }
  }, [task]);

  useAutosize(titleRef, title, 140);
  useAutosize(noteRef, note);

  const save = () => {
    if (!task) return;
    const t = title.trim();
    const patch: Partial<Pick<Task, 'title' | 'note'>> = {};
    if (t && t !== task.title) patch.title = t;
    if (note !== task.note) patch.note = note;
    if (Object.keys(patch).length) onChange(task.id, patch);
  };

  const close = () => {
    save();
    lastId.current = null;
    onClose();
  };

  const idx = task ? ORDER.indexOf(task.status) : 0;

  return (
    <Sheet open={open} onClose={close} testid="task-sheet" label="タスクの詳細">
      {task && (
        <>
          <textarea
            ref={titleRef}
            className="field title"
            data-testid="sheet-title"
            aria-label="タイトル"
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
          />
          <div className="seg" role="group" aria-label="ステータス">
            <span className="seg-ind" style={{ transform: `translateX(${idx * 100}%)` } as CSSProperties} />
            {ORDER.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={task.status === s}
                data-testid={`sheet-status-${s}`}
                onClick={() => task.status !== s && onChange(task.id, { status: s })}
              >
                <i className={`dot ${s}`} />
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <textarea
            ref={noteRef}
            className="field"
            data-testid="sheet-note"
            aria-label="メモ"
            placeholder="メモ"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={save}
          />
          <div className="row">
            <button type="button" className="btn btn-soft" data-testid="sheet-ai" disabled={aiBusy} onClick={() => onBreakdown({ ...task, title: title.trim() || task.title, note })}>
              <Sparkle />
              {aiBusy ? '分解中…' : 'AIで分解'}
            </button>
            <button type="button" className="btn btn-danger" data-testid="sheet-delete" onClick={() => onDelete(task)}>
              <Trash />
              削除
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
