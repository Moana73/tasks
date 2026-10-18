-- カナダワーホリ準備チェックリストのチェック状態。
-- 項目そのもの（文言・セクション・期日）はフロントエンドの src/lib/canadaChecklist.ts に定義し、
-- ここにはユーザーごとに「デフォルトと違う状態にした項目」の checked / updated_at だけを持つ。
CREATE TABLE IF NOT EXISTS checklist_checks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
