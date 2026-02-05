# 로그인 후 메모 미표시 버그 수정 계획

## 증상
- 웹에서 로그인 후 메모가 표시되지 않음
- `Ctrl+Shift+R` (강제 새로고침) 해야 메모가 정상 표시됨

## 진행 상태

### Phase 1: 기본 수정 (완료)
- [x] 원인 분석 완료
- [x] `memos.svelte.ts` - `reinit()` 메서드 추가
- [x] `folders.svelte.ts` - `reinit()` 메서드 추가
- [x] `auth.svelte.ts` - `SIGNED_IN` 핸들러에서 `reinit()` 호출
- [x] `auth/callback/+page.svelte` - `finishLogin()`에서 스토어 초기화 보장
- [x] `+layout.svelte` - auth callback 경로 시 조기 초기화 방지
- [x] 커밋 (8fd01bd)

### Phase 2: 추가 수정 (완료)
- [x] `memos.svelte.ts` - `reinit()` 동시 실행 방지 가드 추가
- [x] `folders.svelte.ts` - `reinit()` 동시 실행 방지 가드 추가
- [x] `auth/callback/+page.svelte` - `initFCM()` 호출 추가
- [x] 개발자 가이드 문서 작성 (`docs/guides/auth-store-race-condition-guide.md`)

---

## 원인 분석

### 전체 로그인 흐름

```
사용자가 로그인 클릭
  → auth.woory.day (외부 인증 Worker)로 리다이렉트
  → 인증 완료 후 /auth/callback?provider=...&tokens=... 로 리다이렉트
  → callback 페이지 onMount에서 토큰 처리
  → finishLogin() → goto("/")
  → 대시보드에서 메모 표시
```

### 컴포넌트 트리 & onMount 실행 순서

`/auth/callback` 페이지 로드 시 컴포넌트 트리:
```
+layout.svelte (부모)
  └── auth/callback/+page.svelte (자식)
```

Svelte에서 **자식의 `onMount`가 부모보다 먼저 스케줄링**됨. 두 `onMount`는 **비동기로 동시 실행**됨.

### 경쟁 상태 (Race Condition) - 핵심 원인

**두 개의 `onMount`가 동시에 실행되면서 타이밍에 따라 버그 발생:**

#### 시나리오 (버그 발생)

```
시간순서:
────────────────────────────────────────────────────────────
[callback onMount]                [layout onMount]
  │                                 │
  ├─ parseQueryParams()             ├─ authStore.initialize() 시작
  ├─ supabase.auth.setSession()     │   ├─ getSession() 호출 ← ⚠️ setSession 완료 전!
  │   (비동기, 아직 완료 안됨)        │   ├─ session = null (아직 없음)
  │                                 │   ├─ state.user = null
  │                                 │   ├─ state.initialized = true ← ⚠️ 인증 안된 상태로 확정
  │                                 │   └─ onAuthStateChange 리스너 등록
  │                                 │
  │                                 ├─ memosStore.init() 호출
  │                                 │   ├─ authStore.isAuthenticated = false ← ⚠️
  │                                 │   ├─ localStorage에서 로컬 캐시 로드 (비로그인 모드)
  │                                 │   └─ initialized = true ← ⚠️ 비인증 모드로 초기화 완료
  │                                 │
  ├─ setSession() 완료              │
  │   └─ SIGNED_IN 이벤트 발생       │
  │       └─ onAuthStateChange 핸들러:
  │           └─ memosStore.init()
  │               └─ if (initialized) return ← ⚠️ 이미 true! 스킵됨!
  │                                 │
  ├─ finishLogin()                  │
  │   ├─ authStore.initialize()     │
  │   │   └─ if (state.initialized) return ← 이미 true! 스킵
  │   └─ goto("/") ← 대시보드로 이동
  │                                 │
  ──── "/" 대시보드 표시 ────────────
  │
  memosStore.memos = 로컬 캐시(비로그인) 또는 빈 배열
  └─ 서버 메모가 표시되지 않음!
────────────────────────────────────────────────────────────
```

### 버그의 3가지 핵심 포인트

#### 1. `authStore.initialize()`의 `getSession()`이 `setSession()` 완료 전에 실행
- Layout의 `onMount`와 Callback의 `onMount`가 동시 실행
- Layout이 `getSession()`을 호출할 때 아직 `setSession()`이 완료되지 않아 `null` 반환
- 인증되지 않은 상태로 `initialized = true` 설정됨

#### 2. `memosStore.init()`의 비재진입 가드
```typescript
async function init() {
    if (initialized) return;  // ← 한번 초기화되면 재호출 불가
    ...
}
```
- 비로그인 모드로 먼저 초기화 → `initialized = true`
- 이후 `SIGNED_IN` 이벤트에서 `init()` 재호출 → 가드에 의해 스킵

#### 3. Layout의 `onMount`는 한 번만 실행
- `/auth/callback` → `goto("/")` 이동 시 Layout은 이미 마운트된 상태
- Layout의 `onMount`는 재실행되지 않음
- 따라서 `memosStore.init()`도 재호출되지 않음

### `Ctrl+Shift+R`로 해결되는 이유

강제 새로고침 시:
1. 전체 페이지가 새로 로드됨
2. Supabase 세션이 이미 쿠키/localStorage에 저장된 상태
3. Layout `onMount` → `getSession()` → 세션 정상 반환
4. `memosStore.init()` → `authStore.isAuthenticated = true` → 서버에서 메모 정상 fetch

---

## 수정 내용

### Phase 1: 기본 수정

#### 수정 1: `reinit()` 메서드 추가

`memos.svelte.ts`, `folders.svelte.ts`에 강제 재초기화 메서드 추가:
```typescript
async function reinit() {
    subscription?.unsubscribe();
    subscription = null;
    initialized = false;
    await init();
}
```

#### 수정 2: `SIGNED_IN` 핸들러에서 `reinit()` 호출

`auth.svelte.ts`에서 `init()` 대신 `reinit()` 사용:
```typescript
if (event === 'SIGNED_IN' && newSession?.user) {
    await memosStore.reinit();
    await foldersStore.reinit();
}
```

#### 수정 3: `+layout.svelte` - 경로 기반 분기

```typescript
const isAuthCallback = window.location.pathname.startsWith('/auth/callback');
if (!isAuthCallback) {
    await memosStore.init();
    // ...
}
```

#### 수정 4: `auth/callback/+page.svelte` - 명시적 초기화

```typescript
async function finishLogin(returnTo: string) {
    await authStore.initialize();
    await memosStore.reinit();
    await foldersStore.reinit();
    filterStore.init();
    notificationStore.registerRemindersToServiceWorker();
    goto(returnTo, { replaceState: true });
}
```

### Phase 2: 추가 수정

#### 수정 5: `reinit()` 동시 실행 방지 가드

`onAuthStateChange`와 `finishLogin()`에서 동시에 `reinit()` 호출 시 경쟁 상태 방지:

```typescript
let isReinitializing = false;

async function reinit() {
    if (isReinitializing) return;  // 동시 호출 방지
    isReinitializing = true;
    try {
        subscription?.unsubscribe();
        subscription = null;
        initialized = false;
        await init();
    } finally {
        isReinitializing = false;
    }
}
```

#### 수정 6: FCM 초기화 추가

`auth/callback/+page.svelte`에서 FCM 초기화 누락 수정:
```typescript
import { initFCM } from "$lib/fcm";

async function finishLogin(returnTo: string) {
    // ... 기존 코드 ...
    notificationStore.registerRemindersToServiceWorker();
    initFCM();  // ← 추가
    goto(returnTo, { replaceState: true });
}
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `reinit()` 메서드 + 동시 실행 방지 가드 |
| `src/lib/stores/folders.svelte.ts` | `reinit()` 메서드 + 동시 실행 방지 가드 |
| `src/lib/stores/auth.svelte.ts` | `SIGNED_IN` 핸들러에서 `reinit()` 호출 |
| `src/routes/auth/callback/+page.svelte` | `finishLogin()` 강화 + `initFCM()` 추가 |
| `src/routes/+layout.svelte` | auth callback 경로 시 조기 초기화 방지 |
| `docs/guides/auth-store-race-condition-guide.md` | **신규** - 개발자 가이드 |

## 검증 방법

1. **로그인 직후 메모 표시 확인**
   - Google/Kakao 로그인 → 대시보드에 서버 메모 즉시 표시되는지 확인
   - `Ctrl+Shift+R` 없이도 정상 동작하는지 확인

2. **FCM 초기화 확인**
   - 로그인 후 콘솔에서 `[FCM]` 로그 확인
   - 메모에 알림 설정 후 푸시 수신 확인

3. **기존 기능 회귀 테스트**
   - 이미 로그인된 상태에서 페이지 새로고침 → 메모 정상 표시
   - 로그아웃 → 메모 클리어 확인
   - 로그아웃 → 재로그인 → 메모 정상 표시

4. **엣지 케이스**
   - 느린 네트워크에서 로그인 후 메모 표시
   - 여러 탭에서 동시 로그인 시 동작

5. `npm run build` 빌드 성공 확인
