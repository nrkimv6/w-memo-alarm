# PWA 알림 등록 실패 이슈 분석 보고서

**작성일**: 2026-02-02
**상태**: 완료

--> .\2026-02-03_memo-alarm-fcm-join-fix.md 참고

---

## 1. 문제 현상

### 사용자 보고
- Service Worker에 등록된 알림이 **0개**로 표시
- 수십 번 등록 시도해도 실패
- 앱 내에는 2개의 활성화된 알림이 있음

### 로그 분석
```
오후 3:43:48 [Notification] Failed to register reminders to SW {}
오후 3:43:48 [Notification] 📤 Registering 2 reminders to SW
오후 3:43:45 [Notification] Failed to register reminders to SW {}
오후 3:43:45 [Notification] 📤 Registering 2 reminders to SW
```

**이상한 점**:
1. `Failed` 로그와 `Registering 2` 로그가 같은 시간에 출력 → **여러 번 호출**되고 있음
2. 에러 객체가 `{}` (빈 객체) → 에러 정보가 제대로 전달되지 않음
3. 2개의 알림이 있다고 표시되지만 SW에는 등록 안 됨

---

## 2. 근본 원인 분석

### 최초 발견된 문제: Race Condition

**위치**: `src/lib/stores/notifications.svelte.ts` (수정됨)

**원인**:
```typescript
// 기존 코드 (문제)
notificationStore.init() {
    // ...
    setTimeout(() => {
        registerRemindersToServiceWorker();  // 2초 후 실행
    }, 2000);
}
```

`memosStore.init()`가 비동기이고 2초 이상 걸릴 수 있어서, 메모가 로드되기 전에 빈 배열이 SW에 전송되었음.

**수정 내용** (커밋 `f4b9094`):
- `notificationStore.init()`에서 2초 타임아웃 제거
- `+layout.svelte`에서 `await memosStore.init()` 완료 후 명시적 호출

```typescript
// 수정된 코드
await memosStore.init();
// ...
notificationStore.registerRemindersToServiceWorker();  // 메모 로드 완료 후
```

---

### 미해결 문제: 여전히 등록 실패

수정 후에도 로그에서 다음이 확인됨:
- "📤 Registering 2 reminders to SW" → 2개의 알림이 있음
- "Failed to register reminders to SW {}" → 그러나 등록 실패

**가능한 원인**:

| # | 가설 | 검증 방법 |
|---|------|----------|
| 1 | `postMessage()`가 성공했지만 SW에서 처리 실패 | SW 로그 확인 |
| 2 | SW가 아직 활성화되지 않음 (`registration.active` 문제) | SW state 로깅 |
| 3 | 여러 곳에서 `registerRemindersToServiceWorker()` 중복 호출 | 호출 스택 추적 |
| 4 | `memosStore.memos`가 반응형 상태라 타이밍 이슈 | getter 호출 시점 확인 |
| 5 | catch 블록 진입하지만 에러 객체가 비정상 | 에러 상세 로깅 |

---

## 3. 코드 흐름 분석

### 현재 초기화 순서

```
+layout.svelte onMount()
    ↓
themeStore.init()
settingsStore.init()
notificationStore.init()  ← SW 메시지 리스너만 등록
    ↓
await authStore.initialize()
    ↓
await memosStore.init()   ← 메모 로드 (캐시 → 서버)
    ↓
filterStore.init()
foldersStore.init()
    ↓
notificationStore.registerRemindersToServiceWorker()  ← 여기서 SW 등록
    ↓
initFCM()
```

### memosStore.init() 내부 동작

```typescript
async function init() {
    // 1. 캐시에서 먼저 로드 (즉시)
    const cached = loadCacheFromStorage();
    if (cached.length > 0) {
        memos = cached;
        loading = false;  // UI 표시
    }

    // 2. 서버에서 동기화 (await)
    await fetchFromSupabase();

    // 3. 완료
    initialized = true;
}
```

**잠재적 문제**:
- `await memosStore.init()` 완료 시점에 `memos`는 채워져 있어야 함
- 하지만 `memos`가 반응형 상태(`$state`)라서 getter 호출 타이밍에 따라 다를 수 있음

---

## 4. 디버깅을 위해 추가한 로그

### 커밋 `5ba476e`

**+layout.svelte**:
```typescript
console.log('[Layout] memosStore.init() completed');
console.log('[Layout] memos count:', memosStore.memos.length);
console.log('[Layout] memos with reminders:', memosStore.memos.filter(m => m.reminder?.enabled).length);
console.log('[Layout] Calling registerRemindersToServiceWorker...');
```

**notifications.svelte.ts**:
```typescript
log.info('🔄 registerRemindersToServiceWorker() called');
log.info(`📊 memosStore.memos.length = ${memosStore.memos.length}`);
log.info(`📊 memosStore.initialized = ${memosStore.initialized}`);
log.info(`📊 memosStore.loading = ${memosStore.loading}`);
log.info('⏳ Waiting for SW ready...');
log.info(`✅ SW ready, state: ${registration.active?.state}`);
log.info(`📤 Registering ${activeReminders.length} reminders to SW`);
log.info(`📋 First reminder: ${activeReminders[0].title} at ${activeReminders[0].time}`);
log.info('✅ postMessage sent to SW');

// 에러 시
log.error(`Failed to register reminders to SW: ${errorMsg}`);
log.error(`Stack: ${errorStack}`);
```

---

## 5. 다음 단계 (TODO)

### 즉시 확인 필요
1. **디버그 로그 결과 확인** - 사용자가 새로고침 후 로그 공유
2. 다음 값들 확인:
   - `memosStore.memos.length` 값
   - `memosStore.initialized` 값
   - `SW ready, state` 값
   - 에러 메시지 상세 내용

### 로그 결과에 따른 조치

| 로그 결과 | 조치 |
|----------|------|
| `memos.length = 0` | `memosStore`의 반응형 상태 문제 → 콜백 패턴 적용 |
| `initialized = false` | `init()` 완료 전에 호출됨 → Promise 반환 확인 |
| `SW state = undefined` | SW 활성화 대기 필요 → `navigator.serviceWorker.ready` 재검토 |
| 정상인데 실패 | `postMessage` 후 SW 내부 문제 → SW 로그 확인 |

### 예상 수정 방안

**방안 1**: 이벤트 기반 등록
```typescript
// memosStore에서 로드 완료 이벤트 발행
memosStore.onMemosLoaded(() => {
    notificationStore.registerRemindersToServiceWorker();
});
```

**방안 2**: 재시도 메커니즘
```typescript
async function registerRemindersToServiceWorker(retries = 3) {
    if (memosStore.memos.length === 0 && retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return registerRemindersToServiceWorker(retries - 1);
    }
    // ... 등록 로직
}
```

**방안 3**: SW 상태 확인 강화
```typescript
const registration = await navigator.serviceWorker.ready;
if (registration.active?.state !== 'activated') {
    await new Promise(r => {
        registration.active?.addEventListener('statechange', () => {
            if (registration.active?.state === 'activated') r(undefined);
        });
    });
}
```

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/routes/+layout.svelte` | 앱 초기화, SW 등록 호출 |
| `src/lib/stores/notifications.svelte.ts` | 알림 스토어, SW 등록 함수 |
| `src/lib/stores/memos.svelte.ts` | 메모 스토어, 데이터 로딩 |
| `src/service-worker.ts` | SW, 알림 스케줄 관리 |

---

## 7. 요약

| 항목 | 상태 |
|------|------|
| Race condition 수정 | ✅ 완료 |
| 디버그 로깅 추가 | ✅ 완료 |
| 실제 원인 파악 | ⏳ 로그 결과 대기 |
| 최종 수정 | ❌ 미완료 |

**다음 액션**: 사용자가 디버그 로그 결과를 공유하면 정확한 원인 파악 후 수정 진행
