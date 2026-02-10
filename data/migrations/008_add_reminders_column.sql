-- 008_add_reminders_column.sql
-- 알람 1:N 지원을 위한 reminders 컬럼 추가
-- 날짜: 2026-02-10

-- 1. reminders 컬럼 추가 (JSONB)
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS reminders JSONB;

-- 2. 기존 reminder (단수, JSONB) 데이터를 reminders (복수) 배열로 마이그레이션
-- reminder가 유효한 JSONB 객체인 경우에만 변환
UPDATE ma_memos
SET reminders = jsonb_build_array(
  reminder || jsonb_build_object(
    'id', 'rem_' || extract(epoch from now())::text || '_' || substring(md5(random()::text) from 1 for 6),
    'isDefault', true
  )
)
WHERE reminders IS NULL
  AND reminder IS NOT NULL
  AND jsonb_typeof(reminder) = 'object';

-- 3. 인덱스 추가 (알림 조회 성능)
CREATE INDEX IF NOT EXISTS idx_ma_memos_reminders ON ma_memos USING gin(reminders);
