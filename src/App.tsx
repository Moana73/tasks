import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { store } from './lib/store';
import { api } from './lib/api';
import type { Filter, Status, Task } from './lib/types';
import { Composer, type ComposerHandle } from './components/Composer';
import { TaskList } from './components/TaskList';
import { TaskSheet } from './components/TaskSheet';
import { Sheet } from './components/Sheet';
import { Avatar, Empty, ListSkeleton, LoginCard, Tabs, TabsSkeleton, Toast, type ToastData } from './components/Chrome';
import { Logout } from './components/icons';

const useStore = () => useSyncExternalStore(store.subscribe, store.get);

/** 一覧の並び：未完了は新しい順で上、完了は下へ沈む */
function order(tasks: Task[]): Task[] {
  const open = tasks.filter((t) => t.status !== 'done').sort((a, b) => b.createdAt - a.createdAt);
  const done = tasks.filter((t) => t.status === 'done').sort((a, b) => b.updatedAt - a.updatedAt);
  return [...open, ...done];
}

function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timers = useRef<number[]>([]);
  const show = useCallback((text: string, action?: ToastData['action'], ms = 2600) => {
    timers.current.forEach(clearTimeout);
    const id = Date.now();
    setToast({ id, text, action });
    timers.current = [
      window.setTimeout(() => setToast((t) => (t && t.id === id ? { ...t, out: true } : t)), ms),
      window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), ms + 320),
    ];
  }, []);
  const hide = useCallback(() => setToast((t) => (t ? { ...t, out: true } : t)), []);
  return { toast, show, hide };
}

export function App() {
  const s = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const composer = useRef<ComposerHandle>(null);
  const { toast, show, hide } = useToast();
  const filterRef = useRef(filter);
  filterRef.current = filter;

  // 静的スケルトン（#boot）から React の画面へ、描画前に差し替える
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove();
  }, []);

  useEffect(() => {
    void store.boot();
    const params = new URLSearchParams(location.search);
    if (params.has('auth_error')) {
      show(params.get('auth_error') === 'denied' ? 'このアカウントでは使えません' : 'ログインできませんでした');
      history.replaceState(null, '', '/');
    }
    const resync = () => document.visibilityState === 'visible' && void store.sync(true);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [show]);

  const ordered = useMemo(() => order(s.tasks), [s.tasks]);
  const visible = useMemo(() => (filter === 'all' ? ordered : ordered.filter((t) => t.status === filter)), [ordered, filter]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: s.tasks.length, todo: 0, doing: 0, done: 0 };
    for (const t of s.tasks) c[t.status]++;
    return c;
  }, [s.tasks]);

  const openTask = s.tasks.find((t) => t.id === openId) ?? null;
  const [sheetTask, setSheetTask] = useState<Task | null>(null);
  useEffect(() => {
    if (openTask) setSheetTask(openTask);
  }, [openTask]);

  const onStatus = useCallback((task: Task, next: Status) => {
    store.update(task.id, { status: next });
    const f = filterRef.current;
    return f !== 'all' && f !== next;
  }, []);

  const onOpen = useCallback((task: Task) => setOpenId(task.id), []);

  const addMemo = useCallback(
    (text: string) => {
      store.add(text);
      if (filterRef.current !== 'all' && filterRef.current !== 'todo') setFilter('all');
    },
    [],
  );

  const addMany = (titles: string[]) => {
    // 先頭のタスクが一番上に来るよう、逆順に少しずつ追加して順番に現れる演出にする
    [...titles].reverse().forEach((t, i) => window.setTimeout(() => store.add(t), i * 90));
    if (filterRef.current !== 'all' && filterRef.current !== 'todo') setFilter('all');
  };

  const runAi = async (text: string, mode: 'split' | 'breakdown'): Promise<string[] | null> => {
    if (!s.user) {
      show('AIはログイン後に使えます');
      return null;
    }
    try {
      const { titles } = await api.ai(text, mode);
      if (!titles.length) {
        show('タスクにできませんでした');
        return null;
      }
      return titles;
    } catch {
      show('AIに接続できませんでした');
      return null;
    }
  };

  const onAi = async (text: string) => {
    setThinking(true);
    const titles = await runAi(text, 'split');
    setThinking(false);
    if (!titles) return false;
    addMany(titles);
    show(`${titles.length}件のタスクにしました`);
    composer.current?.focus();
    return true;
  };

  const onBreakdown = async (task: Task) => {
    setSheetBusy(true);
    const titles = await runAi(task.note ? `${task.title}\n${task.note}` : task.title, 'breakdown');
    setSheetBusy(false);
    if (!titles) return;
    setOpenId(null);
    addMany(titles);
    show(`${titles.length}件に分解しました`);
  };

  const onDelete = (task: Task) => {
    setOpenId(null);
    const removed = store.remove(task.id);
    if (!removed) return;
    show(
      '削除しました',
      {
        label: '元に戻す',
        run: () => {
          store.restore(removed);
          hide();
        },
      },
      4500,
    );
  };

  const closeSheet = useCallback(() => setOpenId(null), []);

  return (
    <>
      <div className="app" data-testid="app" data-ready={s.ready ? 'true' : 'false'}>
        <header className="top">
          <div className="bar">
            {s.ready ? (
              <>
                <Tabs value={filter} counts={counts} onChange={setFilter} />
                <Avatar user={s.user} onClick={() => setMenu(true)} />
              </>
            ) : (
              <TabsSkeleton />
            )}
          </div>
          <Composer ref={composer} thinking={thinking} onSubmit={addMemo} onAi={onAi} />
        </header>

        <main className="list" data-testid="list">
          {!s.ready ? (
            <ListSkeleton />
          ) : (
            <>
              <TaskList key={filter} tasks={visible} now={now} reveal onStatus={onStatus} onOpen={onOpen} />
              {visible.length === 0 && s.user && <Empty />}
              {!s.user && <LoginCard />}
            </>
          )}
        </main>
      </div>

      <TaskSheet
        task={sheetTask}
        open={openId !== null && openTask !== null}
        aiBusy={sheetBusy}
        onClose={closeSheet}
        onChange={(id, patch) => store.update(id, patch)}
        onDelete={onDelete}
        onBreakdown={onBreakdown}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} testid="menu" label="アカウント">
        <div className="menu-email" data-testid="menu-email">
          {s.user?.email}
        </div>
        <button
          type="button"
          className="btn btn-plain"
          data-testid="logout"
          onClick={async () => {
            setMenu(false);
            await store.logout();
          }}
        >
          <Logout />
          ログアウト
        </button>
      </Sheet>

      <Toast toast={toast} />
    </>
  );
}
