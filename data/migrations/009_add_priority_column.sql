-- 009_add_priority_column.sql
-- priority 컬럼 추가 (타입 정의와 DB 동기화)
-- 날짜: 2026-02-10

-- priority 컬럼 추가 (TEXT)
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS priority TEXT;
