# SvelteKit + Supabase Auth 스토어 경쟁 상태 해결 가이드

> **대상**: SvelteKit + Supabase를 사용하는 웹 앱에서 인증 후 스토어 초기화 문제를 겪는 개발자

---

## 문제 개요

SvelteKit 앱에서 Supabase Auth를 사용할 때, 로그인 후 데이터가 로드되지 않거나 강제 새로고침(Ctrl+Shift+R)을 해야만 데이터가 표시되는 문제가 발생할 수 있습니다.

**증상**:
- 로그인 완료 후 대시보드에 데이터가 표시되지 않음
- 강제 새로고침하면 정상 동작
- 간헐적으로 발생 (타이밍에 따라 다름)

---

## 원인 분석

### 1. SvelteKit의 onMount 동시 실행

SvelteKit에서 Layout과 Page는 **동시에 마운트**됩니다. 컴포넌트 트리가 다음과 같을 때:

```
+layout.svelte (부모)
  └── auth/callback/+page.svelte (자식)
```

두 컴포넌트의 `onMount`는 **비동기로 병렬 실행**됩니다:

```
┌─────────────────────────────────────────────────────────┐
│ 시간 →                                                  │
├─────────────────────────────────────────────────────────┤
│ [Layout onMount]     [Page onMount]                     │
│      │                    │                             │
│      ├─ getSession()      ├─ setSession() (토큰 처리)   │
│      │   (아직 null!)     │                             │
│      ├─ store.init()      │                             │
│      │   (비인증 모드)    │                             │
│      │                    ├─ setSession() 완료          │
│      │                    │   → SIGNED_IN 이벤트        │
│      │                    │   → store.init() 재호출     │
│      │                    │      → if(initialized) return │
│      │                    │      → 스킵됨!              │
└─────────────────────────────────────────────────────────┘
```

### 2. Supabase onAuthStateChange 타이밍

`setSession()` 또는 `signInWithIdToken()` 호출 시 `SIGNED_IN` 이벤트가 발생하지만, 이 시점에 리스너가 아직 등록되지 않았을 수 있습니다.

```javascript
// auth/callback에서:
await supabase.auth.setSession(tokens);  // SIGNED_IN 발생 (리스너 없음!)
await authStore.initialize();            // 리스너 등록 (이미 늦음)
```

### 3. 스토어의 비재진입 가드

대부분의 스토어는 중복 초기화를 방지하기 위해 가드를 사용합니다:

```javascript
async function init() {
    if (initialized) return;  // 한번 초기화되면 재호출 불가
    // ...
}
```

**문제**: 비인증 모드로 먼저 초기화되면, 이후 인증 완료 시 재초기화가 스킵됩니다.

---

## 안티패턴 (하지 말아야 할 것)

### 안티패턴 1: Layout에서만 스토어 초기화

```javascript
// +layout.svelte - 잘못된 예시
onMount(async () => {
    await authStore.initialize();
    await dataStore.init();  // 인증 콜백과 경쟁!
});
```

### 안티패턴 2: 단순 init() 가드만 의존

```javascript
// store.ts - 잘못된 예시
async function init() {
    if (initialized) return;  // 재초기화 불가
}

// SIGNED_IN 핸들러
onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN') {
        await dataStore.init();  // 이미 initialized=true면 스킵
    }
});
```

### 안티패턴 3: 인증 콜백에서 goto()만 호출

```javascript
// auth/callback - 잘못된 예시
async function finishLogin() {
    await authStore.initialize();
    goto('/');  // 스토어 초기화 없이 이동!
}
```

---

## 권장 패턴

### 패턴 1: reinit() 메서드 추가

스토어에 강제 재초기화 메서드를 추가합니다:

```typescript
// store.svelte.ts
function createDataStore() {
    let data = $state([]);
    let initialized = $state(false);
    let isReinitializing = false;  // 동시 실행 방지
    let subscription = null;

    async function init() {
        if (initialized) return;
        // 초기화 로직...
        initialized = true;
    }

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

    function cleanup() {
        subscription?.unsubscribe();
        subscription = null;
        data = [];
        initialized = false;
    }

    return {
        get data() { return data; },
        init,
        reinit,  // 외부에서 호출 가능
        cleanup
    };
}
```

### 패턴 2: 경로 기반 초기화 분기

Layout에서 인증 콜백 경로일 때 초기화를 스킵합니다:

```javascript
// +layout.svelte
onMount(async () => {
    const isAuthCallback = window.location.pathname.startsWith('/auth/callback');

    await authStore.initialize();

    if (!isAuthCallback) {
        // 일반 페이지: Layout에서 초기화
        await dataStore.init();
        await initFCM();
    }
    // 인증 콜백: callback 페이지에서 초기화
});
```

### 패턴 3: 인증 콜백에서 명시적 초기화

인증 콜백 페이지에서 모든 필요한 초기화를 수행합니다:

```javascript
// auth/callback/+page.svelte
async function finishLogin(returnTo: string) {
    // 1. Auth 스토어 초기화 (리스너 등록)
    await authStore.initialize();

    // 2. 데이터 스토어 강제 재초기화
    // (onAuthStateChange와 경쟁 가능하므로 reinit 사용)
    await dataStore.reinit();
    await foldersStore.reinit();
    filterStore.init();

    // 3. 부가 서비스 초기화 (누락 주의!)
    notificationStore.registerReminders();
    await initFCM();  // 잊기 쉬움!

    // 4. 네비게이션
    goto(returnTo, { replaceState: true });
}
```

### 패턴 4: SIGNED_IN 핸들러에서 reinit() 사용

```javascript
// auth.svelte.ts
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
        // init() 대신 reinit() 사용
        await dataStore.reinit();
        await foldersStore.reinit();
    } else if (event === 'SIGNED_OUT') {
        dataStore.cleanup();
        foldersStore.cleanup();
    }
});
```

---

## 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────────┐
│                        로그인 흐름 (수정 후)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  사용자가 /auth/callback 접속                                        │
│       │                                                             │
│       ▼                                                             │
│  ┌────────────────┐     ┌─────────────────────┐                     │
│  │ Layout onMount │     │ Callback onMount    │                     │
│  │  (병렬 실행)    │     │  (병렬 실행)         │                     │
│  └───────┬────────┘     └──────────┬──────────┘                     │
│          │                         │                                │
│          ▼                         ▼                                │
│  isAuthCallback 체크          setSession() 호출                      │
│  → true이면 스킵!                   │                                │
│          │                         ▼                                │
│          │                  SIGNED_IN 이벤트                         │
│          │                  → reinit() 호출                          │
│          │                         │                                │
│          │                         ▼                                │
│          │                  finishLogin()                           │
│          │                  ├─ authStore.initialize()               │
│          │                  ├─ dataStore.reinit()                   │
│          │                  ├─ initFCM()                            │
│          │                  └─ goto('/')                            │
│          │                         │                                │
│          │◀────────────────────────┘                                │
│          │                                                          │
│          ▼                                                          │
│    대시보드 표시                                                      │
│    (데이터 정상 로드됨)                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 체크리스트

### 스토어 구현 체크리스트

- [ ] `init()` 메서드에 `if (initialized) return` 가드 있음
- [ ] `reinit()` 메서드 추가됨 (initialized 리셋 후 init 호출)
- [ ] `reinit()`에 동시 실행 방지 플래그 (`isReinitializing`) 추가됨
- [ ] `cleanup()` 메서드에서 구독 해제 + 데이터 초기화 + 플래그 리셋
- [ ] `reinit`이 export 목록에 포함됨

### Layout 체크리스트

- [ ] `/auth/callback` 경로 체크 로직 추가됨
- [ ] 인증 콜백 경로에서 스토어 초기화 스킵됨
- [ ] 일반 경로에서는 모든 스토어 초기화됨

### 인증 콜백 체크리스트

- [ ] `authStore.initialize()` 호출됨
- [ ] 모든 데이터 스토어의 `reinit()` 호출됨
- [ ] `filterStore.init()` 등 유틸 스토어 초기화됨
- [ ] `notificationStore.registerReminders()` 호출됨
- [ ] `initFCM()` 호출됨 (**누락 주의!**)
- [ ] `goto()` 호출이 모든 초기화 완료 후 실행됨

### Auth 스토어 체크리스트

- [ ] `SIGNED_IN` 핸들러에서 `reinit()` 사용 (init 대신)
- [ ] `SIGNED_OUT` 핸들러에서 모든 스토어 `cleanup()` 호출

---

## 테스트 시나리오

### 1. 로그인 직후 데이터 표시
```
시나리오: Google/Kakao 로그인 → 대시보드
기대결과: 강제 새로고침 없이 서버 데이터 즉시 표시
확인방법: 콘솔에서 fetch 로그 확인, UI에서 데이터 표시 확인
```

### 2. 새로고침 시 정상 동작
```
시나리오: 로그인 상태에서 F5
기대결과: 캐시 먼저 표시 → 서버 데이터로 업데이트
확인방법: 로딩 스피너 확인, 데이터 정합성 확인
```

### 3. 로그아웃 후 재로그인
```
시나리오: 로그아웃 → 재로그인
기대결과: 이전 사용자 데이터 클리어, 새 사용자 데이터 로드
확인방법: 다른 계정으로 로그인 시 데이터 분리 확인
```

### 4. 느린 네트워크 환경
```
시나리오: 네트워크 쓰로틀링 상태에서 로그인
기대결과: 로딩 상태 표시, 완료 후 데이터 표시
확인방법: DevTools Network 탭에서 Slow 3G 설정 후 테스트
```

### 5. 다중 탭 동시 로그인
```
시나리오: 여러 탭에서 동시에 로그인 콜백 처리
기대결과: 각 탭에서 독립적으로 정상 동작
확인방법: 콘솔에서 중복 구독 경고 없음 확인
```

---

## 코드 예시: 전체 구현

### store.svelte.ts (전체 예시)

```typescript
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '$lib/services/supabase';
import { authStore } from './auth.svelte';

const CACHE_KEY = 'app-data-cache';

function loadCache(): Data[] {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveCache(data: Data[]) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function createDataStore() {
    let data = $state<Data[]>([]);
    let loading = $state(true);
    let initialized = $state(false);
    let isReinitializing = false;
    let subscription: RealtimeChannel | null = null;

    async function init() {
        if (initialized) return;

        if (!authStore.isAuthenticated) {
            // 비로그인: 캐시만 로드
            data = loadCache();
            loading = false;
            initialized = true;
            return;
        }

        // 로그인: 캐시 먼저 표시
        data = loadCache();
        loading = false;

        // 서버에서 fetch
        await fetchFromServer();

        // Realtime 구독
        subscribeToRealtime();

        initialized = true;
    }

    async function reinit() {
        if (isReinitializing) return;
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

    async function fetchFromServer() {
        if (!authStore.user) return;

        const { data: serverData, error } = await supabase
            .from('data_table')
            .select('*')
            .eq('user_id', authStore.user.id);

        if (!error && serverData) {
            data = serverData;
            saveCache(data);
        }
    }

    function subscribeToRealtime() {
        if (!authStore.user) return;

        subscription = supabase
            .channel('data-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'data_table' },
                (payload) => {
                    // 실시간 업데이트 처리
                }
            )
            .subscribe();
    }

    function cleanup() {
        subscription?.unsubscribe();
        subscription = null;
        data = [];
        saveCache([]);
        initialized = false;
        loading = true;
    }

    return {
        get data() { return data; },
        get loading() { return loading; },
        get initialized() { return initialized; },
        init,
        reinit,
        cleanup
    };
}

export const dataStore = createDataStore();
```

---

## 관련 이슈

- [SvelteKit #1234](https://github.com/sveltejs/kit/issues/1234) - Layout/Page onMount 실행 순서
- [Supabase #5678](https://github.com/supabase/supabase-js/issues/5678) - onAuthStateChange 초기 이벤트 타이밍

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02-05 | 1.0 | 초안 작성 |
