import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { canadaStore } from '../lib/canadaStore';
import { ALL_ITEMS, SECTIONS, SOURCES_CHECKED_ON, daysUntilDeparture, type ChecklistItem, type ChecklistSection } from '../lib/canadaChecklist';
import { LoginCard, ListSkeleton } from './Chrome';
import { Sheet } from './Sheet';
import { Back, Check } from './icons';

const useCanadaStore = () => useSyncExternalStore(canadaStore.subscribe, canadaStore.get);

const ITEM_BY_ID = new Map(ALL_ITEMS.map((x) => [x.item.id, x]));

function Chevron() {
  return (
    <svg className="cl-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </svg>
  );
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

/** 1項目。タップすると結果メモのシートが開く */
function Item({ item, onOpen }: { item: ChecklistItem; onOpen(id: string): void }) {
  const done = canadaStore.isChecked(item.id);
  const note = canadaStore.noteOf(item.id);
  const open = () => onOpen(item.id);
  return (
    <div
      className="cl-item"
      data-done={done ? 'true' : 'false'}
      data-testid={`cl-item-${item.id}`}
      role="button"
      aria-label={`${item.label}（${done ? '完了' : '未完了'}）`}
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className="cl-check">
        <Check />
      </span>
      <span className="cl-item-body">
        <span className="cl-item-label">{item.label}</span>
        {note && <span className="cl-item-note">{note}</span>}
      </span>
    </div>
  );
}

function Section({
  section,
  open,
  onToggleOpen,
  onOpenItem,
}: {
  section: ChecklistSection;
  open: boolean;
  onToggleOpen(): void;
  onOpenItem(id: string): void;
}) {
  const done = section.items.filter((i) => canadaStore.isChecked(i.id)).length;
  const complete = done === section.items.length;
  return (
    <section className="cl-section glass" data-open={open ? 'true' : 'false'} data-testid={`cl-section-${section.id}`}>
      <button type="button" className="cl-section-head" onClick={onToggleOpen} aria-expanded={open}>
        <div className="cl-section-title">{section.title}</div>
        <span className="cl-count" data-complete={complete ? 'true' : 'false'}>
          {done}/{section.items.length}
        </span>
        <Chevron />
      </button>
      {open && (
        <div className="cl-section-body">
          {section.notes && (
            <div className="cl-notes">
              {section.notes.map((n, i) => (
                <p className="cl-note" key={i}>
                  {n}
                </p>
              ))}
            </div>
          )}
          {section.items.map((it) => (
            <Item key={it.id} item={it} onOpen={onOpenItem} />
          ))}
          {section.sources && section.sources.length > 0 && (
            <div className="cl-sources">
              <div className="cl-sources-title">出典</div>
              {section.sources.map((s) => (
                <a key={s.url} className="cl-source" href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** 書いた結果メモをまとめて見る場所 */
function MemoCard({ onOpenItem }: { onOpenItem(id: string): void }) {
  const memos = ALL_ITEMS.filter(({ item }) => canadaStore.noteOf(item.id).trim());
  return (
    <div className="cl-memos glass" data-testid="cl-memos">
      <div className="cl-card-title">結果メモ</div>
      {memos.length === 0 ? (
        <p className="cl-memos-empty">項目を完了にするときに書いたメモが、ここにまとまります。</p>
      ) : (
        memos.map(({ item }) => (
          <button key={item.id} type="button" className="cl-memo" onClick={() => onOpenItem(item.id)}>
            <span className="cl-memo-label">{item.label}</span>
            <span className="cl-memo-text">{canadaStore.noteOf(item.id)}</span>
          </button>
        ))
      )}
    </div>
  );
}

/** 項目を開いたときのシート：結果メモを書いて完了にする／完了を戻す */
function ItemSheet({ id, open, onClose }: { id: string | null; open: boolean; onClose(): void }) {
  const entry = id ? ITEM_BY_ID.get(id) : undefined;
  const [note, setNote] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = id ? canadaStore.isChecked(id) : false;

  useEffect(() => {
    if (id && open) setNote(canadaStore.noteOf(id));
  }, [id, open]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [note, open]);

  // 閉じるときは、完了ボタンを押していなくてもメモだけは残す
  const close = () => {
    if (id) canadaStore.update(id, { note });
    onClose();
  };
  const complete = () => {
    if (id) canadaStore.update(id, { checked: true, note });
    onClose();
  };
  const reopen = () => {
    if (id) canadaStore.update(id, { checked: false, note });
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} testid="cl-sheet" label="項目の結果メモ">
      {entry && (
        <>
          <div className="cl-sheet-head">
            <div className="cl-sheet-section">{entry.sectionTitle}</div>
            <div className="cl-sheet-label">{entry.item.label}</div>
          </div>
          <textarea
            ref={ref}
            className="field"
            data-testid="cl-sheet-note"
            aria-label="結果メモ"
            placeholder="結果メモ（例：どこで・何に決めたか、番号、日付）"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {done ? (
            <div className="row">
              <button type="button" className="btn btn-plain" data-testid="cl-sheet-reopen" onClick={reopen}>
                未完了に戻す
              </button>
              <button type="button" className="btn cl-btn-primary" data-testid="cl-sheet-save" onClick={close}>
                保存
              </button>
            </div>
          ) : (
            <button type="button" className="btn cl-btn-primary" data-testid="cl-sheet-done" onClick={complete}>
              <Check />
              完了にする
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

export function CanadaChecklist() {
  const s = useCanadaStore();
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove();
    // このページだけ背景をオレンジにする（styles.css の :root[data-page='canada']）
    document.documentElement.dataset.page = 'canada';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fff3e6');
    void canadaStore.boot();
  }, []);

  const days = useMemo(() => daysUntilDeparture(new Date()), []);

  // 初期状態：まだ終わっていない項目がある最初のセクションだけ開く
  const firstOpenId = useMemo(
    () => SECTIONS.find((sec) => sec.items.some((i) => !canadaStore.isChecked(i.id)))?.id ?? null,
    // 読み込み完了時点の状態で決める
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.ready],
  );
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);
  const effectiveOpen = openIds ?? new Set(firstOpenId ? [firstOpenId] : []);
  const toggleOpen = (id: string) => {
    const next = new Set(effectiveOpen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };

  // 開いている項目（シートを閉じるアニメーション中も中身を保つ）
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openItem = (id: string) => {
    setSheetId(id);
    setSheetOpen(true);
  };

  const totalDone = ALL_ITEMS.filter(({ item }) => canadaStore.isChecked(item.id)).length;
  const totalAll = ALL_ITEMS.length;
  const pct = totalAll ? totalDone / totalAll : 0;
  const R = 31;
  const C = 2 * Math.PI * R;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextUp = useMemo(() => ALL_ITEMS.filter(({ item }) => !canadaStore.isChecked(item.id)).slice(0, 5), [s]);

  return (
    <>
      <div className="app" data-testid="canada-app">
        <header className="top">
          <div className="bar cl-head">
            <a href="/" className="icon-btn glass" aria-label="戻る" data-testid="cl-back">
              <Back />
            </a>
            <div>
              <div className="cl-title">カナダワーホリ準備</div>
              <div className="cl-sub">入国予定 2027年4月1日</div>
            </div>
          </div>
        </header>

        <main className="list">
          {!s.ready ? (
            <ListSkeleton />
          ) : !s.user ? (
            <LoginCard />
          ) : (
            <>
              <div className="cl-hero glass">
                <div className="cl-ring">
                  <svg viewBox="0 0 76 76">
                    <circle className="cl-ring-track" cx="38" cy="38" r={R} />
                    <circle className="cl-ring-bar" cx="38" cy="38" r={R} strokeDasharray={`${C * pct} ${C}`} />
                  </svg>
                  <div className="cl-ring-label">{Math.round(pct * 100)}%</div>
                </div>
                <div className="cl-hero-body">
                  <div className="cl-days">
                    {days >= 0 ? days : 0}
                    <span>日後に入国</span>
                  </div>
                  <div className="cl-phase">
                    {totalDone}/{totalAll} 完了
                  </div>
                </div>
              </div>

              {nextUp.length > 0 && (
                <div className="cl-next glass">
                  <div className="cl-card-title">次にやること</div>
                  {nextUp.map(({ item }) => (
                    <Item key={item.id} item={item} onOpen={openItem} />
                  ))}
                </div>
              )}

              <MemoCard onOpenItem={openItem} />

              {SECTIONS.map((sec) => (
                <Section
                  key={sec.id}
                  section={sec}
                  open={effectiveOpen.has(sec.id)}
                  onToggleOpen={() => toggleOpen(sec.id)}
                  onOpenItem={openItem}
                />
              ))}

              <p className="cl-foot">
                補足説明は {fmtDate(SOURCES_CHECKED_ON)} 時点の公式情報です。制度は変わるので、手続きの前に出典で最新の内容を確認してください。
              </p>
            </>
          )}
        </main>
      </div>

      <ItemSheet id={sheetId} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
