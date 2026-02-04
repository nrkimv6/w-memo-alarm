-- 알림 발송 내역 테이블
-- 작성일: 2026-02-04
-- PRD: docs/plan/2026-02-03_notification-history-prd.md

-- ============================================
-- 1. ma_notification_history 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS ma_notification_history (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memo_id TEXT NOT NULL,
  memo_title TEXT NOT NULL,
  reminder_id TEXT,
  reminder_type TEXT CHECK (reminder_type IN ('default', 'additional')),
  channel TEXT NOT NULL CHECK (channel IN ('sw-push', 'capacitor-local', 'fcm-push')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'unknown')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,

  -- 버전 관리 (충돌 감지용)
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ma_noti_hist_user_id ON ma_notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ma_noti_hist_sent_at ON ma_notification_history(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ma_noti_hist_status ON ma_notification_history(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ma_noti_hist_memo_id ON ma_notification_history(user_id, memo_id);

-- ============================================
-- 3. RLS 정책
-- ============================================

ALTER TABLE ma_notification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own notification history" ON ma_notification_history;
CREATE POLICY "Users can CRUD their own notification history"
  ON ma_notification_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. updated_at + version 자동 업데이트
-- ============================================

CREATE OR REPLACE FUNCTION update_ma_notification_history_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ma_notification_history ON ma_notification_history;
CREATE TRIGGER trigger_update_ma_notification_history
  BEFORE UPDATE ON ma_notification_history
  FOR EACH ROW
  EXECUTE FUNCTION update_ma_notification_history_metadata();
