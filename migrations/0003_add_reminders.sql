-- 메모:알림 1:N 관계 지원을 위한 reminders 컬럼 추가
-- Supabase (PostgreSQL)에서 실행

-- 1. reminders 컬럼 추가 (JSONB 배열)
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS reminders JSONB;

-- 2. 기존 단일 reminder 데이터를 reminders 배열로 마이그레이션
UPDATE ma_memos
SET reminders = jsonb_build_array(
  reminder::jsonb || jsonb_build_object(
    'id', 'rem_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 7),
    'isDefault', true
  )
)
WHERE reminder IS NOT NULL
  AND reminder != 'null'
  AND reminder != ''
  AND reminders IS NULL;

-- 3. 마이그레이션 후 기존 reminder 컬럼은 유지 (하위 호환성)
-- 향후 충분한 시간이 지나면 reminder 컬럼 제거 가능
