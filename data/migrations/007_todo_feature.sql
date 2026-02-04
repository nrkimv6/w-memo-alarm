-- Todo/할일 기능 추가
-- 작성일: 2026-02-04
-- PRD: docs/prd/2026-02-04_todo-note-prd.md
-- Plan: docs/plan/todo-feature/

-- ============================================
-- 1. ma_memos 테이블에 Todo 컬럼 추가
-- ============================================

-- Todo 전용 필드
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_status TEXT CHECK (todo_status IN ('pending', 'completed', 'skipped'));
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_priority TEXT CHECK (todo_priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS due_time TEXT; -- HH:mm 형식
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_timing JSONB; -- TodoTiming 구조
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Phase 3: 반복 할일
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS recurrence JSONB; -- Recurrence 구조
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_instances JSONB; -- TodoInstance[] 배열

-- Phase 2: 미루기
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS postpone_info JSONB; -- PostponeInfo 구조

-- Phase 4: 그룹
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_group_id TEXT;

-- ============================================
-- 2. ma_todo_groups 테이블 생성 (Phase 4용)
-- ============================================

CREATE TABLE IF NOT EXISTS ma_todo_groups (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  description TEXT,
  order_index INTEGER DEFAULT 0,

  -- 버전 관리 (충돌 감지용)
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 인덱스 생성
-- ============================================

-- Todo 상태 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_todo_status
  ON ma_memos(user_id, todo_status)
  WHERE memo_type = 'todo';

-- 기한 날짜 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_due_date
  ON ma_memos(user_id, due_date)
  WHERE memo_type = 'todo';

-- 기한 날짜 + 시간 조합 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_due_datetime
  ON ma_memos(user_id, due_date, due_time)
  WHERE memo_type = 'todo' AND todo_status = 'pending';

-- Todo 우선순위 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_todo_priority
  ON ma_memos(user_id, todo_priority)
  WHERE memo_type = 'todo';

-- Todo 그룹 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_todo_group
  ON ma_memos(user_id, todo_group_id)
  WHERE memo_type = 'todo';

-- TodoGroup 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_todo_groups_user_id
  ON ma_todo_groups(user_id);

CREATE INDEX IF NOT EXISTS idx_ma_todo_groups_order
  ON ma_todo_groups(user_id, order_index);

-- ============================================
-- 4. RLS 정책 (ma_todo_groups)
-- ============================================

ALTER TABLE ma_todo_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own todo groups" ON ma_todo_groups;
CREATE POLICY "Users can CRUD their own todo groups"
  ON ma_todo_groups FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. updated_at + version 자동 업데이트 (ma_todo_groups)
-- ============================================

CREATE OR REPLACE FUNCTION update_ma_todo_groups_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ma_todo_groups ON ma_todo_groups;
CREATE TRIGGER trigger_update_ma_todo_groups
  BEFORE UPDATE ON ma_todo_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_ma_todo_groups_metadata();

-- ============================================
-- 6. 기본 TodoTiming 값 설정 (기존 레코드 호환)
-- ============================================

-- 기존 memo_type='todo'인 레코드에 기본 TodoTiming 설정
UPDATE ma_memos
SET todo_timing = jsonb_build_object(
  'useGlobalRemind', true,
  'remindTimes', '[]'::jsonb,
  'useGlobalAutoAlert', true,
  'alertTimes', '[]'::jsonb,
  'showOverdue', true
)
WHERE memo_type = 'todo' AND todo_timing IS NULL;
