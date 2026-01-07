-- Push Subscriptions 테이블
-- Phase P2: Web Push 알림 발송을 위한 구독 정보 저장

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  alarm_time TEXT DEFAULT '09:00',
  notify_days TEXT DEFAULT '[0,1,2,3,4,5,6]',  -- JSON array (0=일, 6=토)
  timezone TEXT DEFAULT 'Asia/Seoul',
  last_sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_alarm_time ON push_subscriptions(alarm_time);
