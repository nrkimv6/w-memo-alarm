-- 010_todo_urls_and_pung.sql
-- Todo URL 속성 추가 + Pung(자동삭제) 기능
-- 날짜: 2026-02-10

-- Todo URL 목록 컬럼 추가 (JSONB)
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_urls JSONB DEFAULT '[]'::jsonb;

-- Todo URL 존재 여부 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_todo_urls_exists
  ON ma_memos ((todo_urls IS NOT NULL AND todo_urls != '[]'::jsonb))
  WHERE is_active = true;

-- Pung(자동삭제) 설정 컬럼 추가
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS auto_pung BOOLEAN DEFAULT false;
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS pung_delay INTEGER DEFAULT 0;

-- Pung 활성화 할일 인덱스 (기한 초과 체크용)
CREATE INDEX IF NOT EXISTS idx_ma_memos_auto_pung
  ON ma_memos (auto_pung, todo_status, due_date)
  WHERE auto_pung = true AND is_active = true;
