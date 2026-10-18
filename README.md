# tasks

iPhone のホーム画面から開いた瞬間にメモでき、カードを左右にフリックしてステータスを動かすタスク管理アプリ（PWA）。
白ベースの Liquid Glass UI、Cloudflare Workers + D1 + Workers AI、Google ログインのみ。

| 操作 | 動き |
| --- | --- |
| 開く | 全画面スケルトンと入力欄が JS より先に出る。打ち始めた文字はそのまま引き継がれる |
| 入力して Enter / ↑ | 未着手として一番上に追加（日本語変換中の Enter では追加しない） |
| ✦ ボタン | Workers AI が走り書き・音声入力のメモを複数のタスクに分割 |
| 右フリック | 未着手 → 進行中 → 完了 |
| 左フリック | 完了 → 進行中 → 未着手 |
| タップ | 詳細シート（タイトル・メモ編集、ステータス、AIで分解、削除＋元に戻す） |

---

## 技術選定と理由

### 形式：ネイティブアプリではなく PWA
- **ブラウザで実機同等のテストを自動化できる**（Playwright でタッチフリックまで検証）。ネイティブ（SwiftUI）は Mac + Xcode でしかビルド・テストできない。
- **Cloudflare だけで完結**する。App Store 審査・Apple Developer 登録（年額）が不要で、デプロイした瞬間に全員が最新版になる。
- Safari の「ホーム画面に追加」で全画面のアプリとして起動し、Service Worker により 2 回目以降は圏外でも一瞬で開く。
- トレードオフ：iOS 26 の本物の Liquid Glass マテリアルは使えないため CSS で再現（後述）。また iOS は**ユーザーのタップなしにキーボードを出すことを禁止**しているため、起動直後は「入力欄にフォーカス済み・タップ1回でキーボード」になる（PC では起動直後からそのまま打てる）。

### フロントエンド
| 技術 | 理由 |
| --- | --- |
| **React 19** | フリック・シート・リスト並べ替えなど状態とアニメーションが絡む UI を部品化しやすい。`useSyncExternalStore` で自前ストアと素直につなげられる |
| **アニメーションは外部ライブラリなし**（Web Animations API + CSS） | transform / opacity だけを動かし GPU 合成で 60fps を狙える。CSS `linear()` で本物のバネ曲線を表現でき、Framer Motion 等を入れるより軽い（JS 全体 gzip 約 70KB） |
| **esbuild**（Vite なし） | ビルドが一瞬で設定も少ない。CSS を index.html に**インライン化**して、JS 到着前にスケルトンと入力欄を描画するために自前ビルドスクリプトにした |
| **ローカル優先ストア**（localStorage + 送信キュー） | 「開いた瞬間メモ」の要。書いた瞬間に画面へ出し、送信は裏で。圏外・ログイン前に書いたメモも消えずに後で同期。競合は `updatedAt` による Last-Write-Wins |
| **Service Worker**（手書き） | アプリ本体をキャッシュし即起動。API と認証は絶対にキャッシュしない |
| **Liquid Glass を CSS で再現** | `backdrop-filter: blur() saturate()` の半透明層＋縁のスペキュラーハイライト＋触れた位置に光が集まる反射。白ベースでもガラスの屈折が見えるよう、背景に淡い色の光をゆっくり漂わせている |

アニメーション一覧：起動時のスケルトン（シマー）→ カードの順番フェードイン、追加時のバネ登場、フリック中の追従・傾き・行き先ステータスの色帯、確定時のバネ戻り＋光の波紋、並べ替えの FLIP 移動、フィルタから外れるカードの退場、タブインジケーターのバネ移動、ステータスアイコン（回転リング・チェックの描画）、完了時の取り消し線、シートのバネ開閉と下スワイプで閉じる、AI 処理中の虹色の縁、トースト。`prefers-reduced-motion` では無効化。iOS 18 以降は確定時に触覚フィードバックも鳴る。

### バックエンド（すべて Cloudflare）
| 技術 | 理由 |
| --- | --- |
| **Workers + Static Assets** | 画面と API を **1 つの Worker・同一オリジン**で配信。CORS 不要で Cookie 認証が単純になり、東京のエッジから返るので速い。`/api/*` `/auth/*` だけ Worker を通し、静的ファイルは Worker を起動せず配信（無料枠に優しい） |
| **D1**（SQLite） | ユーザー・セッション・タスクの単純なリレーションに最適。Workers から直接バインディングで呼べ、無料枠が大きい |
| **Workers AI**：`@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI の **JSON Mode（json_schema 指定）対応モデル**で、日本語の分割・要約の精度が 8B 系より安定。出力の揺れも吸収するパーサー付き。安くしたい場合は `wrangler.jsonc` の `AI_MODEL` を `@cf/meta/llama-3.1-8b-instruct` に変更 |
| **フレームワークなし（Hono 等不使用）** | ルートが十数行で収まる規模なので、依存ゼロの方が保守と脆弱性対応が楽 |

### 認証：Google OAuth 2.0（認可コードフロー）を Worker で直接実装
- Google ボタンのみ。リダイレクト方式なので、ポップアップが不安定な **iOS のホーム画面アプリでも動く**。
- `state` を HttpOnly Cookie と照合（CSRF 対策）→ code をトークンに交換 → ID トークンの `iss` / `aud` / `exp` / `email_verified` を検証。
- セッションは 60 日。Cookie にはランダム値、D1 には SHA-256 ハッシュのみ保存（DB が漏れてもセッションを乗っ取れない）。`HttpOnly; Secure; SameSite=Lax`。
- 書き込み API はカスタムヘッダー `x-gt: 1` 必須（他サイトからの偽リクエストを遮断）。他人のタスク ID は上書き不可。
- 認証ライブラリを使わないのは、依存を増やさず Workers ランタイムで確実に動かすため。

### テスト：Playwright
iPhone 15 Pro 相当（393×852・タッチ・モバイル UA）で、**CDP の本物のタッチイベント**を使ってフリックまで検証する 30 本の E2E テスト（`tests/app.spec.ts`）。
テスト時は `scripts/local-server.mjs` が本番と同じ `worker/index.ts` を読み込み、D1 を Node 組み込み SQLite で、Workers AI を決定的なモックで置き換える。

---

## セットアップ

必要なもの：Node.js 22.13 以上、Cloudflare アカウント、Google アカウント。

```bash
npm install
npx playwright install chromium   # テストを回す場合
npm test                          # ビルド → E2E テスト 30 本
npm run local                     # http://localhost:8788 （/auth/dev-login でログイン、AI はモック）
```

### 1. Google OAuth クライアントを作る
1. [Google Cloud Console](https://console.cloud.google.com/) で新しいプロジェクトを作成
2. 「API とサービス」→「OAuth 同意画面」（Google Auth Platform）
   - ユーザーの種類：**外部**、アプリ名・サポートメールを入力
   - スコープ：`openid` `email` `profile`（機密スコープではないので審査不要）
   - 公開ステータスを「本番環境」にすると誰でもログイン可能（テスト中はテストユーザーに自分を追加）
3. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - 種類：**ウェブ アプリケーション**
   - 承認済みのリダイレクト URI：
     - `https://tasks.<あなたのサブドメイン>.workers.dev/auth/callback`
     - `http://localhost:8787/auth/callback`（`npm run dev` 用）
4. 表示された **クライアント ID** と **クライアント シークレット** を控える

### 2. Cloudflare にデプロイ
```bash
npx wrangler login
npx wrangler d1 create tasks
#   → 出力された database_id を wrangler.jsonc の "database_id" に貼る
#   → wrangler.jsonc の GOOGLE_CLIENT_ID に手順1のクライアント ID を貼る
npm run db:migrate:remote
npx wrangler secret put GOOGLE_CLIENT_SECRET   # 手順1のシークレットを貼る
npx wrangler secret put ALLOWED_EMAILS         # 自分専用にする：ログインを許すGmailを入力（複数ならカンマ区切り）
npm run deploy
```
表示された `https://tasks.<サブドメイン>.workers.dev` を開けば完成。初回デプロイ後に URL が確定したら、手順1のリダイレクト URI と一致しているか確認してください（独自ドメインを付けた場合はそのドメインの `/auth/callback` も追加）。

### 3. iPhone に入れる
Safari で URL を開く → 共有ボタン →「ホーム画面に追加」。

### ローカルで本物のランタイムを使う
```bash
cp .dev.vars.example .dev.vars        # GOOGLE_CLIENT_SECRET を記入
npm run db:migrate:local
npm run dev                            # wrangler dev（http://localhost:8787）
```
Workers AI はローカルでもリモート実行（Cloudflare ログインが必要・課金対象）。AI を呼ばずに試すなら `.dev.vars` に `AI_MOCK=true`。

### GitHub で公開
```bash
# このフォルダは初期コミット済みの git リポジトリです
gh repo create tasks --public --source=. --push
# gh を使わない場合：GitHub で空の公開リポジトリを作成してから
git remote add origin https://github.com/<you>/tasks.git
git push -u origin main
```
push すると GitHub Actions（`.github/workflows/e2e.yml`）が E2E テストを自動実行します。

---

## 構成
```
src/                フロントエンド（React）
  index.html        起動直後のスケルトン＋本物の入力欄（CSS はビルド時にインライン化）
  styles.css        Liquid Glass・アニメーション
  lib/store.ts      ローカル優先ストア（キャッシュ・送信キュー・同期）
  components/       Composer（即メモ）/ TaskItem（フリック）/ TaskList（FLIP）/ Sheet ほか
  sw.js             Service Worker
worker/             Cloudflare Worker（API・Google 認証・Workers AI）
migrations/         D1 スキーマ
scripts/            ビルド・アイコン生成・テスト用ローカルサーバー
tests/              Playwright E2E
```

## ライセンス
MIT
