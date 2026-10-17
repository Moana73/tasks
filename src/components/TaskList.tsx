import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Status, Task } from '../lib/types';
import { dur, SPRING } from '../lib/motion';
import { TaskItem } from './TaskItem';

interface Item {
  task: Task;
  exiting: boolean;
}

interface Props {
  tasks: Task[];
  now: number;
  /** 一覧が初めて表示されたとき、カードを順番にふわっと出す */
  reveal: boolean;
  onStatus(task: Task, next: Status, dir: 1 | -1): boolean;
  onOpen(task: Task): void;
}

/** 消える項目を元の位置に残したまま、新しい並びと合成する */
function mergeItems(prev: Item[], next: Task[]): Item[] {
  const ids = new Set(next.map((t) => t.id));
  const out: Item[] = next.map((task) => ({ task, exiting: false }));
  prev.forEach((it, idx) => {
    if (!ids.has(it.task.id)) out.splice(Math.min(idx, out.length), 0, { task: it.task, exiting: true });
  });
  return out;
}

export function TaskList({ tasks, now, reveal, onStatus, onOpen }: Props) {
  const [items, setItems] = useState<Item[]>(() => tasks.map((task) => ({ task, exiting: false })));
  const [prevTasks, setPrevTasks] = useState(tasks);
  const initialIds = useRef(new Set(tasks.map((t) => t.id)));
  // 初めて現れた時刻（追加アニメーション中の再描画でクラスが外れないように）
  const firstSeen = useRef(new Map<string, number>(tasks.map((t) => [t.id, -1e9])));
  const els = useRef(new Map<string, HTMLDivElement>());
  const tops = useRef(new Map<string, number>());

  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setItems((cur) => mergeItems(cur, tasks));
  }

  // FLIP：並びが変わった項目を前の位置からバネで移動させる
  useLayoutEffect(() => {
    const exitingIds = new Set(items.filter((i) => i.exiting).map((i) => i.task.id));
    for (const [id, el] of els.current) {
      const top = el.offsetTop;
      const prev = tops.current.get(id);
      tops.current.set(id, top);
      if (prev === undefined || prev === top || exitingIds.has(id)) continue;
      el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'translateY(0)' }], {
        duration: dur(560),
        easing: SPRING,
      });
    }
  });

  const register = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) els.current.set(id, el);
    else {
      els.current.delete(id);
      tops.current.delete(id);
    }
  }, []);

  const onExited = useCallback((id: string) => {
    setItems((cur) => cur.filter((i) => !(i.exiting && i.task.id === id)));
  }, []);

  const nowMs = performance.now();
  for (const { task } of items) if (!firstSeen.current.has(task.id)) firstSeen.current.set(task.id, nowMs);

  return (
    <>
      {items.map(({ task, exiting }, i) => (
        <TaskItem
          key={task.id}
          task={task}
          exiting={exiting}
          enter={nowMs - (firstSeen.current.get(task.id) ?? 0) < 700}
          revealIndex={reveal && initialIds.current.has(task.id) ? Math.min(i, 12) : null}
          now={now}
          onStatus={onStatus}
          onOpen={onOpen}
          onExited={onExited}
          register={register}
        />
      ))}
    </>
  );
}
