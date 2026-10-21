-- カナダ準備チェックリストの各項目に「結果メモ」（完了にしたときに書く、何をどうしたかの記録）を持たせる
ALTER TABLE checklist_checks ADD COLUMN note TEXT NOT NULL DEFAULT '';
