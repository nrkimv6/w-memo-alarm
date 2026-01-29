-- ============================================
-- memo-alarm Prefix 적용 (ma_)
-- 작성일: 2026-01-29
-- ============================================

-- 1. 테이블 이름 변경
ALTER TABLE IF EXISTS memos RENAME TO ma_memos;
ALTER TABLE IF EXISTS folders RENAME TO ma_folders;
ALTER TABLE IF EXISTS alarm_schedules RENAME TO ma_alarm_schedules;
ALTER TABLE IF EXISTS user_devices RENAME TO ma_user_devices;

-- 2. 인덱스 이름 변경 (memos)
ALTER INDEX IF EXISTS idx_memos_user_id RENAME TO idx_ma_memos_user_id;
ALTER INDEX IF EXISTS idx_memos_created_at RENAME TO idx_ma_memos_created_at;
ALTER INDEX IF EXISTS idx_memos_updated_at RENAME TO idx_ma_memos_updated_at;
ALTER INDEX IF EXISTS idx_memos_folder_id RENAME TO idx_ma_memos_folder_id;
ALTER INDEX IF EXISTS idx_memos_tags RENAME TO idx_ma_memos_tags;

-- 3. 인덱스 이름 변경 (folders)
ALTER INDEX IF EXISTS idx_folders_user_id RENAME TO idx_ma_folders_user_id;

-- 4. 인덱스 이름 변경 (alarm_schedules) - line-minder와 별도
ALTER INDEX IF EXISTS idx_alarm_schedules_time RENAME TO idx_ma_alarm_schedules_time;
ALTER INDEX IF EXISTS idx_alarm_schedules_user RENAME TO idx_ma_alarm_schedules_user;
ALTER INDEX IF EXISTS idx_alarm_schedules_target_date RENAME TO idx_ma_alarm_schedules_target_date;

-- 5. 인덱스 이름 변경 (user_devices) - line-minder와 별도
ALTER INDEX IF EXISTS idx_user_devices_user_app RENAME TO idx_ma_user_devices_user_app;
ALTER INDEX IF EXISTS idx_user_devices_active RENAME TO idx_ma_user_devices_active;

-- 6. 트리거/함수 이름 변경
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

DROP TRIGGER IF EXISTS update_user_devices_updated_at ON ma_user_devices;
CREATE TRIGGER update_ma_user_devices_updated_at
  BEFORE UPDATE ON ma_user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alarm_schedules_updated_at ON ma_alarm_schedules;
CREATE TRIGGER update_ma_alarm_schedules_updated_at
  BEFORE UPDATE ON ma_alarm_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS 정책 이름 변경
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

-- alarm_schedules RLS 정책
DROP POLICY IF EXISTS "Users can view their own schedules" ON ma_alarm_schedules;
DROP POLICY IF EXISTS "Users can insert their own schedules" ON ma_alarm_schedules;
DROP POLICY IF EXISTS "Users can update their own schedules" ON ma_alarm_schedules;
DROP POLICY IF EXISTS "Users can delete their own schedules" ON ma_alarm_schedules;
DROP POLICY IF EXISTS "Service role can access all schedules" ON ma_alarm_schedules;

CREATE POLICY "Users can view their own ma_alarm_schedules" ON ma_alarm_schedules
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own ma_alarm_schedules" ON ma_alarm_schedules
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own ma_alarm_schedules" ON ma_alarm_schedules
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own ma_alarm_schedules" ON ma_alarm_schedules
  FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "Service role can access all ma_alarm_schedules" ON ma_alarm_schedules
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- user_devices RLS 정책
DROP POLICY IF EXISTS "Users can view their own devices" ON ma_user_devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON ma_user_devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON ma_user_devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON ma_user_devices;
DROP POLICY IF EXISTS "Service role can access all devices" ON ma_user_devices;

CREATE POLICY "Users can view their own ma_user_devices" ON ma_user_devices
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own ma_user_devices" ON ma_user_devices
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own ma_user_devices" ON ma_user_devices
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own ma_user_devices" ON ma_user_devices
  FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "Service role can access all ma_user_devices" ON ma_user_devices
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- 완료
-- ============================================
