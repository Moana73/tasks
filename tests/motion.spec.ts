import { test, expect, type Page } from '@playwright/test';
import { addMemo, flick, login, taskByTitle } from './helpers';

async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now() / 1000;
  let ms = 0;
  const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  return {
    start: (x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y), timestamp: t0 }),
    move: (x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, y), timestamp: t0 + (ms += 16) / 1000 }),
    end: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + (ms += 16) / 1000 });
      await cdp.detach();
    },
  };
}

test.describe('アニメーション', () => {
  test('入力した文字がカードへ飛んでいき、着地後にタイトルが現れる', async ({ page }) => {
    await login(page);
    const input = page.getByTestId('composer-input');
    await input.fill('飛んでいくメモ');
    await input.press('Enter');
    const ghost = page.locator('.fx-fly');
    await expect(ghost).toHaveText('飛んでいくメモ');
    const title = taskByTitle(page, '飛んでいくメモ').getByTestId('task-title');
    await expect(title).toHaveCSS('opacity', '0');
    await expect(ghost).toHaveCount(0);
    await expect(title).toHaveCSS('opacity', '1');
  });

  test('完了にすると状態アイコンから光の粒が弾ける', async ({ page }) => {
    await login(page);
    await addMemo(page, '弾けるタスク');
    const card = taskByTitle(page, '弾けるタスク');
    await flick(page, card, 220);
    await expect(card).toHaveAttribute('data-status', 'doing');
    await expect(page.locator('.fx-layer')).toHaveCount(0);

    const cdpCheck = page.waitForSelector('.fx-layer .fx-dot', { timeout: 3000 });
    await flick(page, card, 220);
    await cdpCheck;
    await expect(card).toHaveAttribute('data-status', 'done');
    await expect(page.locator('.fx-layer')).toHaveCount(0, { timeout: 3000 }); // 終わったら片付く
  });

  test('詳細シートで完了にしても光の粒が弾ける', async ({ page }) => {
    await login(page);
    await addMemo(page, 'シートで完了');
    await taskByTitle(page, 'シートで完了').locator('.task').click();
    const fx = page.waitForSelector('.fx-layer .fx-dot', { timeout: 3000 });
    await page.getByTestId('sheet-status-done').click();
    await fx;
  });

  test('ドラッグ中は状態アイコンが行き先の色で満ちていく', async ({ page }) => {
    await login(page);
    await addMemo(page, '予告するタスク');
    const card = taskByTitle(page, '予告するタスク').locator('.task');
    const box = (await card.boundingBox())!;
    const t = await touch(page);
    const y = box.y + box.height / 2;
    await t.start(box.x + 40, y);
    for (let i = 1; i <= 8; i++) await t.move(box.x + 40 + i * 9, y);
    const pf = await card.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--pf')));
    expect(pf).toBeGreaterThan(0.3);
    const offset = await card.locator('.preview').evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset));
    expect(offset).toBeLessThan(50);
    await t.end();
    await page.waitForTimeout(700);
    expect(await card.evaluate((el) => getComputedStyle(el).getPropertyValue('--pf').trim())).toBe('0');
  });

  test('押している間カードが指の位置へ傾き、離すとバネで戻る', async ({ page }) => {
    await login(page);
    await addMemo(page, '傾くカード');
    const card = taskByTitle(page, '傾くカード').locator('.task');
    const box = (await card.boundingBox())!;
    const t = await touch(page);
    await t.start(box.x + box.width - 20, box.y + 10);
    await page.waitForTimeout(300);
    await expect(card).toHaveClass(/pressing/);
    expect(await card.evaluate((el) => getComputedStyle(el).transform)).toContain('matrix3d');
    await t.end();
    await expect(card).not.toHaveClass(/pressing/);
  });

  test('タブを切り替えるとインジケーターが液体のように伸びて移動し、一覧が切り替え方向から入る', async ({ page }) => {
    await login(page);
    await addMemo(page, 'a');
    await page.getByTestId('tab-done').click();
    const anims = await page.locator('.tab-indicator').evaluate((el) => el.getAnimations().length);
    expect(anims).toBeGreaterThan(0);
    expect(await page.getByTestId('list').evaluate((el) => el.style.getPropertyValue('--slide'))).toBe('1');
    await page.getByTestId('tab-all').click();
    expect(await page.getByTestId('list').evaluate((el) => el.style.getPropertyValue('--slide'))).toBe('-1');
    await expect(taskByTitle(page, 'a')).toBeVisible();
  });

  test('件数が変わると数字がくるっと入れ替わる', async ({ page }) => {
    await login(page);
    await addMemo(page, '数える1');
    await addMemo(page, '数える2');
    await expect(page.getByTestId('count-all').locator('.roll-up')).toHaveText('2');
  });

  test('AI が作ったタスクに光が一度走り、しばらくすると消える', async ({ page }) => {
    await login(page);
    await page.getByTestId('composer-input').fill('一、二、三');
    await page.getByTestId('ai-split').click();
    await expect(page.locator('.ai-sheen')).toHaveCount(3);
    await expect(page.locator('.ai-sheen')).toHaveCount(0, { timeout: 5000 });
  });

  test('一番上で下に引っ張ると、しずくが伸びて同期し、元に戻る', async ({ page }) => {
    await login(page);
    await addMemo(page, '引っ張る');
    const list = page.getByTestId('list');
    const box = (await list.boundingBox())!;
    const t = await touch(page);
    const x = box.x + box.width / 2;
    await t.start(x, box.y + 60);
    for (let i = 1; i <= 16; i++) await t.move(x, box.y + 60 + i * 18);
    await expect(page.getByTestId('pull').locator('.pull-drop')).toBeVisible();
    const pulled = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pull')));
    expect(pulled).toBeGreaterThan(72);
    const synced = page.waitForRequest((r) => r.url().endsWith('/api/tasks') && r.method() === 'GET');
    await t.end();
    await synced;
    await expect(page.getByTestId('pull')).toHaveClass(/pull-refreshing/);
    await expect(page.getByTestId('pull')).toHaveCount(0, { timeout: 4000 });
    await expect(taskByTitle(page, '引っ張る')).toBeVisible();
  });

  test('少し引っ張っただけでは同期せず元に戻る', async ({ page }) => {
    await login(page);
    const box = (await page.getByTestId('list').boundingBox())!;
    let synced = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/tasks') && r.method() === 'GET') synced = true;
    });
    const t = await touch(page);
    const x = box.x + box.width / 2;
    await t.start(x, box.y + 60);
    for (let i = 1; i <= 4; i++) await t.move(x, box.y + 60 + i * 12);
    await t.end();
    await expect(page.getByTestId('pull')).toHaveCount(0, { timeout: 3000 });
    expect(synced).toBe(false);
  });

  test('スクロールするとヘッダーのガラスが濃くなる', async ({ page }) => {
    await login(page);
    for (let i = 0; i < 9; i++) await addMemo(page, `スクロール${i}`);
    const header = page.locator('header.top');
    await expect(header).not.toHaveClass(/scrolled/);
    await page.mouse.wheel(0, 400);
    await expect(header).toHaveClass(/scrolled/);
  });
});
