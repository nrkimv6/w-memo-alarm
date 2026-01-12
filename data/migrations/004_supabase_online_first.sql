-- memo-alarm Online-First 아키텍처 전환
-- 작성일: 2026-01-12
-- Supabase 마이그레이션

-- ============================================
-- 1. memos 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  emoji TEXT,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  open_count INTEGER DEFAULT 0,
  folder_id TEXT,

  -- Checklist (JSONB)
  checklist JSONB,
  -- { items: [{ id, text, checked }], showCompleted }

  -- Reminder (JSONB)
  reminder JSONB,
  -- { enabled, time, days[], repeat, oneTime }

  -- 버전 관리 (충돌 감지용)
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_folder_id ON memos(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memos_tags ON memos USING GIN(tags);

-- RLS 정책
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own memos" ON memos;
CREATE POLICY "Users can CRUD their own memos"
  ON memos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at + version 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_memos_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS update_memos_metadata_trigger ON memos;
CREATE TRIGGER update_memos_metadata_trigger
  BEFORE UPDATE ON memos
  FOR EACH ROW
  EXECUTE FUNCTION update_memos_metadata();

-- ============================================
-- 2. folders 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id, "order");

-- RLS 정책
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own folders" ON folders;
CREATE POLICY "Users can CRUD their own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 완료
-- ============================================
-- 이제 Supabase가 Single Source of Truth입니다.
-- Realtime 구독을 통해 다중 기기 동기화가 가능합니다.
