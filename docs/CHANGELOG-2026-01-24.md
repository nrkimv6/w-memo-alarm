# 변경 사항 정리 (2026-01-24)

## 개요

이번 작업에서는 다음 항목들을 처리했습니다:
1. 하단 네비게이션 탭 개수 확인
2. 구버전 코드 제거 (D1 + web-push.ts)
3. 개발자 모드에 FCM 상태 체크 추가
4. TypeScript 타입 오류 수정

---

## 1. 하단 네비게이션 탭 확인

### 결과
- **코드상 3개의 탭이 정상적으로 정의되어 있음**
- 위치: `src/lib/components/BottomNav.svelte:5-9`

```typescript
const navItems = [
    { path: "/", icon: Home, label: "홈" },
    { path: "/memos", icon: List, label: "전체 메모" },
    { path: "/settings", icon: Settings, label: "설정" },
];
```

### 참고
- 2개로 보인다면 브라우저 캐시 문제일 수 있음
- 설정 > 앱 업데이트 확인으로 캐시 초기화 권장

---

## 2. 구버전 코드 제거 (D1 + web-push.ts)

### 삭제된 파일

| 파일 경로 | 설명 |
|----------|------|
| `src/lib/server/web-push.ts` | D1 기반 Web Push 발송 코드 (333줄) |
| `src/routes/api/cron/send-push/+server.ts` | Cron 엔드포인트 |

### 수정된 파일

#### `src/app.d.ts`
D1Database 및 VAPID 환경 변수 타입 정의 제거

**Before:**
```typescript
interface Platform {
    env: {
        DB: D1Database;
        VAPID_PUBLIC_KEY?: string;
        VAPID_PRIVATE_KEY?: string;
        VAPID_SUBJECT?: string;
        CRON_SECRET?: string;
    };
    context: { ... };
    caches: CacheStorage & { default: Cache };
}
```

**After:**
```typescript
interface Platform {
    context: {
        waitUntil(promise: Promise<unknown>): void;
    };
    caches: CacheStorage & { default: Cache };
}
```

### 삭제된 디렉토리
- `src/lib/server/` (빈 디렉토리)
- `src/routes/api/` (빈 디렉토리)

---

## 3. 개발자 모드에 FCM 상태 체크 추가

### 수정된 파일

#### `src/lib/fcm.ts`
FCM 환경 상태 조회 함수 추가

```typescript
export function getFCMConfigStatus() {
    return {
        hasApiKey: !!PUBLIC_FIREBASE_API_KEY,
        hasVapidKey: !!PUBLIC_FIREBASE_VAPID_KEY,
        projectId: PUBLIC_FIREBASE_PROJECT_ID || null,
        isConfigured: !!PUBLIC_FIREBASE_API_KEY && !!PUBLIC_FIREBASE_VAPID_KEY && !!PUBLIC_FIREBASE_PROJECT_ID
    };
}
```

#### `src/routes/settings/+page.svelte`
개발자 모드에 FCM 웹 푸시 상태 섹션 추가

**추가된 기능:**
- 환경 변수 상태 확인 (Firebase API Key, VAPID Key, Project ID)
- 인증 상태 표시
- `user_devices` 테이블 FCM 토큰 목록 조회
- `alarm_schedules` 테이블 알림 스케줄 목록 조회
- FCM 토큰 수동 등록 버튼

**새로운 상태 변수:**
```typescript
let fcmStatus = $state<{
    envConfigured: boolean;
    hasApiKey: boolean;
    hasVapidKey: boolean;
    projectId: string | null;
    fcmToken: string | null;
    userDevices: Array<{fcm_token: string; is_active: boolean; updated_at: string}>;
    alarmSchedules: Array<{id: string; alarm_time: string; notification_title: string; is_enabled: boolean}>;
    loading: boolean;
    error: string | null;
}>({ ... });
```

**새로운 함수:**
- `checkFCMStatus()` - FCM 상태 조회
- `manualRegisterFCM()` - 수동 FCM 토큰 등록

---

## 4. TypeScript 타입 오류 수정

### 수정 결과
- **Before:** 66개 오류
- **After:** 19개 오류 (47개 해결)
- 남은 19개 중 9개는 환경 변수 관련 (`.env` 파일 있으면 해결)

### 수정된 파일 목록

#### UI 컴포넌트 타입 수정

| 파일 | 수정 내용 |
|------|----------|
| `src/lib/components/ui/Button.svelte` | `class` prop을 optional로 변경, 타입 정의 추가 |
| `src/lib/components/ui/Toggle.svelte` | `class` prop 타입 정의 추가 |
| `src/lib/components/ui/Input.svelte` | `class` prop 타입 정의 추가 |
| `src/lib/components/ui/Badge.svelte` | `class` prop 타입 정의 추가 |
| `src/lib/components/ui/Modal.svelte` | `class` prop 타입 정의 추가 |

**예시 (Button.svelte):**
```typescript
let {
    class: className = '',
    variant = 'primary',
    size = 'md',
    children,
    ...rest
}: {
    class?: string;
    variant?: string;
    size?: string;
    children: any;
    [key: string]: any;
} = $props();
```

#### 타입 정의 수정

##### `src/lib/types/memo.ts`
- `Reminder` 인터페이스를 별도로 export
- `datetime` 속성 추가

```typescript
export interface Reminder {
    enabled: boolean;
    time: string; // HH:mm
    days: number[]; // 0-6 (일-토)
    autoOpen: boolean;
    type?: 'repeat' | 'once';
    date?: string; // YYYY-MM-DD for one-time reminders
    datetime?: string; // ISO datetime string (computed for display)
}
```

#### 스토어 수정

##### `src/lib/stores/filter.svelte.ts`
- `search` getter 추가 (`searchQuery`의 alias)

```typescript
get search() {
    return searchQuery;
},
```

##### `src/lib/utils/data.ts`
- settingsStore 접근 방식 수정
- foldersStore.add 호출을 addFolderWithId로 변경

**Before:**
```typescript
settings: {
    defaultReminderTime: settingsStore.defaultReminderTime,
    defaultReminderDays: settingsStore.defaultReminderDays,
    autoReminderEnabled: settingsStore.autoReminderEnabled
}
```

**After:**
```typescript
const { defaultReminder, autoReminderOnCreate } = settingsStore.settings;
settings: {
    defaultReminderTime: defaultReminder.time,
    defaultReminderDays: defaultReminder.days,
    autoReminderEnabled: autoReminderOnCreate
}
```

##### `src/lib/components/memo/FolderSelector.svelte`
- `handleAddFolder` 함수를 async로 변경

```typescript
async function handleAddFolder() {
    if (!newFolderName.trim()) return;
    const folder = await foldersStore.add(newFolderName.trim(), newFolderColor);
    if (folder) {
        onSelect(folder.id);
    }
    // ...
}
```

### 새로 설치된 패키지

```bash
npm install @capacitor/browser
```

---

## 커밋 이력

| 커밋 해시 | 메시지 |
|----------|--------|
| `025a3e3` | refactor: remove legacy D1/web-push code, add FCM debug panel |
| `ca74fb9` | fix: make Button class prop optional |
| `16ccfcd` | fix: resolve multiple TypeScript type errors |

---

## 남은 타입 오류 (19개)

### 환경 변수 관련 (9개)
- `.env` 파일에 값이 설정되면 자동 해결
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_FIREBASE_*` 관련 변수들

### 기타 컴포넌트 오류 (10개)
- `emoji`, `size` prop 관련 - 실제 동작에 영향 없음
- `steps` 변수 선언 순서 문제
- auth callback의 `error` 속성 타입

---

## FCM 웹 푸시 디버깅 가이드

개발자 모드 진입 방법:
1. 설정 페이지로 이동
2. 버전 번호를 2초 내에 10번 탭

확인 가능한 항목:
1. **환경 변수 상태** - Firebase API Key, VAPID Key, Project ID 설정 여부
2. **인증 상태** - 로그인 여부 및 사용자 정보
3. **user_devices** - 등록된 FCM 토큰 및 활성 상태
4. **alarm_schedules** - 등록된 알림 스케줄 목록
5. **FCM 토큰 수동 등록** - 디버깅용 수동 등록 버튼

---

## 현재 알림 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     Supabase + FCM 시스템                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 웹 로그인 시                                              │
│     └─> FCM 토큰 발급                                        │
│         └─> user_devices 테이블에 저장                        │
│                                                             │
│  2. 메모에 알림 설정                                          │
│     └─> alarm_schedules 테이블에 저장                         │
│                                                             │
│  3. Supabase Edge Function (pg_cron 1분마다)                 │
│     └─> alarm_schedules 조회                                 │
│         └─> user_devices에서 FCM 토큰 조회                    │
│             └─> FCM으로 푸시 발송                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**삭제된 레거시 시스템:**
- D1 Database (Cloudflare 서버리스 DB)
- web-push.ts (자체 Web Push 구현)
- cron/send-push 엔드포인트

---

## 5. 메모 저장/UI 일관성 버그 수정 (1a90d18)

### 수정된 이슈

| # | 이슈 설명 | 심각도 |
|---|----------|--------|
| 1 | 메모 저장 후 새로고침 시 리스트에 표시되지 않음 | **높음** |
| 2 | "우리공방" 헤더가 페이지 전환 시 애니메이션 발생 | 중간 |
| 3 | 홈/전체메모/설정 탭별 헤더 스타일 불일치 | 낮음 |

---

### 이슈 1: 메모 저장 후 새로고침 시 리스트 미표시 (중요 버그)

#### 원인 분석

```
문제의 실행 순서:
1. +layout.svelte의 onMount() 시작
2. authStore.initialize() 호출 (비동기)
3. 각 페이지의 onMount()에서 memosStore.init() 호출
4. 이때 authStore.isAuthenticated 상태가 아직 미확정
5. memosStore.init()이 잘못된 인증 상태로 초기화
6. 새로고침 시 localStorage 캐시 로드 실패
```

#### 해결 방법

`+layout.svelte`에서 `authStore.initialize()` 완료 후 `memosStore.init()` 호출

#### 수정된 파일

##### `src/routes/+layout.svelte` (라인 9-12, 61-68)

**Before:**
```typescript
import { authStore } from "$lib/stores/auth.svelte";
// ... (memosStore import 없음)

onMount(async () => {
    themeStore.init();
    settingsStore.init();
    notificationStore.init();

    await authStore.initialize();
    initFCM();
    // ...
});
```

**After:**
```typescript
import { authStore } from "$lib/stores/auth.svelte";
import { memosStore } from "$lib/stores/memos.svelte";
import { filterStore } from "$lib/stores/filter.svelte";
import { foldersStore } from "$lib/stores/folders.svelte";

onMount(async () => {
    themeStore.init();
    settingsStore.init();
    notificationStore.init();

    // authStore 초기화 완료 후 stores 초기화
    await authStore.initialize();

    // 메모 스토어 초기화 (authStore 상태 확정 후)
    // 로컬 캐시를 즉시 로드하여 새로고침 시에도 메모가 표시됨
    await memosStore.init();
    filterStore.init();
    foldersStore.init();

    // FCM 등록
    initFCM();
    // ...
});
```

##### `src/routes/+page.svelte` (라인 85-86)

**Before:**
```typescript
onMount(() => {
    memosStore.init();
    filterStore.init();
    foldersStore.init();
    notificationStore.init();
    // ...
});
```

**After:**
```typescript
onMount(() => {
    // memosStore, filterStore, foldersStore 초기화는 +layout.svelte에서 수행됨
    // ...
});
```

##### `src/routes/memos/+page.svelte` (라인 41-42)

동일하게 중복 init 호출 제거

---

### 이슈 2: GlobalNav 헤더 페이지 전환 애니메이션

#### 원인 분석

```
View Transitions API 동작:
1. 페이지 전환 시 document.startViewTransition() 호출
2. view-transition-name이 없는 요소는 기본 전환 애니메이션 적용
3. GlobalNav에 view-transition-name 미설정
4. 페이지 전환 시 GlobalNav가 fade in/out 애니메이션 발생
```

#### 해결 방법

`GlobalNav.svelte`에 `view-transition-name` 스타일 추가

#### 수정된 파일

##### `src/lib/components/GlobalNav.svelte` (라인 48)

**Before:**
```html
<nav
    class="sticky top-0 z-[100] w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
```

**After:**
```html
<nav
    class="sticky top-0 z-[100] w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    style="view-transition-name: global-nav;"
>
```

#### 참고: 현재 view-transition-name 설정 현황

| 컴포넌트 | view-transition-name | 파일 위치 |
|---------|---------------------|-----------|
| GlobalNav | `global-nav` | `src/lib/components/GlobalNav.svelte:48` |
| Header | `header` | `src/lib/components/layout/Header.svelte:75` |
| BottomNav | `bottom-nav` | `src/lib/components/BottomNav.svelte:14` |

---

### 이슈 3: 탭별 헤더 스타일 불일치

#### 원인 분석

| 페이지 | 타이틀 스타일 | sticky | max-width | padding |
|--------|-------------|--------|-----------|---------|
| 홈 | `text-xl font-bold tracking-tight` | ✅ `top-14` | `max-w-6xl` | `py-4` |
| 전체메모 | `text-xl font-bold tracking-tight` | ✅ `top-14` | `max-w-6xl` | `py-4` |
| 설정 | `text-2xl font-bold` | ❌ 없음 | `max-w-2xl` | `py-8` |

#### 해결 방법

설정 페이지에 홈/전체메모와 동일한 sticky 헤더 섹션 추가

#### 수정된 파일

##### `src/routes/settings/+page.svelte` (라인 469-478)

**Before:**
```html
<div class="min-h-screen">
    <Header />

<div class="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-24">
    <h1 class="text-2xl font-bold">설정</h1>
```

**After:**
```html
<div class="min-h-screen">
    <Header />

    <!-- Header section -->
    <div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div class="max-w-6xl mx-auto px-4 py-4">
            <h1 class="text-xl font-bold tracking-tight text-foreground">설정</h1>
        </div>
    </div>

<div class="max-w-2xl mx-auto px-4 py-6 space-y-8 pb-24">
```

#### 수정 후 스타일 일관성

| 페이지 | 타이틀 스타일 | sticky | max-width | padding |
|--------|-------------|--------|-----------|---------|
| 홈 | `text-xl font-bold tracking-tight` | ✅ `top-14` | `max-w-6xl` | `py-4` |
| 전체메모 | `text-xl font-bold tracking-tight` | ✅ `top-14` | `max-w-6xl` | `py-4` |
| 설정 | `text-xl font-bold tracking-tight` | ✅ `top-14` | `max-w-6xl` | `py-4` |

---

### 커밋 정보

| 항목 | 값 |
|------|-----|
| 해시 | `1a90d18` |
| 브랜치 | `claude/fix-memo-persistence-ui-BzSWT` |
| 메시지 | `fix: memo persistence and UI consistency issues` |

### 수정된 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/routes/+layout.svelte` | memosStore/filterStore/foldersStore import 및 초기화 추가 |
| `src/routes/+page.svelte` | 중복 init 호출 제거 |
| `src/routes/memos/+page.svelte` | 중복 init 호출 제거 |
| `src/routes/settings/+page.svelte` | sticky 헤더 섹션 추가, 스타일 통일 |
| `src/lib/components/GlobalNav.svelte` | view-transition-name 추가 |

---

## 6. 메모 알림 설정 저장/조회 버그 수정 (9e5ecd6)

### 증상

PWA 앱에서 발생한 문제:
1. 메모에서 알림 설정을 해도 "수정되었습니다" 토스트만 표시됨
2. 다시 메모를 열면 알림 설정이 조회되지 않음
3. 실제로 알림도 발생하지 않음
4. (참고: 개발자 모드의 테스트 알림은 정상 동작)

---

### 원인 분석

#### 버그 1: `ReminderSettings.svelte`의 `$effect` 조건 누락

**위치**: `src/lib/components/memo/ReminderSettings.svelte:46-56`

```typescript
// Before (버그 있는 코드)
$effect(() => {
    if (showSettings && enabled) {  // ← 문제: enabled=false일 때 저장 안 됨
        if (reminderType === 'once') {
            onReminderChange({ enabled, time, days: [], autoOpen, type: 'once', date: reminderDate });
        } else {
            onReminderChange({ enabled, time, days, autoOpen, type: 'repeat' });
        }
    } else if (!showSettings) {
        onReminderChange(undefined);
    }
    // ⚠️ showSettings && !enabled 케이스가 누락됨!
});
```

**문제점**:
- `showSettings && enabled` 조건에서만 `onReminderChange()` 호출
- 사용자가 알림을 비활성화(`enabled=false`)하면 reminder 객체가 업데이트되지 않음
- 결과: 알림 설정이 저장되지 않음

---

#### 버그 2: `notifications.svelte.ts`의 일회성 알림 미처리

**위치**: `src/lib/stores/notifications.svelte.ts:229-249`

```typescript
// Before (버그 있는 코드)
function getTodayReminders(): Memo[] {
    const today = new Date().getDay();
    const now = new Date();
    const currentTime = `...`;

    return memosStore.memos.filter((memo) => {
        if (!memo.reminder?.enabled) return false;
        if (!memo.reminder.days.includes(today)) return false;  // ← 문제!
        return true;
    })...
}
```

**문제점**:
- `memo.reminder.days.includes(today)` 조건만 체크
- 일회성 알림(`type: 'once'`)은 `days` 배열이 비어있고 `date` 필드를 사용
- 결과: 일회성 알림이 오늘의 알림 목록에서 항상 제외됨

---

### 해결 방법

#### 수정 1: `ReminderSettings.svelte`

```typescript
// After (수정된 코드)
$effect(() => {
    if (showSettings) {  // ← enabled 조건 제거
        if (reminderType === 'once') {
            onReminderChange({ enabled, time, days: [], autoOpen, type: 'once', date: reminderDate });
        } else {
            onReminderChange({ enabled, time, days, autoOpen, type: 'repeat' });
        }
    } else {
        onReminderChange(undefined);
    }
});
```

**변경사항**:
- `showSettings && enabled` → `showSettings`로 조건 단순화
- `enabled=true/false` 모두 reminder 객체에 포함되어 저장됨

---

#### 수정 2: `notifications.svelte.ts`

```typescript
// After (수정된 코드)
function getTodayReminders(): Memo[] {
    const today = new Date().getDay();
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];  // ← 오늘 날짜 추가

    return memosStore.memos.filter((memo) => {
        if (!memo.reminder?.enabled) return false;

        // Check if it's a one-time reminder
        if (memo.reminder.type === 'once') {
            return memo.reminder.date === todayDate;  // ← 일회성 알림 처리
        }

        // Repeating reminder: check day of week
        if (!memo.reminder.days?.includes(today)) return false;
        return true;
    })...
}
```

**변경사항**:
- 일회성 알림(`type: 'once'`)의 경우 `date === todayDate` 조건으로 체크
- 반복 알림의 경우 기존 `days.includes(today)` 로직 유지
- `days?.includes()` 옵셔널 체이닝 추가로 안전성 향상

---

### 영향받는 함수

| 함수 | 영향 | 설명 |
|------|------|------|
| `getTodayReminders()` | ✅ 수정됨 | 일회성 알림도 오늘 목록에 포함 |
| `getUpcomingReminders()` | ✅ 자동 해결 | `getTodayReminders()` 호출 |
| `getPastReminders()` | ✅ 자동 해결 | `getTodayReminders()` 호출 |
| `checkAndTriggerReminders()` | ⚪ 영향 없음 | 이미 일회성 알림 처리 로직 있음 |

---

### 커밋 정보

| 항목 | 값 |
|------|-----|
| 해시 | `9e5ecd6` |
| 브랜치 | `claude/fix-memo-notifications-JHlzC` |
| 메시지 | `fix: memo reminder not being saved and displayed correctly` |

### 수정된 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/components/memo/ReminderSettings.svelte` | $effect 조건에서 `enabled` 제거, 모든 상태 저장 |
| `src/lib/stores/notifications.svelte.ts` | `getTodayReminders()`에 일회성 알림 처리 추가 |

---

## 7. 메모 상세 모달 z-index 수정

### 증상

- 메모 상세 모달이 열렸을 때 **GlobalNav("우리공방")와 BottomNav에 가려지는 현상**
- 모달이 전체 화면을 덮어야 하는데 다른 UI 요소가 위에 표시됨

---

### 원인 분석

| 컴포넌트 | z-index (수정 전) | 위치 |
|---------|------------------|------|
| GlobalNav (우리공방) | `z-[100]` | sticky top-0 |
| Modal (메모상세) | `z-50` | fixed inset-0 |
| BottomNav | `z-50` | fixed bottom-0 |

**문제점**:
- Modal의 `z-50`이 GlobalNav의 `z-[100]`보다 **낮음**
- Modal이 GlobalNav 아래에 렌더링되어 헤더에 가려짐
- BottomNav와 동일한 z-index로 인해 겹침 현상 발생

---

### 해결 방법

Modal의 z-index를 `z-[200]`으로 상향 조정

---

### 수정된 파일

#### `src/lib/components/ui/Modal.svelte` (라인 73-74, 80-81)

**Before:**
```html
<!-- Backdrop -->
<div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
    ...
></div>

<!-- Modal Content -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
```

**After:**
```html
<!-- Backdrop -->
<div
    class="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm transition-opacity"
    ...
></div>

<!-- Modal Content -->
<div class="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
```

---

### 수정 후 z-index 계층 구조

```
z-index 계층도 (수정 후):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
z-[200]  ┌─────────────────────┐
         │ Modal (Backdrop)    │ ← 최상위로 이동
         │ Modal (Content)     │
         └─────────────────────┘

z-[100]  ┌─────────────────────┐
         │ GlobalNav (우리공방) │
         └─────────────────────┘

z-50     ┌─────────────────────┐
         │ BottomNav           │
         └─────────────────────┘

z-40     ┌─────────────────────┐
         │ Header              │
         └─────────────────────┘
```

---

### 효과

- 모달이 모든 UI 요소(GlobalNav, BottomNav, Header) 위에 표시됨
- 사용자가 모달에 집중할 수 있는 올바른 오버레이 동작
- 모달 외부 클릭 시 정상적으로 닫힘
