# 메모/할일 버그 수정 계획서

> 작성일: 2026-02-05
> 우선순위: P0 (Critical)
> **상태: ✅ 완료 (2026-02-06)**
> **커밋: a613b87, + 후속 수정 (2026-02-06)**

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

### Bug 1 후속: Layout ↔ Callback Supabase auth 레이스 컨디션 (AbortError)

- [x] **B1-4**: `+layout.svelte` — `authStore.initialize()`를 `!isAuthCallback` 블록 안으로 이동 ✅
- [x] **B1-5**: `auth/callback/+page.svelte` — `finishLogin()`에서 `refreshSession()` → `initialize()`로 변경 ✅
  - B1-4로 layout이 initialize()를 스킵하므로, callback이 직접 호출하여 `onAuthStateChange` 리스너 등록 + 세션 동기화를 모두 수행

#### 현상

B1-1~B1-3 수정 후에도 로그인 시 콘솔에 다음 에러 발생:
```
Auth initialization failed: AbortError: signal is aborted without reason
[Auth Callback] Error: AbortError: signal is aborted without reason
Uncaught (in promise) AbortError: signal is aborted without reason (×3)
```

세션 자체는 생성되지만 (`Session created successfully`), 직후에 AbortError가 발생하여
callback 페이지의 catch 블록이 실행되고, 사용자에게 에러 UI가 표시될 수 있음.

#### 근본 원인: Layout과 Callback의 Supabase auth 동시 호출

Svelte는 자식 → 부모 순으로 onMount를 실행하므로:

```
1. [callback +page.svelte onMount] 시작
   └── signInWithIdToken() 시작 (await, 네트워크 I/O 대기)

2. [+layout.svelte onMount] 시작 (callback의 await 중에 실행)
   └── authStore.initialize() → getSession() 시작 (await, 네트워크 I/O 대기)

── signInWithIdToken()과 getSession()이 동시에 Supabase auth를 호출 ──

3. signInWithIdToken 완료 → 내부 세션 상태 변경
   └── Supabase가 진행 중인 getSession()의 AbortController.abort() 호출

4. getSession() → AbortError 발생
   └── "Auth initialization failed: AbortError: signal is aborted without reason"
```

B1-1~B1-3은 `reinit()` 경쟁을 해결했지만, 그보다 상위 레벨인
`authStore.initialize()`와 `signInWithIdToken()`의 동시 실행 문제는 남아있었음.

#### 수정 내용

**B1-4**: `+layout.svelte`에서 `authStore.initialize()`를 `!isAuthCallback` 조건 안으로 이동:

```typescript
// Before (문제)
await authStore.initialize();        // ← 항상 실행 → getSession() 충돌
if (!isAuthCallback) { ... }

// After (수정)
if (!isAuthCallback) {
    await authStore.initialize();    // ← callback이 아닐 때만 실행
    ...
}
```

**B1-5**: `finishLogin()`에서 `refreshSession()` → `initialize()`로 변경:

```typescript
// Before (3차 수정 당시): layout이 initialize()를 먼저 호출 → initialized=true
await authStore.refreshSession();  // ← initialize() 가드를 피해 세션만 읽음

// After (B1-4 적용 후): layout이 initialize()를 스킵 → initialized=false
await authStore.initialize();      // ← 가드 통과, 세션 확정 + 리스너 등록 모두 수행
```

B1-4로 layout이 auth callback에서 `initialize()`를 스킵하므로, callback의 `initialize()`가
가드(`initialized || initializing`)를 통과하여 정상 실행됨.
이로써 3차 수정의 `refreshSession()` 우회 방식이 불필요해지고,
`initialize()`가 리스너 등록과 세션 동기화를 모두 수행하는 정석 경로로 복원됨.

> **참고**: 이 수정은 아래 "Bug 1 재발" 섹션의 user=null 문제도 함께 해결함.
> layout이 미리 `initialized=true`로 잠그지 않으므로, callback의 `initialize()`가
> `getSession()`으로 세션을 정상 읽어 `authStore.user`를 확정함.

---

### 검증

- [x] **V-1**: `svelte-check` 타입 에러 없음 확인 ✅
- [x] **V-2**: 커밋 및 푸시 ✅

---

## Bug 1 재발: authStore.user null 상태에서 reinit 실행 (2026-02-06)

> **상태: ✅ 완료 (2026-02-06)** → **B1-4/B1-5로 접근 방식 변경됨**
> **커밋: 6e5e11e**
>
> **⚠️ 대체됨**: 이 섹션의 `refreshSession()` 접근 방식은 위 B1-4/B1-5 수정으로 대체됨.
> B1-4가 layout의 `initialize()` 호출을 제거하여 근본 원인(`initialized=true` 조기 잠금)이 사라졌으므로,
> callback이 `initialize()`를 직접 호출하는 정석 경로로 복원됨.
> `refreshSession()` 메서드는 코드에 잔존하나, auth callback 플로우에서는 더 이상 사용되지 않음.

### 현상 (2차 수정 이후에도 동일)

로그인 완료 후 홈/전체 탭에서 메모가 비어있고, 새로고침하면 정상 표시됨.

```
[Auth Callback] Session created successfully
[Notification] 📊 memosStore.memos.length = 0   ← reinit 완료됐는데 0개
[Notification] 📊 memosStore.initialized = true  ← "성공적으로" 완료
```

### 2차 수정(Promise 기반)이 부족했던 이유

Promise 기반 `reinitPromise`는 **reinit 동시 호출 경쟁**을 해결했지만,
`init()` 내부에서 `authStore.isAuthenticated`가 `false`인 채로 실행되는 문제는 해결하지 못함.

```typescript
// memos.svelte.ts init()
if (!authStore.isAuthenticated) {   // ← user가 null이면 여기로 진입
    memos = loadCacheFromStorage(); // ← 빈 캐시 로드
    initialized = true;             // ← 비인증 경로로 "성공" 완료
    return;
}
```

reinit이 아무리 Promise로 잘 대기해도, `authStore.user`가 null이면 서버 fetch 자체를 안 함.

### 근본 원인: authStore.initialize()의 단방향 잠금

```
[타임라인]
1. Layout onMount:
   authStore.initialize()
   → getSession() → null (세션 아직 없음)
   → state.user = null, state.initialized = true ★ 잠김

2. Callback onMount:
   setSession() → 세션 생성
   → onAuthStateChange 비동기 트리거 (실행 시점 불확실)

3. finishLogin():
   authStore.initialize()
   → state.initialized === true → 즉시 return ★ user 갱신 안 됨
   memosStore.reinit()
   → init() → authStore.isAuthenticated === false → 빈 캐시 → 0개
```

`initialize()`는 `initialized=true`이면 재호출 시 세션을 다시 읽지 않음.
`onAuthStateChange`가 user를 설정해주지만, 이벤트가 비동기이므로 `finishLogin()` 시점에 아직 실행되지 않았을 수 있음.

### 수정 내용

**`authStore.refreshSession()` 메서드 추가** — `onAuthStateChange` 타이밍에 의존하지 않고 Supabase에서 직접 세션을 읽어 user 상태를 확정.

```typescript
// auth.svelte.ts
async function refreshSession() {
    if (!browser) return;
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession) {
        state.session = currentSession;
        state.user = currentSession.user;
    }
}
```

**callback `finishLogin()`에서 `initialize()` 대신 `refreshSession()` 호출:**

```typescript
// auth/callback/+page.svelte finishLogin()
await authStore.refreshSession();  // ← user 확정 (결정적)
await memosStore.reinit();         // ← isAuthenticated === true 보장
```

`setSession()` 완료 후 `getSession()`은 반드시 세션을 반환하므로, 이벤트 타이밍과 무관하게 결정적(deterministic)으로 동작함.

### 2차 vs 3차 수정 비교

| 관점 | 2차 (Promise 기반) | 3차 (refreshSession) |
|------|-------------------|---------------------|
| 해결 대상 | reinit 동시 호출 경쟁 | authStore.user가 null인 상태에서 reinit 실행 |
| 방식 | reinitPromise 대기 | setSession 후 getSession으로 user 확정 |
| onAuthStateChange 의존 | 의존함 | **의존하지 않음** |
| 보완 관계 | 3차 없이는 user=null 문제 미해결 | 2차 없이는 동시 호출 문제 미해결 |

두 수정은 서로 다른 레이어의 문제를 해결하며, 함께 적용되어야 완전한 수정이 됨.
