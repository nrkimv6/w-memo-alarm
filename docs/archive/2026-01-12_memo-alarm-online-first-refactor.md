# memo-alarm Online-First 아키텍처 전환

> 작성일: 2026-01-12
> 대상 프로젝트: memo-alarm
> 상태: 🟢 대부분 완료
> 구현율: ~80%
> 완료: 정규화 테이블 (`004_supabase_online_first.sql`), Realtime 구독 (`subscribeToRealtime`), 오프라인 캐시
> 미구현: 일부 스토어 리팩토링 잔여
> 점검일: 2026-01-19
> 선행 조건: Phase 7 완료

---

## 개요

memo-alarm을 **offline-first → online-first** 아키텍처로 전환합니다.
Supabase를 Single Source of Truth로 사용하고, localStorage는 오프라인 캐시로만 활용합니다.

**목표**: 실시간 다중 기기 동기화 + 충돌 없는 데이터 일관성

---

## 현재 vs 목표 아키텍처

### 현재 (offline-first)
```
로컬 localStorage ← 메인 데이터
    ↕ 수동 동기화
Supabase (백업)
```

**문제점**:
- 수동 동기화 필요
- 충돌 발생 가능
- 실시간 업데이트 불가

### 목표 (online-first)
```
Supabase ← 메인 데이터 (Single Source of Truth)
    ↓ Realtime 구독
로컬 메모리 (UI 상태)
    ↓ 백그라운드 캐시
localStorage (오프라인 전용)
```

**장점**:
- ✅ 실시간 다중 기기 동기화
- ✅ 충돌 해결 불필요
- ✅ 데이터 일관성 보장
- ✅ 자동 동기화 (버튼 불필요)

**단점**:
- ⚠️ 온라인 필수 (오프라인 시 읽기 전용)
- ⚠️ Supabase 요청 증가 (비용)

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 | 시간 |
|:-------:|------|------|:------:|:----:|
| P0 | Supabase 스키마 변경 | JSONB → 정규화 테이블 | 중간 | 1시간 |
| P0 | `memosStore` 리팩토링 | Supabase 직접 CRUD | 높음 | 2시간 |
| P0 | `foldersStore` 리팩토링 | Supabase 직접 CRUD | 중간 | 1시간 |
| P1 | Realtime 구독 | 변경사항 자동 반영 | 중간 | 1시간 |
| P1 | 오프라인 모드 | 캐시 읽기 + 재연결 시 동기화 | 중간 | 1시간 |
| P2 | 낙관적 업데이트 | UI 즉시 반영 → 서버 동기화 | 높음 | 2시간 |

**총 소요**: 4-8시간

---

## 기술적 고려사항

### 1. Supabase 스키마 변경

**현재**: JSONB로 전체 덤프
```sql
CREATE TABLE user_data (
  user_id UUID PRIMARY KEY,
  memos JSONB,      -- ← 전체 배열
  folders JSONB,    -- ← 전체 배열
  updated_at TIMESTAMPTZ
);
```

**목표**: 정규화된 테이블
```sql
-- 메모 테이블
CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  emoji TEXT,
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  open_count INTEGER DEFAULT 0,
  folder_id TEXT,
  checklist JSONB,
  reminder JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memos_user_id ON memos(user_id);
CREATE INDEX idx_memos_created_at ON memos(user_id, created_at DESC);
CREATE INDEX idx_memos_updated_at ON memos(updated_at);

-- 폴더 테이블
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_folders_user_id ON folders(user_id);

-- RLS 정책
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own memos"
  ON memos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. `memosStore` 리팩토링

**변경 사항**:
- ✅ localStorage 제거 → Supabase 직접 CRUD
- ✅ `add()` → `supabase.from('memos').insert()`
- ✅ `update()` → `supabase.from('memos').update()`
- ✅ `remove()` → `supabase.from('memos').delete()`
- ✅ 초기화 시 Supabase에서 로드
- ✅ Realtime 구독으로 자동 업데이트

**스켈레톤**:
```typescript
function createMemosStore() {
	let memos = $state<Memo[]>([]);
	let loading = $state(true);
	let subscription: RealtimeChannel | null = null;

	async function init() {
		if (!authStore.isAuthenticated) {
			// 비로그인 시 localStorage에서 로드 (오프라인 전용)
			memos = loadFromStorage();
			loading = false;
			return;
		}

		// 로그인 시 Supabase에서 로드
		const { data, error } = await supabase
			.from('memos')
			.select('*')
			.eq('user_id', authStore.user!.id)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Failed to load memos:', error);
			toastStore.error('메모 로드 실패');
		} else {
			memos = data || [];
		}

		// Realtime 구독
		subscription = supabase
			.channel('memos')
			.on('postgres_changes', {
				event: '*',
				schema: 'public',
				table: 'memos',
				filter: `user_id=eq.${authStore.user!.id}`
			}, handleRealtimeChange)
			.subscribe();

		loading = false;
	}

	async function add(data: MemoCreate): Promise<Memo | null> {
		if (!authStore.isAuthenticated) {
			// 오프라인: localStorage에만 저장
			return addOffline(data);
		}

		// 온라인: Supabase에 저장
		const newMemo: Memo = {
			id: generateId(),
			...data,
			user_id: authStore.user!.id,
			created_at: Date.now(),
			updated_at: Date.now()
		};

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

		// Realtime이 자동으로 업데이트하므로 로컬 state 수정 불필요
		return inserted;
	}

	// ... update, remove 동일 패턴
}
```

### 3. Realtime 구독

**특징**:
- 다른 기기에서 메모 추가 → 실시간 반영
- 삭제/수정도 즉시 동기화
- 네트워크 끊김 시 자동 재연결

### 4. 오프라인 모드

**동작**:
1. 네트워크 끊김 감지 (`window.addEventListener('offline')`)
2. localStorage 캐시에서 읽기 전용 제공
3. 재연결 시 Supabase에서 다시 로드

**제약**:
- 오프라인 시 생성/수정/삭제 불가
- 또는 "Pending 큐"에 저장 → 재연결 시 업로드 (복잡도 ↑)

---

## 구현 순서

### Phase 1: 스키마 준비 (1시간)
1. [ ] 새 마이그레이션 생성
   - `data/migrations/004_normalize_schema.sql`
   - `memos`, `folders` 테이블 생성
   - RLS 정책 설정
   - 인덱스 생성

2. [ ] 마이그레이션 실행
   ```powershell
   python scripts\common\run-supabase-migration.py memo-alarm 004_normalize_schema
   ```

3. [ ] 기존 데이터 마이그레이션 (선택)
   - `user_data.memos` → `memos` 테이블로 이동
   - 또는 신규 시작 (기존 데이터 삭제)

### Phase 2: 스토어 리팩토링 (3시간)
4. [ ] `src/lib/stores/memos.svelte.ts` 전면 수정
   - Supabase CRUD로 전환
   - Realtime 구독 추가
   - 오프라인 폴백 로직

5. [ ] `src/lib/stores/folders.svelte.ts` 전면 수정
   - Supabase CRUD로 전환
   - Realtime 구독 추가

6. [ ] `src/lib/stores/auth.svelte.ts` 수정
   - `checkAndSyncData()` 제거 (불필요)
   - 로그인 시 스토어 `init()` 호출

### Phase 3: 테스트 (1시간)
7. [ ] 기능 테스트
   - CRUD 정상 동작 확인
   - 다중 기기 실시간 동기화 테스트
   - 오프라인 → 온라인 전환 테스트

8. [ ] 성능 테스트
   - 초기 로딩 시간 측정
   - 대량 메모 (100+) 동작 확인

### Phase 4: 최적화 (선택, 2시간)
9. [ ] 낙관적 업데이트
   - UI 즉시 반영 → 서버 동기화 백그라운드

10. [ ] 페이지네이션
    - 무한 스크롤 또는 페이지 단위 로드

---

## 마이그레이션 전략

### 옵션 1: 클린 스타트 (권장)
- 기존 `user_data` 테이블 무시
- 새 스키마로 신규 시작
- 사용자에게 "재로그인 필요" 안내

**장점**: 간단, 빠름
**단점**: 기존 동기화 데이터 손실 (로컬은 유지)

### 옵션 2: 데이터 마이그레이션
- `user_data.memos` → `memos` 테이블로 변환
- SQL 스크립트로 일괄 이동

**장점**: 데이터 보존
**단점**: 복잡, 버그 가능성

→ **옵션 1 권장** (서비스 초기 단계)

---

## 예상 이슈

### 1. Supabase 요청 제한
- **무료 플랜**: 500MB DB, 50만 요청/월
- **메모 100개, 10회 수정/일**: 월 3만 요청 (여유)
- **Realtime 구독**: 별도 제한 (동시 연결 200개)

### 2. 네트워크 지연
- 메모 추가 시 300-500ms 지연 가능
- **해결**: 낙관적 업데이트 (P2)

### 3. 알림 스케줄링
- 네이티브 알림은 로컬 스토리지 필요
- **해결**: 알림 정보만 localStorage 캐싱

---

## 참고 문서

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- `line-minder` 구현 (유사 패턴)

---

## 롤백 계획

Phase 7 완료 후 Git 커밋 보존:
```powershell
git tag phase7-offline-first
git push origin phase7-offline-first
```

문제 발생 시:
```powershell
git reset --hard phase7-offline-first
```

---

*상태: 검토 대기*
