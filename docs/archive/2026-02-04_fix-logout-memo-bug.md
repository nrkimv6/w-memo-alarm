# 로그아웃 시 메모/알림 미정리 버그 수정 계획

## 진행 상태
- [x] `memos.svelte.ts` - cleanup() 보강
- [x] `folders.svelte.ts` - cleanup() 보강
- [x] `notifications.svelte.ts` - cleanup() 메서드 추가
- [x] `auth.svelte.ts` - SIGNED_OUT 핸들러 보강
- [x] 빌드 검증 (수정 파일 에러 0건, 기존 에러만 존재)
- [x] 커밋 & 푸시 (45c8184)

## 버그 분석

### 현재 로그아웃 시 cleanup 동작 (문제점)

`auth.svelte.ts`의 `SIGNED_OUT` 핸들러:
```typescript
} else if (event === 'SIGNED_OUT') {
    state.user = null;
    state.session = null;
    memosStore.cleanup();    // Realtime 구독 해제 + syncQueue 클리어만 함
    foldersStore.cleanup();  // Realtime 구독 해제만 함
    toastStore.info('로그아웃되었습니다');
}
```

**`memosStore.cleanup()`** (memos.svelte.ts:981-985):
- Realtime 구독 해제 ✅
- SyncQueue 클리어 ✅
- **메모 배열(`memos`) 미초기화** ❌ → 로그아웃 후에도 메모 리스트에 표시됨
- **localStorage 캐시 미삭제** ❌ → 새로고침해도 이전 메모 보임
- **`initialized` 플래그 미리셋** ❌ → 재로그인 시 init() 재호출 불가

**`foldersStore.cleanup()`** (folders.svelte.ts:290-293):
- Realtime 구독 해제 ✅
- **폴더 배열 미초기화** ❌
- **localStorage 캐시 미삭제** ❌
- **`initialized` 플래그 미리셋** ❌

**알림 관련 미처리:**
- Service Worker에 등록된 리마인더 미해제 ❌
- 포그라운드 백그라운드 체크 인터벌 미중지 ❌
- FCM 토큰 비활성화 미호출 ❌
- 스누즈 상태 미정리 ❌

---

## 수정 계획

### 1. `memosStore.cleanup()` 보강
**파일**: `src/lib/stores/memos.svelte.ts` (981-985줄)

```typescript
function cleanup() {
    subscription?.unsubscribe();
    subscription = null;
    syncQueue.clear();
    // 추가: 메모 데이터 초기화
    memos = [];
    saveCacheToStorage([]);
    initialized = false;
    loading = true;
}
```

### 2. `foldersStore.cleanup()` 보강
**파일**: `src/lib/stores/folders.svelte.ts` (290-293줄)

```typescript
function cleanup() {
    subscription?.unsubscribe();
    subscription = null;
    // 추가: 폴더 데이터 초기화
    folders = [];
    saveCacheToStorage([]);
    initialized = false;
    loading = true;
}
```

### 3. `notificationStore`에 `cleanup()` 메서드 추가
**파일**: `src/lib/stores/notifications.svelte.ts`

- `cleanup()` 메서드 신규 추가 및 export:
  - `stopBackgroundCheck()` 호출 → 60초 인터벌 중지
  - Service Worker에 빈 리마인더 배열 전송 → 등록된 알림 모두 해제
  - `snoozedReminders = []` + localStorage 클리어
  - `lastNotifiedMap = {}` + localStorage 클리어
  - `initialized = false` 리셋

```typescript
async function cleanup() {
    stopBackgroundCheck();
    // SW 리마인더 모두 해제
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration.active) {
                registration.active.postMessage({
                    type: SW_MSG.REGISTER_MEMO_REMINDERS,
                    reminders: []
                });
            }
        } catch (e) {
            log.error('Failed to clear SW reminders', e);
        }
    }
    snoozedReminders = [];
    saveSnoozed();
    lastNotifiedMap = {};
    saveLastNotified();
    initialized = false;
}
```

### 4. `auth.svelte.ts`의 `SIGNED_OUT` 핸들러 보강
**파일**: `src/lib/stores/auth.svelte.ts` (83-90줄)

- 유저 정보가 아직 남아있을 때 FCM 토큰 비활성화 먼저 수행
- `notificationStore.cleanup()` 호출 추가

```typescript
} else if (event === 'SIGNED_OUT') {
    // FCM 토큰 비활성화 (user 정보 사라지기 전에 호출)
    if (state.user?.id) {
        deactivateAllFCMTokens(state.user.id);
    }
    state.user = null;
    state.session = null;
    state.hasShownLoginToast = false;
    // Store 클린업
    memosStore.cleanup();
    foldersStore.cleanup();
    notificationStore.cleanup();
    toastStore.info('로그아웃되었습니다');
}
```

필요한 import 추가:
- `import { deactivateAllFCMTokens } from '$lib/fcm';`
- `import { notificationStore } from './notifications.svelte';`

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `cleanup()`에 메모 배열/캐시/플래그 초기화 추가 |
| `src/lib/stores/folders.svelte.ts` | `cleanup()`에 폴더 배열/캐시/플래그 초기화 추가 |
| `src/lib/stores/notifications.svelte.ts` | `cleanup()` 메서드 신규 추가 및 export |
| `src/lib/stores/auth.svelte.ts` | SIGNED_OUT 핸들러에 FCM 비활성화 + notificationStore.cleanup() 추가 |

## 검증 방법

1. 로그인 → 메모 생성 → 알림 설정 → 로그아웃
2. 확인사항:
   - 메모 리스트가 비어있는지 (샘플 메모만 표시되는지)
   - 메모 상세 접근이 불가한지
   - Service Worker 알림이 해제되었는지
   - FCM 토큰이 비활성화되었는지
3. 재로그인 시 서버에서 메모가 정상적으로 다시 로드되는지
4. `npm run build` 빌드 성공 확인
