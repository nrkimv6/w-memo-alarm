-- ============================================
-- memo-alarm Prefix 적용 (ma_) - 프로젝트 전용 테이블만
-- 작성일: 2026-01-29
-- ============================================

-- 1. 테이블 이름 변경
ALTER TABLE IF EXISTS memos RENAME TO ma_memos;
ALTER TABLE IF EXISTS folders RENAME TO ma_folders;

-- 2. 인덱스 이름 변경 (memos)
ALTER INDEX IF EXISTS idx_memos_user_id RENAME TO idx_ma_memos_user_id;
ALTER INDEX IF EXISTS idx_memos_created_at RENAME TO idx_ma_memos_created_at;
ALTER INDEX IF EXISTS idx_memos_updated_at RENAME TO idx_ma_memos_updated_at;
ALTER INDEX IF EXISTS idx_memos_folder_id RENAME TO idx_ma_memos_folder_id;
ALTER INDEX IF EXISTS idx_memos_tags RENAME TO idx_ma_memos_tags;

-- 3. 인덱스 이름 변경 (folders)
ALTER INDEX IF EXISTS idx_folders_user_id RENAME TO idx_ma_folders_user_id;

-- 4. 트리거 이름 변경
DROP TRIGGER IF EXISTS update_memos_metadata_trigger ON ma_memos;

DROP FUNCTION IF EXISTS update_memos_metadata() CASCADE;
CREATE OR REPLACE FUNCTION update_ma_memos_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ma_memos_metadata_trigger
  BEFORE UPDATE ON ma_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_ma_memos_metadata();

-- 5. RLS 정책 이름 변경
DROP POLICY IF EXISTS "Users can CRUD their own memos" ON ma_memos;
CREATE POLICY "Users can CRUD their own ma_memos"
  ON ma_memos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD their own folders" ON ma_folders;
CREATE POLICY "Users can CRUD their own ma_folders"
  ON ma_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 완료
-- ============================================
