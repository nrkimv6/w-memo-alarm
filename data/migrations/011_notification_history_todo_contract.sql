-- notification_history todo contract 확장
-- 작성일: 2026-04-24
-- 역할: 006_notification_history.sql의 CHECK 제약을 확장하여 todo SW 알림 기록을 허용
--
-- 006은 CREATE TABLE DDL + 초기 제약 정의.
-- 011은 해당 제약을 넓히는 ALTER만 수행. 기존 row는 rewrite하지 않음.
--
-- 실행 순서: impl 단계에서 파일 추가, main 머지 후 running DB에 직접 적용 (Phase Z)

-- ============================================================
-- 1. reminder_type CHECK 확장
--    기존: ('default', 'additional')
--    신규: + ('todo-remind', 'todo-alert', 'todo-overdue')
-- ============================================================

ALTER TABLE ma_notification_history
  DROP CONSTRAINT IF EXISTS ma_notification_history_reminder_type_check;

ALTER TABLE ma_notification_history
  ADD CONSTRAINT ma_notification_history_reminder_type_check
    CHECK (reminder_type IN (
      'default',
      'additional',
      'todo-remind',
      'todo-alert',
      'todo-overdue'
    ));

-- ============================================================
-- 2. channel CHECK 확장
--    기존: ('sw-push', 'capacitor-local', 'fcm-push')
--    신규: + ('sw-todo')
-- ============================================================

ALTER TABLE ma_notification_history
  DROP CONSTRAINT IF EXISTS ma_notification_history_channel_check;

ALTER TABLE ma_notification_history
  ADD CONSTRAINT ma_notification_history_channel_check
    CHECK (channel IN (
      'sw-push',
      'sw-todo',
      'capacitor-local',
      'fcm-push'
    ));
