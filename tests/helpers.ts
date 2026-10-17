import { expect, type Locator, type Page } from '@playwright/test';

export interface ServerTask {
  id: string;
  title: string;
  note: string;
  status: 'todo' | 'doing' | 'done';
}

export const uid = () => `u${Math.random().toString(36).slice(2, 10)}`;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** テスト専用ログイン（ローカルかつ DEV_LOGIN=true のときだけ存在するルート） */
export async function login(page: Page, u = uid()) {
  await page.goto(`/auth/dev-login?u=${u}`);
  await expect(page.getByTestId('app')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('avatar')).toBeVisible();
  return u;
}

export const taskByTitle = (page: Page, title: string): Locator =>
  page
    .getByTestId('task')
    .filter({ has: page.getByTestId('task-title').filter({ hasText: new RegExp(`^${esc(title)}$`) }) });

export async function addMemo(page: Page, text: string) {
  const input = page.getByTestId('composer-input');
  await input.fill(text);
  await input.press('Enter');
  await expect(taskByTitle(page, text)).toBeVisible();
}

export async function serverTasks(page: Page): Promise<ServerTask[]> {
  const res = await page.request.get('/api/tasks');
  expect(res.status()).toBe(200);
  return (await res.json()).tasks;
}

export async function serverTask(page: Page, title: string) {
  return (await serverTasks(page)).find((t) => t.title === title);
}

/**
 * 実際のタッチイベント（CDP）で横フリックする。
 * touch-action: pan-y の要素上で、ブラウザ本来のポインターイベント経路を通る。
 */
export async function flick(
  page: Page,
  target: Locator,
  dx: number,
  opts: { duration?: number; steps?: number; dy?: number } = {},
) {
  const { duration = 180, steps = 10, dy = 0 } = opts;
  const card = target.locator('.task');
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('card not visible');
  const vw = page.viewportSize()!.width;
  const y0 = box.y + box.height / 2;
  const x0 = Math.min(Math.max(box.x + box.width / 2 - dx / 2, 4), vw - 4);
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x: Math.min(Math.max(x, 1), vw - 1), y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  // 各イベントに明示的なタイムスタンプを付け、CDP の往復遅延に左右されない「指の速さ」を再現する
  const t0 = Date.now() / 1000;
  const at = (ms: number) => t0 + ms / 1000;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0), timestamp: at(0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(x0 + (dx * i) / steps, y0 + (dy * i) / steps),
      timestamp: at((duration * i) / steps),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: at(duration + 8) });
  await cdp.detach();
  // 確定アニメーション（130ms）とバネ戻り（620ms）の完了を待つ
  await page.waitForTimeout(800);
}
