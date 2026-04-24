-- 알림 기본설정 계정단위 동기화
-- 작성일: 2026-04-24
-- 역할: 기본알림/할일 전역 알림 기본값을 사용자 계정 단위로 저장

CREATE TABLE IF NOT EXISTS ma_user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ma_user_settings_updated_at
  ON ma_user_settings(updated_at DESC);

ALTER TABLE ma_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own ma_user_settings" ON ma_user_settings;
CREATE POLICY "Users can CRUD their own ma_user_settings"
  ON ma_user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_ma_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ma_user_settings ON ma_user_settings;
CREATE TRIGGER trigger_update_ma_user_settings
  BEFORE UPDATE ON ma_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_ma_user_settings_updated_at();
