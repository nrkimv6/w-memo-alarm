-- Memo Alarm D1 Database Schema
-- Phase 14: 로그인 & 동기화

-- 사용자 테이블 (간단한 동기화 코드 기반)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  sync_code TEXT UNIQUE NOT NULL,
  device_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_sync_at INTEGER
);

-- 메모 테이블
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  url TEXT,
  emoji TEXT,
  tags TEXT DEFAULT '[]',  -- JSON array
  is_pinned INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  folder_id TEXT,
  checklist TEXT,  -- JSON array
  reminder TEXT,   -- JSON object
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,  -- soft delete
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 폴더 테이블
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 동기화 로그 테이블
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'push', 'pull', 'conflict'
  entity_type TEXT NOT NULL,  -- 'memo', 'folder', 'settings'
  entity_id TEXT,
  details TEXT,  -- JSON
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_updated_at ON memos(updated_at);
CREATE INDEX IF NOT EXISTS idx_memos_folder_id ON memos(folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_users_sync_code ON users(sync_code);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id);
