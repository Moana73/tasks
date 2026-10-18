import { test, expect } from '@playwright/test';
import { addMemo, flick, login, serverTask, serverTasks, taskByTitle, uid } from './helpers';

test.describe('起動直後のメモとスケルトン', () => {
  test('JS 到着前から全画面スケルトンと入力欄が出て、打った文字は React 側へ引き継がれる', async ({ page }) => {
    await page.route('**/assets/app-*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'commit' });

    const boot = page.getByTestId('boot');
    await expect(boot).toBeVisible();
    await expect(boot.locator('.sk-row')).toHaveCount(6);
    await expect(boot.getByTestId('skeleton-tabs')).toBeVisible();
    const bootInput = page.locator('#boot-input');
    await expect(bootInput).toBeFocused();

    await page.keyboard.type('ひらいた瞬間');
    await expect(bootInput).toHaveValue('ひらいた瞬間');

    // React が起動したら静的スケルトンは消え、同じ文字・フォーカスのまま本物の入力欄へ
    await expect(boot).toHaveCount(0, { timeout: 10_000 });
    const input = page.getByTestId('composer-input');
    await expect(input).toHaveValue('ひらいた瞬間');
    await expect(input).toBeFocused();
    await page.keyboard.type('メモ');
    await expect(input).toHaveValue('ひらいた瞬間メモ');
  });

  test('データ取得中は全画面スケルトン、その間も入力欄は使え、取得後に一覧へ置き換わる', async ({ page }) => {
    await login(page);
    await page.evaluate(() => localStorage.clear()); // キャッシュなし＝初回起動と同じ状態
    await page.route('**/api/me', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByTestId('app')).toHaveAttribute('data-ready', 'false');
    await expect(page.getByTestId('skeleton')).toBeVisible();
    await expect(page.getByTestId('skeleton').locator('.sk-row')).toHaveCount(7);

    const input = page.getByTestId('composer-input');
    await input.fill('読み込み中に書いたメモ');
    await input.press('Enter');
    await expect(input).toHaveValue('');

    await expect(page.getByTestId('app')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByTestId('skeleton')).toHaveCount(0);
    await expect(taskByTitle(page, '読み込み中に書いたメモ')).toBeVisible();
    await expect.poll(async () => (await serverTask(page, '読み込み中に書いたメモ'))?.status).toBe('todo');
  });

  test('2回目以降はキャッシュから即表示し、圏外でも開ける', async ({ page, context }) => {
    await login(page);
    await addMemo(page, 'オフラインでも見える');
    await expect.poll(async () => (await serverTask(page, 'オフラインでも見える'))?.status).toBe('todo');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('app')).toHaveAttribute('data-ready', 'true');
    await expect(taskByTitle(page, 'オフラインでも見える')).toBeVisible();
    // 圏外で追加しても消えず、復帰後に同期される
    await addMemo(page, '圏外で追加');
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await serverTask(page, '圏外で追加'))?.status, { timeout: 10_000 }).toBe('todo');
  });
});

test.describe('Google 認証', () => {
  // Service Worker 経由のリクエストは page.route で横取りできないため、このグループでは無効化
  test.use({ serviceWorkers: 'block' });

  test('未ログインでは Google ログインだけが表示され、同意画面へ正しいパラメータで遷移する', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByTestId('login')).toBeVisible();
    await expect(page.getByTestId('login').locator('button')).toHaveCount(1);
    await expect(page.getByTestId('google-login')).toHaveText('Googleでログイン');

    // ボタンを押すと /auth/google へ遷移する（Google 本体はこの検証環境から到達できないため、遷移の発生までを確認）
    const nav = page.waitForRequest((r) => new URL(r.url()).pathname === '/auth/google' && r.isNavigationRequest());
    await page.route('**/auth/google', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
    await page.getByTestId('google-login').click();
    await nav;

    // /auth/google の 302 応答を直接検証：Google 同意画面への URL と state Cookie
    const res = await context.request.get('/auth/google', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const u = new URL(res.headers()['location']!);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe('local-test-client.apps.googleusercontent.com');
    expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:8790/auth/callback');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe('openid email profile');
    const state = u.searchParams.get('state') ?? '';
    expect(state.length).toBeGreaterThanOrEqual(24);

    const setCookie = res.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain(`gt_oauth_state=${state}`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });

  test('state が一致しないコールバックは拒否され、ログインされない', async ({ page }) => {
    await page.goto('/auth/callback?code=fake&state=forged');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('toast')).toHaveText('ログインできませんでした：もう一度ログインしてください');
    await expect(page.getByTestId('login')).toBeVisible();
    const me = await page.request.get('/api/me');
    expect(me.status()).toBe(401);
  });

  test('API は未ログインで 401、カスタムヘッダーのない書き込みは 403、テスト用ログインは localhost 以外で無効', async ({ request }) => {
    expect((await request.get('/api/tasks')).status()).toBe(401);
    const put = await request.put('/api/tasks/abcdefgh-0001', {
      data: { title: 'x', status: 'todo', createdAt: Date.now(), updatedAt: Date.now() },
    });
    expect(put.status()).toBe(403);
    const foreign = await request.get('/auth/dev-login?u=evil', { headers: { host: 'tasks.example.com' }, maxRedirects: 0 });
    expect(foreign.status()).toBe(404);
  });

  test('他人のタスク ID は上書きできない', async ({ page, browser }) => {
    await login(page);
    await addMemo(page, 'Aさんのタスク');
    await expect.poll(async () => (await serverTask(page, 'Aさんのタスク'))?.id).toBeTruthy();
    const id = (await serverTask(page, 'Aさんのタスク'))!.id;

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await login(p2);
    const res = await p2.request.put(`/api/tasks/${id}`, {
      headers: { 'x-gt': '1' },
      data: { title: '乗っ取り', status: 'done', createdAt: Date.now(), updatedAt: Date.now() + 10_000 },
    });
    expect(res.status()).toBe(403);
    expect((await serverTasks(p2)).length).toBe(0);
    await other.close();

    expect((await serverTask(page, 'Aさんのタスク'))?.status).toBe('todo');
  });

  test('ログイン前に書いたメモは、ログイン後にそのアカウントへ同期される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login')).toBeVisible();
    await addMemo(page, 'ログイン前のメモ');
    const u = await login(page);
    await expect(taskByTitle(page, 'ログイン前のメモ')).toBeVisible();
    await expect.poll(async () => (await serverTask(page, 'ログイン前のメモ'))?.status).toBe('todo');
    expect(u).toBeTruthy();
  });

  test('ログアウトするとセッションもローカルのデータも消える', async ({ page }) => {
    await login(page);
    await addMemo(page, '消えるべきデータ');
    await page.getByTestId('avatar').click();
    await expect(page.getByTestId('menu')).toBeVisible();
    await expect(page.getByTestId('menu-email')).toContainText('@example.com');
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('login')).toBeVisible();
    await expect(page.getByTestId('task')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('login')).toBeVisible();
    await expect(page.getByTestId('task')).toHaveCount(0);
    expect((await page.request.get('/api/me')).status()).toBe(401);
  });
});

test.describe('フリックでステータス管理', () => {
  test('右フリックで 未着手→進行中→完了、左フリックで戻る（サーバーにも保存）', async ({ page }) => {
    await login(page);
    await addMemo(page, 'フリック対象');
    const card = taskByTitle(page, 'フリック対象');
    await expect(card).toHaveAttribute('data-status', 'todo');

    await flick(page, card, 220);
    await expect(card).toHaveAttribute('data-status', 'doing');
    await expect.poll(async () => (await serverTask(page, 'フリック対象'))?.status).toBe('doing');

    await flick(page, card, 220);
    await expect(card).toHaveAttribute('data-status', 'done');
    await expect.poll(async () => (await serverTask(page, 'フリック対象'))?.status).toBe('done');

    await flick(page, card, 220); // 完了の先はない：ゴムのように戻るだけ
    await expect(card).toHaveAttribute('data-status', 'done');

    await flick(page, card, -220);
    await expect(card).toHaveAttribute('data-status', 'doing');
    await flick(page, card, -220);
    await expect(card).toHaveAttribute('data-status', 'todo');
    await expect.poll(async () => (await serverTask(page, 'フリック対象'))?.status).toBe('todo');

    await flick(page, card, -220); // 未着手より前はない
    await expect(card).toHaveAttribute('data-status', 'todo');
  });

  test('ゆっくり小さく動かしただけではステータスは変わらない', async ({ page }) => {
    await login(page);
    await addMemo(page, 'ちょっとだけ動かす');
    const card = taskByTitle(page, 'ちょっとだけ動かす');
    await flick(page, card, 60, { duration: 900, steps: 20 });
    await expect(card).toHaveAttribute('data-status', 'todo');
    await expect(card.locator('.task')).toHaveCSS('transform', /none|matrix\(1, 0, 0, 1, 0, 0\)/);
  });

  test('素早いフリックなら短い距離でも確定する', async ({ page }) => {
    await login(page);
    await addMemo(page, 'さっとフリック');
    const card = taskByTitle(page, 'さっとフリック');
    const width = (await card.boundingBox())!.width;
    const dx = Math.round(width * 0.25); // 確定距離（30%）未満
    await flick(page, card, dx, { duration: 70, steps: 6 }); // 約 1.3px/ms：実機の素早いフリック相当
    await expect(card).toHaveAttribute('data-status', 'doing');
  });

  test('縦方向のスワイプ（スクロール）ではステータスは変わらない', async ({ page }) => {
    await login(page);
    await addMemo(page, '縦に触る');
    const card = taskByTitle(page, '縦に触る');
    await flick(page, card, 30, { dy: 160, duration: 200 });
    await expect(card).toHaveAttribute('data-status', 'todo');
  });

  test('フィルタ中にフリックすると、カードがアニメーションして一覧から抜け件数も更新される', async ({ page }) => {
    await login(page);
    await addMemo(page, '残るタスク');
    await addMemo(page, '進めるタスク');
    await page.getByTestId('tab-todo').click();
    await expect(page.getByTestId('tab-todo')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('count-todo')).toHaveText('2');

    await flick(page, taskByTitle(page, '進めるタスク'), 220);
    await expect(taskByTitle(page, '進めるタスク')).toHaveCount(0);
    await expect(taskByTitle(page, '残るタスク')).toBeVisible();
    await expect(page.getByTestId('count-todo')).toHaveText('1');
    await expect(page.getByTestId('count-doing')).toHaveText('1');

    await page.getByTestId('tab-doing').click();
    await expect(taskByTitle(page, '進めるタスク')).toHaveAttribute('data-status', 'doing');
    await expect(taskByTitle(page, '残るタスク')).toHaveCount(0);
  });
});

test.describe('タスクの操作', () => {
  test('タップで詳細シート：タイトル・メモ・ステータスを編集して保存できる', async ({ page }) => {
    await login(page);
    await addMemo(page, '編集前');
    await taskByTitle(page, '編集前').locator('.task').click();
    const sheet = page.getByTestId('task-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveClass(/open/);

    await page.getByTestId('sheet-title').fill('編集後');
    await page.getByTestId('sheet-note').fill('詳細メモ');
    await page.getByTestId('sheet-status-done').click();
    await expect(page.getByTestId('sheet-status-done')).toHaveAttribute('aria-pressed', 'true');

    await page.mouse.click(200, 60); // 背景タップで閉じる
    await expect(sheet).toHaveCount(0);
    const card = taskByTitle(page, '編集後');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-status', 'done');
    await expect.poll(async () => {
      const t = await serverTask(page, '編集後');
      return t && `${t.status}/${t.note}`;
    }).toBe('done/詳細メモ');
  });

  test('削除 → 元に戻す → 再削除がサーバーにも反映される', async ({ page }) => {
    await login(page);
    await addMemo(page, '消すタスク');
    await expect.poll(async () => !!(await serverTask(page, '消すタスク'))).toBe(true);

    await taskByTitle(page, '消すタスク').locator('.task').click();
    await page.getByTestId('sheet-delete').click();
    await expect(taskByTitle(page, '消すタスク')).toHaveCount(0);
    await expect(page.getByTestId('toast')).toContainText('削除しました');
    await expect.poll(async () => !!(await serverTask(page, '消すタスク'))).toBe(false);

    await page.getByTestId('toast-action').click();
    await expect(taskByTitle(page, '消すタスク')).toBeVisible();
    await expect.poll(async () => !!(await serverTask(page, '消すタスク'))).toBe(true);

    await taskByTitle(page, '消すタスク').locator('.task').click();
    await page.getByTestId('sheet-delete').click();
    await expect(taskByTitle(page, '消すタスク')).toHaveCount(0);
    await expect.poll(async () => !!(await serverTask(page, '消すタスク'))).toBe(false);
  });

  test('日本語変換中の Enter では追加されず、確定後の Enter で追加される', async ({ page }) => {
    await login(page);
    const input = page.getByTestId('composer-input');
    await input.fill('へんかんちゅう');
    await input.evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true }));
    });
    await expect(input).toHaveValue('へんかんちゅう');
    await expect(page.getByTestId('task')).toHaveCount(0);
    await input.press('Enter');
    await expect(taskByTitle(page, 'へんかんちゅう')).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused(); // 続けて書ける
  });

  test('追加ボタンは入力があるときだけ現れ、押しても入力欄のフォーカスが外れない', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('send')).toHaveCount(0);
    const input = page.getByTestId('composer-input');
    await input.fill('ボタンで追加');
    await page.getByTestId('send').click();
    await expect(taskByTitle(page, 'ボタンで追加')).toBeVisible();
    await expect(input).toBeFocused();
    await expect(page.getByTestId('send')).toHaveCount(0);
  });
});

test.describe('Workers AI 連携', () => {
  test('AI で音声入力風のメモを複数タスクに分割する', async ({ page }) => {
    await login(page);
    const input = page.getByTestId('composer-input');
    await input.fill('牛乳を買う、メールを返信する、資料を作る');
    await page.getByTestId('ai-split').click();
    await expect(page.getByTestId('toast')).toHaveText('3件のタスクにしました');
    await expect(input).toHaveValue('');
    const titles = page.getByTestId('task-title');
    await expect(titles).toHaveText(['牛乳を買う', 'メールを返信する', '資料を作る']);
    await expect.poll(async () => (await serverTasks(page)).length).toBe(3);
  });

  test('詳細シートの「AIで分解」でサブタスクを追加する', async ({ page }) => {
    await login(page);
    await addMemo(page, 'プレゼン');
    await taskByTitle(page, 'プレゼン').locator('.task').click();
    await page.getByTestId('sheet-ai').click();
    await expect(page.getByTestId('task-sheet')).toHaveCount(0);
    await expect(page.getByTestId('toast')).toHaveText('3件に分解しました');
    await expect(taskByTitle(page, 'プレゼンの準備をする')).toBeVisible();
    await expect(taskByTitle(page, 'プレゼンを進める')).toBeVisible();
    await expect(taskByTitle(page, 'プレゼンを見直す')).toBeVisible();
  });

  test('未ログインでは AI を使わずに案内だけ出し、入力は消さない', async ({ page }) => {
    await page.goto('/');
    const input = page.getByTestId('composer-input');
    await input.fill('a、b');
    await page.getByTestId('ai-split').click();
    await expect(page.getByTestId('toast')).toHaveText('AIはログイン後に使えます');
    await expect(input).toHaveValue('a、b');
    await expect(page.getByTestId('task')).toHaveCount(0);
  });

  test('AI API は入力の検証をする（空・長すぎる）', async ({ page }) => {
    await login(page);
    const empty = await page.request.post('/api/ai/tasks', { headers: { 'x-gt': '1' }, data: { text: '  ' } });
    expect(empty.status()).toBe(400);
    const long = await page.request.post('/api/ai/tasks', { headers: { 'x-gt': '1' }, data: { text: 'あ'.repeat(2001) } });
    expect(long.status()).toBe(413);
  });
});

test.describe('PWA・デザイン・レイアウト', () => {
  test('ホーム画面追加に必要なメタ情報・マニフェスト・アイコンが揃っている', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const src of ['/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png']) {
      const r = await page.request.get(src);
      expect(r.status(), src).toBe(200);
      expect(r.headers()['content-type']).toBe('image/png');
    }
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBe(true);
  });

  test('余計な文言がない：ログイン画面の本文は「Googleでログイン」だけ', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login')).toBeVisible();
    expect((await page.getByTestId('list').innerText()).trim()).toBe('Googleでログイン');
    await expect(page.getByTestId('composer-input')).toHaveAttribute('placeholder', 'メモ');
  });

  for (const width of [320, 375, 393, 430]) {
    test(`幅 ${width}px で横スクロールが発生せず、長いタイトルも折り返す`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await login(page);
      await addMemo(page, '長いタイトルの例：来週の定例までに見積もり資料の数字を最新化して経理チームに確認依頼を出す');
      await addMemo(page, 'URLのように切れない文字列abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz');
      await addMemo(page, '牛乳');
      await flick(page, taskByTitle(page, '牛乳'), 200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      const tabs = await page.getByTestId('tabs').boundingBox();
      expect(tabs!.x + tabs!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/screens/list-${width}.png` });
    });
  }

  test('ガラス素材（backdrop-filter）とアニメーションが適用されている', async ({ page }) => {
    await login(page);
    await addMemo(page, 'ガラス');
    const card = taskByTitle(page, 'ガラス').locator('.task');
    const bf = await card.evaluate((el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).getPropertyValue('-webkit-backdrop-filter'));
    expect(bf).toContain('blur');
    // 追加時のアニメーションと、背景の光がゆっくり動いていること
    const animating = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? 'waapi'));
    expect(animating).toEqual(expect.arrayContaining(['drift1', 'drift2', 'drift3']));
  });

  test('一連の操作でページエラー・コンソールエラーが出ない', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/401|Unauthorized/.test(m.text())) errors.push(m.text());
    });
    await login(page, uid());
    await addMemo(page, 'エラー監視');
    await flick(page, taskByTitle(page, 'エラー監視'), 220);
    await taskByTitle(page, 'エラー監視').locator('.task').click();
    await page.getByTestId('sheet-status-done').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('tab-done').click();
    await page.getByTestId('tab-all').click();
    expect(errors).toEqual([]);
  });
});
