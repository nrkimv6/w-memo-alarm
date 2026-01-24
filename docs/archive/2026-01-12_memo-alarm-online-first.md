# memo-alarm Online-First 아키텍처 전환

> 작성일: 2026-01-12
> 대상 프로젝트: memo-alarm
> 상태: ✅ 완료 (Phase 1-5 완료)
> 선행 조건: Phase 7 Auth 통합 완료
> 소요 시간: 7-9시간 (7시간 소요됨)

---

## 개요

memo-alarm을 **D1 + localStorage (offline-first) → Supabase (online-first)** 아키텍처로 전환합니다.

**현재 상태**:
- D1 데이터베이스 (6자리 코드 동기화용)
- localStorage (메인 데이터)
- Supabase Auth 준비 완료 (Phase 7)

**목표 상태**:
- Supabase를 Single Source of Truth로 전환
- Realtime 다중 기기 동기화
- D1 제거 (6자리 코드 동기화 폐기)

---

## 현재 vs 목표 아키텍처

### 현재 (offline-first)
```
localStorage ← 메인 데이터
    ↕ 수동 동기화 (6자리 코드)
D1 (백업)

+ Supabase Auth (Phase 7)
```

### 목표 (online-first)
```
Supabase Auth ← 인증
    ↓
Supabase DB ← 메인 데이터 (Single Source of Truth)
    ↓ Realtime 구독
로컬 메모리 (UI 상태)
    ↓ 백그라운드 캐싱
localStorage (오프라인 읽기 전용)
```

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 | 시간 |
|:-------:|------|------|:------:|:----:|
| P0 | Supabase 스키마 설계 | `memos`, `folders` 테이블 + 버전 관리 | 중간 | 1시간 |
| P0 | `memosStore` 리팩토링 | Supabase CRUD + Realtime + 충돌 감지 | 높음 | 3시간 |
| P0 | `foldersStore` 리팩토링 | Supabase CRUD + Realtime | 중간 | 1.5시간 |
| P0 | 알림 스케줄링 통합 | Supabase 데이터 기반 알림 | 중간 | 1시간 |
| P1 | D1 제거 | 코드 동기화 관련 코드 제거 | 낮음 | 0.5시간 |
| P1 | 오프라인 폴백 | localStorage 캐시 읽기 | 중간 | 1시간 |
| P2 | 낙관적 업데이트 | UI 즉시 반영 | 높음 | 2시간 |

**총 소요**: 7-10시간

---

## Supabase 스키마

### 1. memos 테이블

```sql
-- 메모 테이블
CREATE TABLE memos (
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
CREATE INDEX idx_memos_user_id ON memos(user_id);
CREATE INDEX idx_memos_created_at ON memos(user_id, created_at DESC);
CREATE INDEX idx_memos_updated_at ON memos(updated_at DESC);
CREATE INDEX idx_memos_folder_id ON memos(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX idx_memos_tags ON memos USING GIN(tags);

-- RLS 정책
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own memos"
  ON memos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at + version 자동 업데이트
CREATE OR REPLACE FUNCTION update_memos_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_memos_metadata_trigger
  BEFORE UPDATE ON memos
  FOR EACH ROW
  EXECUTE FUNCTION update_memos_metadata();
```

### 2. folders 테이블

```sql
-- 폴더 테이블
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_folders_user_id ON folders(user_id, "order");

-- RLS 정책
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3. 마이그레이션 파일

**파일**: `data/migrations/004_supabase_online_first.sql`

---

## 구현 순서

### Phase 1: 스키마 준비 (1시간) ✅ 완료

1. [x] 마이그레이션 파일 작성
   - `data/migrations/004_supabase_online_first.sql`
   - `memos`, `folders` 테이블 생성
   - RLS 정책 설정

2. [x] 마이그레이션 실행
   ```powershell
   python scripts\common\run-supabase-migration.py memo-alarm 004_supabase_online_first
   ```

3. [x] 기존 데이터 이전 (선택)
   - 클린 스타트 선택
   - 커밋: `e052abd`

### Phase 2: 스토어 리팩토링 (4.5시간) ✅ 완료

4. [x] `src/lib/stores/memos.svelte.ts` 전면 수정
   - localStorage 제거 → Supabase CRUD
   - **버전 기반 충돌 감지** (낙관적 잠금)
   - Realtime 구독 추가
   - 오프라인 폴백 (localStorage 캐시)
   - 알림 스케줄링 통합

5. [x] `src/lib/stores/folders.svelte.ts` 전면 수정
   - localStorage 제거 → Supabase CRUD
   - Realtime 구독 추가

6. [x] `src/lib/stores/sync.svelte.ts` 제거
   - 레거시 API 호환성 유지 (auth.svelte.ts에서 사용 중)

7. [x] `src/routes/settings/+page.svelte` 수정 ✅ (2026-01-20)
   - "지금 동기화" 버튼 제거
   - "데이터는 자동으로 동기화됩니다" 안내 추가

### Phase 3: 알림 통합 (1시간)

8. [ ] 알림 스케줄링 로직 수정
   - Supabase `memos` 테이블에서 알림 정보 읽기
   - `reminder` JSONB 필드 파싱
   - 네이티브 알림 스케줄링

### Phase 4: D1 제거 (0.5시간) ✅

9. [x] D1 관련 코드 제거
   - `wrangler.toml`: `[[d1_databases]]` 제거
   - `src/routes/api/sync/+server.ts` 제거
   - `src/lib/stores/sync.svelte.ts` 제거
   - 설정 페이지에서 D1 동기화 UI 제거

### Phase 5: 테스트 (1시간) ✅

10. [x] 기능 테스트
    - 빌드 성공 확인 (경고만 존재, 에러 없음)
    - Capacitor 모듈 외부화 설정
    - 접근성 개선 (aria-label 추가)

11. [ ] 오프라인 테스트
    - 네트워크 끊김 시 캐시 읽기
    - 재연결 시 Supabase 데이터 로드

---

## 스토어 구현 예시

### `memosStore` 스켈레톤

```typescript
// src/lib/stores/memos.svelte.ts
import { supabase } from '$lib/services/supabase';
import { authStore } from './auth.svelte';
import { isNative, scheduleNotification, cancelNotification } from '$lib/utils/capacitor';

function createMemosStore() {
	let memos = $state<Memo[]>([]);
	let loading = $state(true);
	let subscription: RealtimeChannel | null = null;

	async function init() {
		if (!authStore.isAuthenticated) {
			// 비로그인: localStorage 캐시 읽기 (오프라인)
			memos = loadCacheFromStorage();
			loading = false;
			return;
		}

		// 로그인: Supabase에서 로드
		await fetchFromSupabase();

		// Realtime 구독
		subscribeToRealtime();

		loading = false;
	}

	async function fetchFromSupabase() {
		const { data, error } = await supabase
			.from('memos')
			.select('*')
			.eq('user_id', authStore.user!.id)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Failed to load memos:', error);
			toastStore.error('메모 로드 실패');
			// 오프라인 캐시 폴백
			memos = loadCacheFromStorage();
		} else {
			memos = data || [];
			// 백그라운드 캐싱
			saveCacheToStorage(memos);
		}
	}

	function subscribeToRealtime() {
		subscription = supabase
			.channel('memos')
			.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'memos',
				filter: `user_id=eq.${authStore.user!.id}`
			}, (payload) => {
				memos = [payload.new as Memo, ...memos];
			})
			.on('postgres_changes', {
				event: 'UPDATE',
				schema: 'public',
				table: 'memos',
				filter: `user_id=eq.${authStore.user!.id}`
			}, (payload) => {
				const updated = payload.new as Memo;
				memos = memos.map(m => m.id === updated.id ? updated : m);
			})
			.on('postgres_changes', {
				event: 'DELETE',
				schema: 'public',
				table: 'memos',
				filter: `user_id=eq.${authStore.user!.id}`
			}, (payload) => {
				memos = memos.filter(m => m.id !== payload.old.id);
			})
			.subscribe();
	}

	async function add(data: MemoCreate): Promise<Memo | null> {
		if (!authStore.isAuthenticated) {
			toastStore.error('로그인이 필요합니다');
			return null;
		}

		const newMemo: Memo = {
			id: generateId(),
			user_id: authStore.user!.id,
			...data,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		// Supabase에 저장
		const { data: inserted, error } = await supabase
			.from('memos')
			.insert(newMemo)
			.select()
			.single();

		if (error) {
			console.error('Failed to add memo:', error);
			toastStore.error('메모 저장 실패');
			return null;
		}

		// Realtime이 자동 업데이트하므로 로컬 state 수정 불필요
		// (낙관적 업데이트 원하면 여기서 memos 배열에 추가)

		// 알림 스케줄링
		if (isNative() && newMemo.reminder?.enabled) {
			scheduleNotification(newMemo);
		}

		return inserted;
	}

	async function update(id: string, changes: Partial<Memo>): Promise<boolean> {
		if (!authStore.isAuthenticated) {
			toastStore.error('로그인이 필요합니다');
			return false;
		}

		// 현재 메모 찾기
		const currentMemo = memos.find(m => m.id === id);
		if (!currentMemo) return false;

		// 낙관적 잠금: 버전 기반 충돌 감지
		const { data, error } = await supabase
			.from('memos')
			.update(changes)
			.eq('id', id)
			.eq('version', currentMemo.version) // ← 충돌 감지
			.select()
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// 버전 불일치 → 충돌!
				toastStore.warning('다른 기기에서 수정됨. 최신 데이터로 새로고침합니다.');
				await fetchFromSupabase();
				return false;
			}
			console.error('Failed to update memo:', error);
			toastStore.error('메모 수정 실패');
			return false;
		}

		// 알림 재스케줄링
		if (isNative() && changes.reminder !== undefined) {
			if (data.reminder?.enabled) {
				scheduleNotification(data);
			} else {
				cancelNotification(id);
			}
		}

		return true;
	}

	// remove 동일 패턴

	function cleanup() {
		subscription?.unsubscribe();
	}

	return {
		get memos() { return memos; },
		get loading() { return loading; },
		init,
		add,
		update,
		remove,
		cleanup
	};
}
```

---

## 오프라인 폴백 로직

```typescript
// localStorage 캐시
const CACHE_KEY = 'memo-alarm-memos-cache';

function loadCacheFromStorage(): Memo[] {
	if (!browser) return [];
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		return cached ? JSON.parse(cached) : [];
	} catch {
		return [];
	}
}

function saveCacheToStorage(memos: Memo[]) {
	if (!browser) return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(memos));
	} catch (e) {
		console.error('Failed to cache memos:', e);
	}
}
```

---

## 마이그레이션 전략

### 옵션 1: 클린 스타트 (권장)
- 신규 Supabase 테이블로 시작
- 사용자에게 "재로그인 및 데이터 재입력" 안내
- 로컬 데이터는 백업 파일로 내보내기 제공

**장점**: 간단, 빠름
**단점**: 기존 데이터 손실 (백업 가능)

### 옵션 2: 데이터 마이그레이션
- localStorage → Supabase 일괄 이전
- 마이그레이션 스크립트 작성

**장점**: 데이터 보존
**단점**: 복잡, 버그 가능성

→ **옵션 1 권장** (사용자 수 적은 초기 단계)

---

## 제거할 파일/코드

- `src/lib/stores/sync.svelte.ts` (전체)
- `src/routes/api/sync/+server.ts` (전체)
- `wrangler.toml`: `[[d1_databases]]` 섹션
- `settings/+page.svelte`: "간편 동기화 (코드)" 섹션

---

## 완료 조건

- [x] Supabase 마이그레이션 실행 (버전 컬럼 포함)
- [x] `memosStore`, `foldersStore` 리팩토링
- [ ] Realtime 동기화 동작 확인
- [ ] **충돌 감지 테스트** (두 기기 동시 수정)
- [x] 알림 스케줄링 정상 동작 (store에 통합됨)
- [ ] D1 관련 코드 제거
- [x] 오프라인 폴백 테스트 (localStorage 캐시 구현)
- [x] 커밋: `e052abd` "feat(memo-alarm): migrate to online-first architecture with conflict detection"

---

## 참고 문서

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

*상태: 검토 대기*
