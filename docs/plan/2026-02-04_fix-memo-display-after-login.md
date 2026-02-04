# 로그인 후 메모 미표시 버그 수정 계획

## 증상
- 웹에서 로그인 후 메모가 표시되지 않음
- `Ctrl+Shift+R` (강제 새로고침) 해야 메모가 정상 표시됨

## 진행 상태
- [ ] 원인 분석 완료
- [ ] `auth/callback/+page.svelte` - `finishLogin()` 수정
- [ ] `memos.svelte.ts` - `init()` 재진입 가능하도록 수정
- [ ] `+layout.svelte` - 인증 상태 변경 시 스토어 재초기화 로직 추가
- [ ] 빌드 검증
- [ ] 커밋 & 푸시

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

## 수정 계획

### 수정 전략: Callback 중심의 순차 실행

`/auth/callback`에서 인증이 완료된 후에만 스토어를 초기화하고, Layout의 조기 초기화를 방지한다.

### 수정 1: `auth/callback/+page.svelte` - finishLogin() 강화

**파일**: `src/routes/auth/callback/+page.svelte` (158-171줄)

**문제**: `finishLogin()`이 `authStore.initialize()`만 호출하고 메모 스토어 초기화를 보장하지 않음

**수정 내용**:
```typescript
async function finishLogin(returnTo: string) {
    status = "로그인 완료...";

    if (browser) {
        sessionStorage.setItem("login_success", "true");
    }

    // Auth store 초기화 - 세션이 이미 설정된 상태이므로 인증됨
    await authStore.initialize();

    // 스토어 초기화를 명시적으로 보장
    // (onAuthStateChange에서 이미 호출되었을 수 있지만, 안전하게 재호출)
    await memosStore.init();
    await foldersStore.init();

    goto(returnTo, { replaceState: true });
}
```

이 수정만으로는 불충분. `memosStore.init()`이 이미 비인증 모드로 초기화된 경우 가드에 의해 스킵됨.

### 수정 2: `memos.svelte.ts` - 재초기화 지원

**파일**: `src/lib/stores/memos.svelte.ts` (225-296줄)

**문제**: `init()`이 `initialized = true`이면 무조건 스킵하므로 인증 상태 변경 후 재초기화 불가

**수정안 A (권장): `reinit()` 메서드 추가**

```typescript
// 인증 상태 변경 시 강제 재초기화
async function reinit() {
    // 기존 구독 정리
    subscription?.unsubscribe();
    subscription = null;

    // 초기화 플래그 리셋 (데이터는 유지하여 UI 깜빡임 방지)
    initialized = false;

    // 재초기화
    await init();
}
```

export 목록에 `reinit` 추가.

### 수정 3: `auth.svelte.ts` - SIGNED_IN 핸들러에서 `reinit()` 호출

**파일**: `src/lib/stores/auth.svelte.ts` (70-84줄)

**문제**: `SIGNED_IN` 이벤트에서 `memosStore.init()`을 호출하지만 이미 초기화된 경우 스킵됨

**수정 내용**:
```typescript
supabase.auth.onAuthStateChange(async (event, newSession) => {
    const wasLoggedIn = !!state.user;
    state.session = newSession;
    state.user = newSession?.user || null;

    if (event === 'SIGNED_IN' && newSession?.user) {
        // reinit으로 변경: 비인증 모드로 먼저 초기화된 경우에도 재초기화
        await memosStore.reinit();
        await foldersStore.reinit();

        if (!wasLoggedIn && !state.hasShownLoginToast) {
            state.hasShownLoginToast = true;
            toastStore.success('로그인되었습니다');
        }
    } else if (event === 'SIGNED_OUT') {
        // ... (기존 코드 유지)
    }
});
```

### 수정 4: `folders.svelte.ts` - `reinit()` 메서드 추가

**파일**: `src/lib/stores/folders.svelte.ts`

`memosStore`와 동일한 패턴으로 `reinit()` 메서드 추가:
```typescript
async function reinit() {
    subscription?.unsubscribe();
    subscription = null;
    initialized = false;
    await init();
}
```

export 목록에 `reinit` 추가.

### 수정 5 (선택사항): `+layout.svelte` - 로그인 콜백 경로 시 조기 초기화 방지

**파일**: `src/routes/+layout.svelte` (89-112줄)

Layout의 `onMount`에서 `/auth/callback` 경로일 때는 스토어 초기화를 지연:
```typescript
onMount(async () => {
    themeStore.init();
    settingsStore.init();
    notificationStore.init();
    notificationHistoryStore.init();

    await authStore.initialize();

    // auth callback 페이지에서는 스토어 초기화를 callback에 위임
    // (callback에서 setSession → authStore.initialize → reinit 순서 보장)
    const isAuthCallback = window.location.pathname.startsWith('/auth/callback');
    if (!isAuthCallback) {
        await memosStore.init();
        filterStore.init();
        foldersStore.init();

        notificationStore.registerRemindersToServiceWorker();
        initFCM();
    }

    setupShareIntentListener(handleShareIntent);
});
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `reinit()` 메서드 추가, export |
| `src/lib/stores/folders.svelte.ts` | `reinit()` 메서드 추가, export |
| `src/lib/stores/auth.svelte.ts` | `SIGNED_IN` 핸들러에서 `reinit()` 호출 |
| `src/routes/auth/callback/+page.svelte` | `finishLogin()`에서 스토어 초기화 보장 |
| `src/routes/+layout.svelte` | (선택) auth callback 경로 시 조기 초기화 방지 |

## 영향 범위

- 로그인 흐름 (Google, Kakao 모두 동일 경로 사용)
- 네이티브 앱 로그인 (동일 callback 사용하므로 동일 수정 적용)
- `reinit()`은 기존 `cleanup()` + `init()` 조합이므로 기존 동작 영향 없음

## 검증 방법

1. **로그인 직후 메모 표시 확인**
   - Google/Kakao 로그인 → 대시보드에 서버 메모 즉시 표시되는지 확인
   - `Ctrl+Shift+R` 없이도 정상 동작하는지 확인

2. **기존 기능 회귀 테스트**
   - 이미 로그인된 상태에서 페이지 새로고침 → 메모 정상 표시
   - 로그아웃 → 메모 클리어 확인
   - 로그아웃 → 재로그인 → 메모 정상 표시

3. **엣지 케이스**
   - 느린 네트워크에서 로그인 후 메모 표시
   - 여러 탭에서 동시 로그인 시 동작

4. `npm run build` 빌드 성공 확인
