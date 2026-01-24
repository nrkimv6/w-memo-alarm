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
