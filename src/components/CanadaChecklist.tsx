import { useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { canadaStore } from '../lib/canadaStore';
import { ALL_ITEMS, SECTIONS, SOURCES_CHECKED_ON, daysUntilDeparture, type ChecklistSection } from '../lib/canadaChecklist';
import { LoginCard, ListSkeleton } from './Chrome';
import { Back, Check } from './icons';

const useCanadaStore = () => useSyncExternalStore(canadaStore.subscribe, canadaStore.get);

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

function Item({ id, label, done, onToggle }: { id: string; label: string; done: boolean; onToggle(id: string): void }) {
  const toggle = () => onToggle(id);
  return (
    <div
      className="cl-item"
      data-done={done ? 'true' : 'false'}
      data-testid={`cl-item-${id}`}
      role="checkbox"
      aria-checked={done}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span className="cl-check">
        <Check />
      </span>
      <span className="cl-item-label">{label}</span>
    </div>
  );
}

function Section({
  section,
  checkedOf,
  open,
  onToggleOpen,
  onToggleItem,
}: {
  section: ChecklistSection;
  checkedOf(id: string): boolean;
  open: boolean;
  onToggleOpen(): void;
  onToggleItem(id: string): void;
}) {
  const done = section.items.filter((i) => checkedOf(i.id)).length;
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
            <Item key={it.id} id={it.id} label={it.label} done={checkedOf(it.id)} onToggle={onToggleItem} />
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

export function CanadaChecklist() {
  const s = useCanadaStore();
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove();
    void canadaStore.boot();
  }, []);

  const days = useMemo(() => daysUntilDeparture(new Date()), []);
  const checkedOf = (id: string) => canadaStore.isChecked(id);

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
    setOpenIds(() => {
      const next = new Set(effectiveOpen);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalDone = ALL_ITEMS.filter(({ item }) => checkedOf(item.id)).length;
  const totalAll = ALL_ITEMS.length;
  const pct = totalAll ? totalDone / totalAll : 0;
  const R = 31;
  const C = 2 * Math.PI * R;

  const nextUp = useMemo(() => ALL_ITEMS.filter(({ item }) => !checkedOf(item.id)).slice(0, 5), [s]);

  return (
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
                <div className="cl-next-title">次にやること</div>
                {nextUp.map(({ item }) => (
                  <Item key={item.id} id={item.id} label={item.label} done={checkedOf(item.id)} onToggle={canadaStore.toggle} />
                ))}
              </div>
            )}

            {SECTIONS.map((sec) => (
              <Section
                key={sec.id}
                section={sec}
                checkedOf={checkedOf}
                open={effectiveOpen.has(sec.id)}
                onToggleOpen={() => toggleOpen(sec.id)}
                onToggleItem={canadaStore.toggle}
              />
            ))}

            <p className="cl-foot">
              補足説明は {fmtDate(SOURCES_CHECKED_ON)} 時点の公式情報です。制度は変わるので、手続きの前に出典で最新の内容を確認してください。
            </p>
          </>
        )}
      </main>
    </div>
  );
}
