# 메모/할일 버그 수정 계획서

> 작성일: 2026-02-05
> 우선순위: P0 (Critical)
> **상태: ✅ 완료 (2026-02-06)**
> **커밋: a613b87**

---

## 버그 요약

| # | 버그 | 심각도 | 영향 범위 |
|---|------|--------|----------|
| 1 | 로그인 시 메모가 안 보임 (새로고침 필요) | HIGH | 로그인 UX 전체 |
| 2 | Todo를 생성하면 메모 페이지에도 표시됨 | CRITICAL | 메모/할일 구분 전체 |

---

## Bug 1: 로그인 후 메모가 표시되지 않음

### 현상
- 로그인 완료 후 홈(`/`) 또는 메모 페이지(`/memos`)로 이동하면 메모 목록이 비어있음
- 브라우저를 새로고침하면 정상적으로 메모가 표시됨

### 근본 원인: `reinit()` 경쟁 상태 (Race Condition)

로그인 시 두 군데에서 `memosStore.reinit()`이 호출되는데, `isReinitializing` 가드 때문에 두 번째 호출이 무시됨.

#### 타임라인 분석

```
1. Layout onMount (auth/callback 페이지)
   ├── authStore.initialize() 실행
   │   └── onAuthStateChange 리스너 등록
   └── isAuthCallback=true이므로 memosStore.init() SKIP (의도적)

2. Callback onMount
   ├── supabase.auth.setSession() 또는 signInWithIdToken() 호출
   │   └── SIGNED_IN 이벤트 발생 → onAuthStateChange 콜백 비동기 실행 시작
   │       └── memosStore.reinit() 시작 (isReinitializing = true)
   │           └── fetchFromSupabase() 대기 중... (네트워크 I/O)
   │
   ├── finishLogin() 호출
   │   ├── authStore.initialize() → no-op (이미 초기화됨)
   │   ├── memosStore.reinit() → isReinitializing=true이므로 즉시 return! ⚠️
   │   ├── foldersStore.reinit() → 동일 문제
   │   └── goto(returnTo) → 홈으로 SPA 이동 ⚠️
   │
   └── 사용자가 홈에 도착 → memos=[] (아직 fetchFromSupabase 진행 중)

3. 백그라운드에서 fetchFromSupabase() 완료 → memos 채워짐
   └── BUT: goto()는 이미 실행됨, 리액티비티로 UI 업데이트 되어야 하지만
       SPA 네비게이션 이후 타이밍에 따라 UI 반영이 안 될 수 있음
```

#### 핵심 문제 코드

**`src/lib/stores/memos.svelte.ts:221-232`** — `reinit()`:
```typescript
async function reinit() {
    if (isReinitializing) return;  // ← 두 번째 호출자가 완료를 기다리지 않고 즉시 리턴
    isReinitializing = true;
    try {
        // ...
        await init();
    } finally {
        isReinitializing = false;
    }
}
```

**`src/routes/auth/callback/+page.svelte:189-222`** — `finishLogin()`:
```typescript
async function finishLogin(returnTo: string) {
    await authStore.initialize();         // no-op
    await memosStore.reinit();            // ← onAuthStateChange에서 이미 실행 중 → 즉시 return
    await foldersStore.reinit();          // ← 동일 문제
    goto(returnTo, { replaceState: true }); // ← 데이터 로드 완료 전 이동
}
```

### 수정 방향

`reinit()`이 이미 진행 중이면 즉시 리턴하지 말고, 진행 중인 reinit의 완료를 기다리도록 변경.

```typescript
let reinitPromise: Promise<void> | null = null;

async function reinit() {
    if (reinitPromise) {
        await reinitPromise;  // 진행 중인 reinit 완료 대기
        return;
    }
    reinitPromise = doReinit();
    await reinitPromise;
    reinitPromise = null;
}

async function doReinit() {
    subscription?.unsubscribe();
    subscription = null;
    initialized = false;
    await init();
}
```

---

## Bug 2: Todo가 메모 페이지에 표시됨

### 현상
- `/todos` 페이지에서 새 할일을 생성
- `/memos` 페이지로 이동하면 방금 만든 할일이 메모 목록에 표시됨
- 메모와 할일의 구분이 무너져 사용자 혼란 야기

### 근본 원인: `filterStore.getFilteredMemos()`에 memoType 필터 부재

**`src/lib/stores/filter.svelte.ts:103-172`** — `getFilteredMemos()`:
```typescript
function getFilteredMemos(): Memo[] {
    let result = [...memosStore.memos];  // ← 전체 데이터 (memo + todo 모두 포함)

    // Filter by active status
    if (!showInactive) {
        result = result.filter((m) => m.isActive !== false);
    }
    // Filter by folder, type(pinned/favorites), search, tags...
    // ← memoType 필터가 전혀 없음! ⚠️
    return result;
}
```

**영향 범위 분석:**

| 파일 | 사용처 | 문제 |
|------|--------|------|
| `memos/+page.svelte:34` | `filterStore.getFilteredMemos()` | Todo가 메모 목록에 표시됨 |
| `+page.svelte:43-79` | `pinnedMemos`, `favoriteMemos`, `recentMemos` | Todo가 고정/즐겨찾기/최신 섹션에도 표시 가능 |
| `+page.svelte:100` | `filteredMemos` (검색) | 검색 시 Todo도 함께 노출 |

### 수정 방향

1. `filterStore.getFilteredMemos()`에서 `memoType === 'todo'` 항목 제외
2. 홈 대시보드의 `pinnedMemos`, `favoriteMemos`, `recentMemos`에서도 todo 제외

---

## 수정 TODO (원자 단위)

### Bug 1: 로그인 후 메모 미표시 수정

- [x] **B1-1**: `memos.svelte.ts` — `reinit()` 함수를 Promise 기반 동시 호출 대기 방식으로 변경 ✅
  - `isReinitializing` boolean → `reinitPromise: Promise<void> | null` 패턴
  - 이미 진행 중이면 해당 Promise를 await하여 완료 대기
- [x] **B1-2**: `folders.svelte.ts` — 동일한 reinit 경쟁 조건이 있으면 같은 방식으로 수정 ✅
- [x] **B1-3**: `auth/callback/+page.svelte` — `finishLogin()`에서 `goto()` 호출 전 `memosStore.initialized`를 확인하는 방어 코드 추가 (안전장치) ✅

### Bug 2: Todo가 메모로 표시되는 문제 수정

- [x] **B2-1**: `filter.svelte.ts` — `getFilteredMemos()`에 `memoType !== 'todo'` 필터 추가 ✅
- [x] **B2-2**: `+page.svelte` (홈) — `pinnedMemos` derived에 `m.memoType !== 'todo'` 조건 추가 ✅
- [x] **B2-3**: `+page.svelte` (홈) — `favoriteMemos` derived에 `m.memoType !== 'todo'` 조건 추가 ✅
- [x] **B2-4**: `+page.svelte` (홈) — `recentMemos` derived에 `m.memoType !== 'todo'` 조건 추가 ✅

### 검증

- [x] **V-1**: `svelte-check` 타입 에러 없음 확인 ✅
- [x] **V-2**: 커밋 및 푸시 ✅
