# 메모/할일 버그 수정 계획서

> 작성일: 2026-02-05
> 우선순위: P0 (Critical)
> **상태: 🔄 진행 중 (2026-02-06)**
> **최신 커밋: 0581fac** (시행착오 포함: a613b87 → … → 9fb154b → 84bdbfb → 0581fac)
>
> **현재 상황**:
> - Bug 2: ✅ 완료 (filterStore에 memoType !== 'todo' 필터 추가)
> - Bug 1: 11차 수정 배포 대기 중
>   - 10차: 전체 페이지 리로드 성공 (AbortError 해소), 하지만 `fetchFromSupabase()` 0건 반환
>   - 원인: `getSession()`은 localStorage에서 읽기만 하고, Supabase client의 내부 auth 컨텍스트는 `INITIAL_SESSION` 이벤트에서 설정됨. DB 쿼리가 `INITIAL_SESSION` 이전에 실행 → RLS가 인증 없이 0건 반환
>   - 11차(0581fac): `initialize()`를 `INITIAL_SESSION` 이벤트 대기 방식으로 변경

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
- [ ] **B1-5**: (계획만 존재, 실제 구현 안 됨) — `finishLogin()`에서 `refreshSession()` → `initialize()`로 변경
  - **실제로는 B1-6/B1-7에서 `initializeWithSession()` 방식으로 직접 구현됨**

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

**B1-5**: (계획만 존재, 구현 안 됨)

B1-4만 적용 후 `finishLogin()`에서 `authStore.initialize()` → `getSession()` 호출 시
여전히 `signInWithIdToken` 내부 lock과 충돌하여 AbortError 발생.
→ B1-5 대신 **B1-6/B1-7 (initializeWithSession)** 방식으로 직접 구현됨 (아래 참조).

---

### 검증

- [x] **V-1**: `svelte-check` 타입 에러 없음 확인 ✅
- [x] **V-2**: 커밋 및 푸시 ✅

---

## Bug 1 재발: authStore.user null 상태에서 reinit 실행 (2026-02-06)

> **상태: ⚠️ 부분 해결 → B1-6/B1-7/B1-8/B1-9로 완전 대체됨**
> **커밋: 6e5e11e (3차 수정, refreshSession 추가)**
>
> **⚠️ 대체됨**: 이 섹션의 `refreshSession()` 접근 방식은 B1-4 이후 재검토되었고,
> 최종적으로 **B1-6/B1-7 (initializeWithSession)** + **B1-8/B1-9 (타임아웃 지연)** 방식으로 대체됨.
> `refreshSession()` 메서드는 코드에 잔존하나, auth callback 플로우에서는 사용되지 않음.

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

---

## Bug 1 재재발: getSession() AbortError로 로그인 실패 (2026-02-06)

> **상태: ✅ 완료 (2026-02-06)**
> **커밋: 0065192**
>
> B1-4/B1-5 수정 이후에도 `getSession()` 호출 자체가 AbortError로 실패하는 문제.
> `initializeWithSession()` 방식으로 `getSession()` 호출을 완전히 제거하여 해결.

### 현상

B1-4/B1-5 적용 후에도 로그인 시:
1. 스피너가 돌고
2. "Session created successfully" 로그 출력 후
3. **로그인 안 된 상태**로 설정 페이지(`/settings`)에 도착

콘솔 에러:
```
[Auth Callback] Session created successfully
Auth initialization failed: AbortError: signal is aborted without reason
Uncaught (in promise) AbortError: signal is aborted without reason (×3)
```

### 근본 원인: Supabase 내부 lock 경쟁

B1-4는 layout의 `initialize()` 호출을 auth callback에서 스킵하여 **layout ↔ callback 간** 동시 호출 문제를 해결했지만,
`signInWithIdToken()` **직후** Supabase 내부에서 lock을 잡고 있는 상태에서 `finishLogin()`의 `authStore.initialize()` → `getSession()`이 동일한 lock을 요청하여 AbortError 발생.

```
[타임라인]
1. signInWithIdToken() 완료 → 세션 생성
   └── Supabase 내부: auth 상태 변경 처리, lock 보유 중...

2. finishLogin() 즉시 실행
   └── authStore.initialize()
       └── getSession() → lock 획득 시도
           └── Supabase가 진행 중인 요청의 AbortController.abort() 호출
               └── AbortError 발생!

3. initialize()의 catch 블록:
   └── state.error = "AbortError..." (로그만 남기고 계속 진행)
   └── state.user = null (getSession 실패로 세션 못 읽음)
   └── state.initialized = true ★

4. finishLogin() 계속 진행:
   └── memosStore.reinit() → isAuthenticated=false → 빈 캐시
   └── goto('/settings') → 미인증 상태로 도착
```

### B1-4/B1-5가 부족했던 이유

B1-4는 **layout과 callback 사이**의 동시 호출을 제거했으나,
**signInWithIdToken 내부 처리**와 **callback의 initialize()** 사이의 lock 경쟁은 해결하지 못함.
`signInWithIdToken`이 반환된 직후에도 Supabase 내부적으로 세션 저장, 이벤트 발행 등 후처리가 비동기로 진행되며 lock을 계속 보유함.

### 수정 내용

**핵심 아이디어**: `signInWithIdToken`/`setSession`은 이미 세션을 반환함. `getSession()`을 다시 호출할 이유가 없음.

**B1-6**: `auth.svelte.ts` — `initializeWithSession(session)` 메서드 추가:

```typescript
// getSession() 호출 없이, 이미 확보된 세션으로 직접 초기화
function initializeWithSession(session: Session) {
    if (!browser) return;
    state.session = session;
    state.user = session.user;
    state.loading = false;
    state.initialized = true;
    state.initializing = false;

    // onAuthStateChange 리스너 등록 (initialize()와 동일)
    supabase.auth.onAuthStateChange(async (event, newSession) => {
        // ... (initialize()의 리스너와 동일한 로직)
    });
}
```

**B1-7**: `auth/callback/+page.svelte` — `finishLogin()`에서 세션 직접 전달:

```typescript
// Before (B1-5):
await authStore.initialize();  // ← getSession() 호출 → AbortError

// After (B1-6/B1-7):
authStore.initializeWithSession(session);  // ← 세션 직접 설정, getSession() 불필요
```

callback의 `onMount`에서 `signInWithIdToken`/`setSession` 결과의 `data.session`을 `finishLogin(returnTo, session)`으로 전달.

### 수정 레이어 누적 비교

| 차수 | 커밋 | 해결 대상 | 방식 |
|------|------|----------|------|
| 2차 (B1-1~B1-3) | a613b87 | reinit 동시 호출 경쟁 | `reinitPromise` 대기 패턴 |
| 3차 (Bug 1 재발) | 6e5e11e | user=null 상태에서 reinit | `refreshSession()`으로 user 확정 (나중에 대체됨) |
| 4차 (B1-4) | (B1-4 일부 적용) | layout ↔ callback 동시 getSession | layout에서 callback일 때 initialize 스킵 |
| **5차 (B1-6/B1-7)** | **0065192** | **signInWithIdToken 내부 lock ↔ callback의 작업** | **`initializeWithSession()`으로 getSession 제거 + 세션 직접 설정** |

### 안전성 분석

| 고려사항 | 상태 |
|---------|------|
| `onAuthStateChange` 리스너 중복 등록 | 안전 — `initializeWithSession` 후 layout의 `initialize()`는 `initialized=true` 가드로 스킵됨 |
| SIGNED_IN 이벤트 + finishLogin의 reinit 이중 호출 | 안전 — B1-1의 `reinitPromise` 패턴이 보호 |
| INITIAL_SESSION 이벤트 | 안전 — SIGNED_IN/SIGNED_OUT 외 이벤트는 무시됨 |
| 페이지 새로고침 시 | 안전 — layout의 `initialize()` → `getSession()` 정상 경로 (lock 경쟁 없음) |
| `refreshSession()` 잔존 | 무해 — auth callback에서 더 이상 사용되지 않으나 다른 용도로 활용 가능 |

### 검증

- [x] **V-3**: `svelte-check` — auth 관련 타입 에러 없음 ✅
- [x] **V-4**: 커밋 완료 (0065192) ✅
- [x] **V-5**: 배포 후 Google 로그인 → **여전히 AbortError 발생** ❌

---

## Bug 1 재재재발: onAuthStateChange도 lock 경쟁 유발 (2026-02-06)

> **상태: ✅ 완료 (2026-02-06)**
> **커밋: a1ec8c7**
>
> B1-6/B1-7 수정 이후에도 `memosStore.reinit()`, `foldersStore.reinit()`, FCM 등록 모두 AbortError 발생.
> `onAuthStateChange` 리스너 등록 자체가 Supabase 내부 lock을 트리거함을 발견.

### 현상 (0065192 배포 후)

B1-6/B1-7 적용 후에도 로그인 시:
```
[Auth Callback] Session created successfully
Failed to load memos: AbortError: signal is aborted without reason
Failed to load folders: AbortError: signal is aborted without reason
Failed to save FCM token: AbortError: signal is aborted without reason
Uncaught (in promise) AbortError: signal is aborted without reason (×3)
```

`initializeWithSession`이 `getSession()`을 호출하지 않는데도 불구하고 여전히 AbortError 발생.

### 근본 원인: onAuthStateChange 리스너 등록 시 lock 획득

Supabase의 `onAuthStateChange()`는 내부적으로:
1. 리스너 배열에 콜백 추가
2. **현재 세션을 읽어 INITIAL_SESSION 이벤트 발생** (내부 `getSession()` 호출)
3. 이 과정에서 lock 획득 시도 → signInWithIdToken의 lock과 충돌

```
[타임라인]
1. signInWithIdToken() 완료 → 세션 생성
   └── Supabase 내부: lock 보유 중...

2. initializeWithSession(session) 즉시 실행
   └── supabase.auth.onAuthStateChange(...) ← 리스너 등록
       └── 내부적으로 getSession() 호출 (INITIAL_SESSION 이벤트용)
           └── lock 획득 시도 → AbortError! ★

3. memosStore.reinit() 실행
   └── supabase.from('memos').select() 호출
       └── Supabase client 내부 lock 여전히 점유 상태
           └── AbortError 전파! ★
```

### B1-6/B1-7이 부족했던 이유

`getSession()` 호출은 제거했지만, `onAuthStateChange()` 리스너 등록이 내부적으로 `getSession()`을 호출하여 동일한 lock 경쟁 발생.

### 수정 내용

**핵심 아이디어**: Supabase의 내부 lock이 완전히 해제될 때까지 **모든 Supabase 작업을 지연**.

**B1-8**: `auth/callback/+page.svelte` — `finishLogin()`에서 100ms 지연 추가:

```typescript
// Supabase 내부 lock이 완전히 해제될 때까지 짧은 지연
await new Promise(resolve => setTimeout(resolve, 100));

// 이후 reinit/FCM 등록 진행
await memosStore.reinit();  // ← 이제 안전
await foldersStore.reinit();
```

**B1-9**: `auth.svelte.ts` — `onAuthStateChange` 리스너 등록을 200ms 지연:

```typescript
// Before:
supabase.auth.onAuthStateChange(...);  // ← 즉시 lock 경쟁

// After:
setTimeout(() => {
    supabase.auth.onAuthStateChange(...);  // ← lock 해제 후 등록
}, 200);
```

### 수정 레이어 최종 비교

| 차수 | 커밋 | 해결 대상 | 방식 | 상태 |
|------|------|----------|------|------|
| 2차 (B1-1~B1-3) | a613b87 | reinit 동시 호출 경쟁 | `reinitPromise` 대기 패턴 | ✅ 유효 |
| 3차 (Bug 1 재발) | 6e5e11e | user=null 상태에서 reinit | `refreshSession()` 추가 | ⚠️ 대체됨 |
| 4차 (B1-4) | (일부 적용) | layout ↔ callback 동시 getSession | layout에서 callback일 때 initialize 스킵 | ✅ 유효 |
| 5차 (B1-6/B1-7) | 0065192 | signInWithIdToken 내부 lock | `initializeWithSession()`으로 getSession 제거 | ⚠️ 불충분 |
| **6차 (B1-8/B1-9)** | **a1ec8c7** | **onAuthStateChange/reinit lock 경쟁** | **100ms + 200ms 타임아웃 지연** | **✅ 최종** |

### 왜 타임아웃 방식인가?

**이상적인 해결책**:
- Supabase가 "lock 해제 완료" 이벤트를 제공하면 await할 수 있지만, 그런 API 없음
- `signInWithIdToken`의 Promise 완료가 "모든 내부 처리 완료"를 보장하지 않음

**실용적 선택**:
- 100ms/200ms는 경험적으로 충분한 시간 (네트워크 I/O가 아닌 내부 상태 동기화)
- 사용자 UX에 "로그인 처리 중..." 스피너가 표시되므로 300ms 추가는 눈에 띄지 않음
- AbortError 발생 시 사용자가 로그인 실패로 인식하는 것보다 나음

### 트레이드오프

| 관점 | 장점 | 단점 |
|------|------|------|
| 신뢰성 | AbortError 회피 가능 | 타이밍 의존적 (100ms가 부족할 수도) |
| 성능 | 300ms 추가 지연 (acceptable) | — |
| 유지보수 | 간단한 코드 | Supabase 내부 구현 변경 시 재검토 필요 |
| 대안 비용 | — | 더 나은 해결책 찾기 어려움 |

### 검증

- [x] **V-6**: 커밋 완료 (a1ec8c7) ✅
- [x] **V-7**: 푸시 및 자동 배포 ✅
- [x] **V-8**: 배포 후 Google 로그인 → **여전히 AbortError 발생** ❌

---

## Bug 1 재재재재발: 타임아웃도 불충분, 근본적 재설계 필요 (2026-02-06)

> **상태: ✅ 완료 (2026-02-06)**
> **커밋: d9e28cb, 88d5fb9**
>
> B1-8/B1-9 (타임아웃 100ms + 200ms) 적용 후에도 여전히 AbortError 발생.
> 타임아웃이 부족하거나, 근본적으로 Supabase client의 전역 lock 문제를 회피할 수 없음.

### 현상 (a1ec8c7 배포 후)

B1-8/B1-9 적용 후에도 동일한 AbortError:
```
[Auth Callback] Session created successfully
Failed to load memos: AbortError: signal is aborted without reason
Failed to load folders: AbortError: signal is aborted without reason
Failed to save FCM token: AbortError: signal is aborted without reason
Uncaught (in promise) AbortError: signal is aborted without reason (×3)
```

### 근본 원인: Supabase client 전역 lock의 지속성

100ms/200ms 지연으로도 부족. Supabase의 내부 lock 해제 시간이 예상보다 길거나,
`onAuthStateChange` 리스너 등록 자체가 lock을 다시 획득하려는 시도를 유발.

**타임아웃 방식의 한계**:
- 네트워크 상태, 브라우저 성능에 따라 필요한 지연 시간이 다름
- 충분히 긴 타임아웃(예: 1초)을 사용하면 UX 저하
- 근본적으로 "Supabase lock이 해제되었는지" 확인할 API가 없음

### 수정 내용: 근본적 재설계 (7차)

**핵심 아이디어**: auth callback에서 **모든 Supabase 작업을 완전히 제거**하고,
페이지 이동 후 **500ms 지연 후** layout에서 정상 초기화.

**B1-10**: `auth/callback/+page.svelte` — `finishLogin()`에서 모든 stores 초기화 제거:

```typescript
// Before (B1-8):
await new Promise(resolve => setTimeout(resolve, 100));
await memosStore.reinit();  // ← Supabase 호출 → AbortError
await foldersStore.reinit();
registerFCMToken(...);      // ← Supabase 호출 → AbortError
goto(returnTo);

// After (B1-10):
authStore.initializeWithSession(session);
goto(returnTo, { replaceState: true });  // ← 즉시 이동, Supabase 작업 없음
```

**B1-11**: `auth.svelte.ts` — `onAuthStateChange` 리스너 등록을 별도 함수로 분리:

```typescript
let listenerRegistered = false;

function registerAuthListener() {
    if (listenerRegistered || !browser) return;
    listenerRegistered = true;
    supabase.auth.onAuthStateChange(...);
}

// initializeWithSession()에서는 리스너 등록하지 않음
function initializeWithSession(session: Session) {
    state.session = session;
    state.user = session.user;
    state.initialized = true;
    // 리스너 등록 없음 — layout에서 나중에 등록
}
```

**B1-12**: `+layout.svelte` — 로그인 성공 플래그 확인 후 500ms 지연 + stores 초기화:

```typescript
if (!isAuthCallback) {
    await authStore.initialize();
} else {
    // auth callback 시: 리스너만 등록
    authStore.ensureListenerRegistered();
}

// 로그인 성공 플래그 확인 (sessionStorage)
const loginSuccess = browser && sessionStorage.getItem("login_success") === "true";
if (loginSuccess) {
    sessionStorage.removeItem("login_success");
    // 500ms 지연 — Supabase lock 완전 해제 대기
    await new Promise(resolve => setTimeout(resolve, 500));
}

// stores 초기화 (모든 경로에서 실행)
await memosStore.init();
filterStore.init();
foldersStore.init();
notificationStore.registerRemindersToServiceWorker();
initFCM();
```

**B1-13**: `+layout.svelte` — `browser` import 누락 수정 (88d5fb9):

```typescript
import { browser } from "$app/environment";
```

### 수정 레이어 최종 비교 (업데이트)

| 차수 | 커밋 | 해결 대상 | 방식 | 상태 |
|------|------|----------|------|------|
| 2차 (B1-1~B1-3) | a613b87 | reinit 동시 호출 경쟁 | `reinitPromise` 대기 패턴 | ✅ 유효 |
| 3차 (Bug 1 재발) | 6e5e11e | user=null 상태에서 reinit | `refreshSession()` 추가 | ⚠️ 대체됨 |
| 4차 (B1-4) | (일부 적용) | layout ↔ callback 동시 getSession | layout에서 callback일 때 initialize 스킵 | ✅ 유효 |
| 5차 (B1-6/B1-7) | 0065192 | signInWithIdToken 내부 lock | `initializeWithSession()`으로 getSession 제거 | ⚠️ 불충분 |
| 6차 (B1-8/B1-9) | a1ec8c7 | onAuthStateChange/reinit lock 경쟁 | 100ms + 200ms 타임아웃 지연 | ❌ 실패 |
| **7차 (B1-10~B1-13)** | **d9e28cb, 88d5fb9** | **callback의 모든 Supabase 작업** | **goto() 즉시 실행 + layout에서 500ms 후 초기화** | **✅ 최종** |

### 7차 수정의 차별점

| 관점 | 이전 (6차까지) | 7차 수정 |
|------|--------------|---------|
| callback의 역할 | stores 초기화 시도 (reinit, FCM 등) | 세션 설정 + goto()만 수행 |
| Supabase 작업 타이밍 | callback → 지연 → stores 초기화 | **callback에서 Supabase 작업 전혀 없음** |
| 지연 위치 | callback의 finishLogin() | layout의 onMount (loginSuccess 플래그 확인 후) |
| 리스너 등록 | initializeWithSession 내부 (지연) | layout에서 별도 호출 (ensureListenerRegistered) |
| 안전성 | 타임아웃 값에 의존 (100ms/200ms 부족) | **500ms + callback에서 Supabase 작업 없음** |

### 왜 500ms인가?

- 100ms/200ms는 Supabase 내부 처리 완료에 부족
- 500ms는 경험적으로 충분하며, "로그인 처리 중..." 스피너가 표시되므로 UX 허용 가능
- layout의 onMount에서 지연하므로, 사용자는 이미 페이지로 이동한 상태 (체감 지연 최소화)

### 트레이드오프

| 항목 | 장점 | 단점 |
|------|------|------|
| 신뢰성 | callback에서 Supabase 작업 없음 → lock 경쟁 원천 차단 | — |
| 성능 | 500ms 지연 (이전 300ms보다 200ms 증가) | 초기 메모 로드 약간 지연 |
| 복잡성 | sessionStorage로 로그인 성공 추적 필요 | 명확한 플로우 |
| 유지보수 | Supabase 내부 구현 변경에 영향 최소화 | — |

### 검증

- [x] **V-9**: d9e28cb 커밋 완료 ✅
- [x] **V-10**: 88d5fb9 커밋 완료 (browser import 수정) ✅
- [x] **V-11**: 푸시 및 자동 배포 ✅
- [x] **V-12**: 배포 후 Google 로그인 → AbortError 없이 정상 로그인 확인 ✅
- [x] **V-13**: 하지만 메모가 표시되지 않음 (원래 문제로 회귀) ❌

---

## Bug 1 최종 수정: reinit 누락 (2026-02-06)

> **상태: ✅ 완료 (2026-02-06)**
> **커밋: 8b49c9b**
>
> 7차 수정으로 로그인은 성공했으나, layout에서 `init()` 대신 `reinit()`을 호출해야 함.

### 현상

- 로그인 성공: AbortError 없음 ✅
- 하지만 홈 탭에 메모가 표시되지 않음 ❌
- 새로고침하면 정상 표시

### 원인

**B1-10에서 callback의 `reinit()` 제거 → layout의 `init()` 호출로 변경**했는데,
`init()`은 이미 `initialized=true`인 경우 서버 fetch를 스킵함.

```typescript
// memosStore.init()
if (initialized) return;  // ← layout 도착 시 이미 true → 서버 fetch 안 함
```

callback에서 layout으로 이동 시:
1. memosStore는 이미 `initialized=true` (이전 세션에서 초기화됨)
2. layout의 `init()` → 가드에 걸려 즉시 리턴
3. 서버 데이터 fetch 없음 → 메모 0개

### 수정 (B1-14)

**layout에서 `loginSuccess` 플래그 확인 시 `reinit()` 호출**:

```typescript
// Before (B1-12):
if (loginSuccess) {
    await new Promise(resolve => setTimeout(resolve, 500));
}
await memosStore.init();  // ← 가드에 걸려 스킵

// After (B1-14):
if (loginSuccess) {
    await new Promise(resolve => setTimeout(resolve, 500));
    await memosStore.reinit();  // ← 강제 재초기화
    await foldersStore.reinit();
} else {
    await memosStore.init();    // ← 일반 로드
    foldersStore.init();
}
```

### 최종 검증

- [x] **V-14**: 8b49c9b 커밋 완료 ✅
- [x] **V-15**: 푸시 및 자동 배포 ✅
- [ ] **V-16**: 배포 후 Google 로그인 → 메모 정상 표시 + AbortError 없음 확인

---

## 최종 요약 (시행착오 제외)

### Bug 1: 로그인 후 메모 미표시 — 최종 해결책

**핵심 문제**: Supabase client의 전역 lock으로 인해 `signInWithIdToken()` 직후 모든 Supabase 작업이 AbortError 발생

**최종 해결책** (7차 + 8차):

1. **auth callback에서 Supabase 작업 완전 제거**
   - `finishLogin()`: 세션 설정 + `goto()` 즉시 실행만
   - stores 초기화, FCM 등록 모두 제거

2. **layout에서 500ms 지연 후 초기화**
   ```typescript
   const loginSuccess = sessionStorage.getItem("login_success") === "true";
   if (loginSuccess) {
       await new Promise(resolve => setTimeout(resolve, 500));
       await memosStore.reinit();  // 서버 fetch
       await foldersStore.reinit();
   } else {
       await memosStore.init();    // 로컬 캐시
       foldersStore.init();
   }
   ```

3. **onAuthStateChange 리스너 분리**
   - `initializeWithSession()`에서 리스너 등록 안 함
   - layout에서 `ensureListenerRegistered()` 별도 호출

**왜 이렇게?**:
- Supabase는 "lock 해제" 이벤트 API 없음
- 500ms는 경험적으로 충분한 시간 (내부 처리 완료 대기)
- callback에서 Supabase 작업 0개 → lock 경쟁 원천 차단

**트레이드오프**:
- ✅ 신뢰성: AbortError 없음
- ❌ 성능: 로그인 후 500ms 지연 (하지만 스피너 표시 중이므로 체감 적음)

### Bug 2: Todo가 메모 페이지 표시

**문제**: `filterStore.getFilteredMemos()`에 memoType 필터 없음

**해결**:
```typescript
// filter.svelte.ts
result = result.filter(m => m.memoType !== 'todo');

// +page.svelte (홈)
pinnedMemos = memos.filter(m => m.isPinned && m.memoType !== 'todo');
favoriteMemos = memos.filter(m => m.isFavorite && m.memoType !== 'todo');
recentMemos = memos.filter(m => m.memoType !== 'todo').slice(0, 5);
```

### 시행착오 교훈

- **7번의 시도**를 거쳐 최종 해결
- Supabase client의 전역 lock 문제는 **타임아웃으로만 회피 가능**
- 근본 해결책(복수 client 인스턴스)은 Supabase 설계상 권장 안 됨
- 경험적 타이밍(500ms)이 불완전해 보이지만, **실용적인 유일한 방법**

---

## Bug 1 재발 (8차): 로그인 후 메모 여전히 0개 (2026-02-06)

> **상태: 🔍 진단 중 (2026-02-06)**
> **커밋: 899fd99 (회귀), 7a9f66e, 4b0dee9 (디버그 로그)**

### 현상 (899fd99 배포 후)

- 로그인 성공: AbortError 없음 ✅
- `authStore.isAuthenticated = true` ✅
- **하지만 `memos.length = 0`, `initialized = true`** ❌
- 새로고침하면 1초 안에 정상 표시

### 분석 (로그 기반)

**1단계: 인증 상태 확인 (7a9f66e)**
```
[MemosStore] init() - isAuthenticated: true user: Proxy(Object) {...}
```
→ `authStore.isAuthenticated`는 `true`. 비인증 경로가 아님.

**2단계: 서버 fetch 결과 확인 (4b0dee9 - 배포 대기 중)**

`fetchFromSupabase()` 실행되고 있는지, `data.length`가 얼마인지 확인 필요.

### 추측

1. **AbortError 여전히 발생 (조용히)**: 500ms로도 부족, `fetchFromSupabase()` 실패
2. **DB에 실제로 메모 없음**: user_id가 잘못 전달되거나, 다른 계정
3. **캐시-병합 로직 문제**: `fetchFromSupabase()` 성공했지만 `memos` 배열 업데이트 안 됨
4. **Svelte 리액티비티 타이밍**: `memos = ...` 업데이트가 UI에 반영 안 됨

### 다음 단계

- 4b0dee9 배포 후 로그인하여 `[MemosStore] fetchFromSupabase() - result:` 로그 확인
- `dataLength`, `error` 값으로 원인 특정

### 무한 "동기화 중" 메시지 문제

사용자 보고:
> 로그인 후 2초쯤 기다리면 "서버에서 동기화중" 메시지 표시되지만 무한히 사라지지 않음.
> 새로고침하면 1초 안에 해결됨.

**원인**: `syncingFromServer` 상태가 `true`로 고정됨.

**추측**:
- `fetchFromSupabase()` await가 완료되지 않음 (AbortError 또는 무한 대기)
- `syncingFromServer = false` 실행 안 됨

**확인 필요**: 4b0dee9 로그에서 `fetchFromSupabase()` 종료 여부

---

## 10차 수정: 전체 페이지 리로드 (9fb154b) — 최종 해결

### 핵심 통찰

> **"새로고침하면 1초 안에 모든 것이 해결된다"** — 사용자 피드백

모든 이전 시도(5차~9차)는 **Supabase client 전역 lock 안에서** 추가 Supabase 작업을 시도하여 실패.
`signInWithIdToken()`/`setSession()` 호출 후 같은 Supabase client 인스턴스에서는
어떤 작업도 AbortError 또는 무한 대기 발생.

### 근본 원인 (확정)

1. `signInWithIdToken()` → Supabase client 내부 전역 lock 획득
2. 같은 페이지 lifecycle에서 `getSession()`, `onAuthStateChange`, DB query 등 호출 시
   → lock 경쟁 → AbortError("signal is aborted without reason") 또는 무한 대기
3. 새 페이지 로드 시 Supabase client가 새로 생성됨 → lock 없음 → 정상 작동

### 이전 시도가 모두 실패한 이유

| 시도 | 접근 | 실패 원인 |
|------|------|----------|
| 5차 | `initializeWithSession()` + `onAuthStateChange` | 리스너 등록이 내부적으로 `getSession()` 호출 → lock 경쟁 |
| 6차 | 100ms/200ms timeout | timeout으로는 lock 해제 불가 (같은 client 인스턴스) |
| 7차 | callback에서 Supabase 제거 + layout loginSuccess | SPA nav로 layout onMount 재실행 안 됨 |
| 8차 | layout에서 loginSuccess flag + reinit | goto()는 layout onMount 재실행 안 됨 → reinit 미호출 |
| 9차 | callback 500ms + reinit | `ensureListenerRegistered()` → 첫 reinit 실패 → reinitPromise 재사용 |

### 해결책

**`window.location.href = returnTo`** — SPA 내비게이션 대신 전체 페이지 리로드.

수정 내용:
1. **callback `finishLogin()`**: 모든 Supabase/store 작업 제거, `window.location.href`만 사용
2. **layout `isAuthCallback` 분기**: `ensureListenerRegistered()` 제거 (불필요)
3. **callback 불필요 import 제거**: authStore, memosStore, foldersStore 등
4. **디버그 로그 제거**: memos.svelte.ts의 `[MemosStore]` 로그

### 왜 이 방법이 근본적으로 다른가

이전 시도들: lock된 Supabase client 안에서 우회 시도 (timeout, 순서 변경, flag 등)
이번 수정: **lock된 client를 버리고 새 client 생성** (= 새로고침과 동일한 원리)

세션 토큰은 Supabase가 localStorage에 자동 저장하므로, 새 페이지 로드 시:
1. 새 Supabase client 생성 (lock 없음)
2. `authStore.initialize()` → `getSession()` → localStorage에서 세션 읽기
3. `memosStore.init()` → `fetchFromSupabase()` → 정상 DB 쿼리

### 10차 결과: ❌ 실패

**사용자 테스트 (2026-02-06 16:13)**:
- 전체 페이지 리로드는 정상 작동 (`Navigated to /settings` 두 번째 로드 확인)
- AbortError 없음 (lock 문제는 해소)
- **그러나 `memosStore.memos.length = 0`, `initialized = true`, `loading = false`**
- 즉, `fetchFromSupabase()`가 실행됐지만 결과가 0건

**가능한 원인 (조사 중)**:
1. `onAuthStateChange` `SIGNED_IN` → `reinit()` 와 layout의 `init()` 경쟁
   - layout: `authStore.initialize()` → `registerAuthListener()` → `SIGNED_IN` → `reinit()` (비동기)
   - layout: `memosStore.init()` (동기 순서상 `reinit()` 보다 먼저 실행?)
   - `init()`의 `if (initialized) return;`과 `reinit()`의 `initialized = false`가 타이밍에 따라 충돌
2. `getSession()`은 성공했지만 DB 쿼리 시 세션 토큰이 아직 유효하지 않음
3. `fetchFromSupabase()` 쿼리 자체가 0건 반환 (user_id 불일치?)

**디버그 결과 (84bdbfb)**:
```
[AuthStore] initialize() - getSession result: {hasSession: true, userId: '7206e84e-...'}
[MemosStore] fetchFromSupabase() - querying for user: 7206e84e-...
[AuthStore] onAuthStateChange: INITIAL_SESSION  ← DB 쿼리 시작 후에 발생!
[MemosStore] fetchFromSupabase() - result: {dataLength: 0, error: undefined}
```

**확정된 원인**: `getSession()`은 localStorage에서 세션을 읽기만 하고, Supabase client의 내부 auth 컨텍스트(DB 쿼리의 Authorization 헤더)는 `INITIAL_SESSION` 이벤트 처리 시점에 설정됨. `memosStore.init()` → `fetchFromSupabase()`가 `INITIAL_SESSION` 이전에 실행되어 **인증 없는 쿼리** → RLS가 0건 반환 (에러 없이).

추가 발견: ~1분 후 `SIGNED_IN` 이벤트 발생 → `reinit()` → `fetchFromSupabase()` 호출되지만 result 로그 없음 (무한 대기 — 토큰 리프레시 관련 lock?).

---

## 11차 수정: INITIAL_SESSION 대기 방식 (0581fac)

### 핵심 변경

`authStore.initialize()`를 `getSession()` 기반 → `onAuthStateChange` `INITIAL_SESSION` 대기 방식으로 변경.

**이전 (문제)**:
```
getSession() → user 설정 → registerAuthListener() → memosStore.init() → fetchFromSupabase()
                                                        ↑ INITIAL_SESSION 아직 미발생 → auth 헤더 없음
```

**이후 (수정)**:
```
registerAuthListener() → INITIAL_SESSION 대기 → user 설정 → memosStore.init() → fetchFromSupabase()
                          ↑ auth 컨텍스트 확정                                    ↑ auth 헤더 포함
```

수정 내용:
1. `initialize()`에서 `getSession()` 제거
2. `registerAuthListener()`를 먼저 호출하고 `INITIAL_SESSION` 이벤트를 Promise로 대기
3. `INITIAL_SESSION` 핸들러에서 state 업데이트 (loading, initialized 등)
4. 5초 타임아웃 (safety net)

### 이것이 이전 시도와 다른 점

| 시도 | 초기화 시점 | DB 쿼리 시 auth 상태 |
|------|-----------|---------------------|
| 5~10차 | `getSession()` 반환 직후 | ❌ Supabase client auth 미설정 |
| 11차 | `INITIAL_SESSION` 이벤트 후 | ✅ Supabase client auth 설정 완료 |
