# 메모 알림 백그라운드 미작동 문제 분석 및 수정 계획서

## 문제 요약
- **증상**: 개발자모드의 60초 후 지연 알림은 백그라운드에서 잘 작동하지만, 동일 시간에 예약한 메모 알림은 표시되지 않음
- **영향**: PWA 웹앱에서 메모에 설정한 알림이 백그라운드 상태에서 동작하지 않음

---

## 문제 원인 분석

### 1. 개발자 모드 60초 알림이 작동하는 이유

**파일**: `src/service-worker.ts` (106-122줄)

```typescript
// 지연 알림 테스트 (백그라운드 테스트용)
if (event.data.type === 'DELAYED_NOTIFICATION') {
    const delay = event.data.delay || 5000;
    setTimeout(() => {
        sw.registration.showNotification(/* ... */);
    }, delay);
}
```

- **Service Worker**에서 `setTimeout`을 사용
- Service Worker는 브라우저와 별도의 스레드에서 실행
- 앱이 백그라운드로 가도 Service Worker는 계속 실행됨
- 따라서 지연 알림이 정상 작동

### 2. 메모 알림이 백그라운드에서 작동하지 않는 이유

**파일**: `src/lib/stores/notifications.svelte.ts` (97-107줄)

```typescript
function startBackgroundCheck() {
    if (checkInterval) return;

    // Check every minute
    checkInterval = setInterval(() => {
        checkAndTriggerReminders();
    }, 60000);

    // Initial check
    checkAndTriggerReminders();
}
```

**핵심 문제**:
1. 메모 알림 체크는 **메인 스레드(브라우저 탭)**에서 `setInterval`로 실행
2. 앱이 백그라운드로 가면 브라우저가 `setInterval`을 **일시 중지**함 (배터리/성능 최적화)
3. 따라서 예약된 메모 알림 시간이 되어도 `checkAndTriggerReminders()`가 호출되지 않음

### 3. FCM 서버 알림이 작동하지 않는 이유

**파일**: `src/lib/services/alarmSchedules.ts`

- `alarm_schedules` 테이블에 알림 스케줄을 **저장**만 함
- 실제로 서버에서 **FCM 푸시를 보내는 로직이 없음** (Edge Function 또는 Cron Job 필요)
- 현재는 클라이언트 측 알림에만 의존

---

## 아키텍처 비교

| 구분 | 개발자 모드 60초 알림 | 메모 예약 알림 |
|------|----------------------|---------------|
| **실행 환경** | Service Worker | 메인 스레드 |
| **타이머** | `setTimeout` (SW) | `setInterval` (Main) |
| **백그라운드** | ✅ 작동 | ❌ 중지됨 |
| **브라우저 탭** | 불필요 | 열려있어야 함 |

---

## 수정 내용 (이미 적용됨)

### 1. Service Worker에 메모 알림 스케줄 기능 추가

**파일**: `src/service-worker.ts`

```typescript
// 메모 알림 스케줄 저장소 (Service Worker 메모리)
interface ScheduledReminder {
    memoId: string;
    title: string;
    body: string;
    time: string; // HH:MM
    type: 'once' | 'repeat';
    days?: number[]; // 0-6 (일-토)
    date?: string; // YYYY-MM-DD
    // ...
}

let scheduledReminders: ScheduledReminder[] = [];

// 매분 체크
function checkScheduledReminders() { /* ... */ }

// 메시지 수신: REGISTER_MEMO_REMINDERS, UPDATE_MEMO_REMINDER, REMOVE_MEMO_REMINDER
```

### 2. Notification Store에 SW 연동 함수 추가

**파일**: `src/lib/stores/notifications.svelte.ts`

```typescript
// Service Worker에 알림 스케줄 등록
async function registerRemindersToServiceWorker() { /* ... */ }

// Service Worker에 단일 알림 업데이트
async function updateReminderInServiceWorker(memo: Memo) { /* ... */ }

// Service Worker에서 알림 제거
async function removeReminderFromServiceWorker(memoId: string) { /* ... */ }
```

### 3. Memo Store에서 알림 변경 시 SW 동기화

**파일**: `src/lib/stores/memos.svelte.ts`

- `add()`: 메모 생성 시 SW에 알림 등록
- `update()`: 메모 수정 시 SW에 알림 갱신
- `remove()`: 메모 삭제 시 SW에서 알림 제거

### 4. 디버그 로그 추가

모든 관련 파일에 `[NotificationStore]`, `[SW-MemoAlarm]` prefix로 상세 로그 추가

### 5. 개발자 모드에 SW 스케줄 상태 확인 UI 추가

**파일**: `src/routes/settings/+page.svelte`

- SW에 등록된 알림 목록 표시
- Interval 실행 상태 표시
- 수동으로 SW에 알림 스케줄 등록 버튼

---

## 확인 방법 (PWA 앱 내)

### 1. 개발자 모드 진입
1. 설정 페이지로 이동
2. 버전 번호를 10번 빠르게 탭

### 2. SW 스케줄 상태 확인
1. "SW 메모 알림 스케줄" 섹션 확인
2. 등록된 알림 수와 Interval 실행 상태 확인
3. "SW에 알림 스케줄 등록" 버튼 클릭

### 3. 콘솔 로그 확인 (브라우저 개발자 도구)
```
[NotificationStore] 🚀 Initializing notification store...
[NotificationStore] 📤 Registering X reminders to SW
[SW-MemoAlarm] 📝 REGISTER_MEMO_REMINDERS received
[SW-MemoAlarm] 🚀 Starting reminder check interval (60s)
[SW-MemoAlarm] 🕐 Checking reminders at HH:MM
```

### 4. 백그라운드 알림 테스트
1. 메모에 1분 후 알림 설정 (예: 현재 시간 + 1분)
2. "SW에 알림 스케줄 등록" 버튼 클릭
3. 앱을 백그라운드로 전환 (탭 최소화 또는 다른 앱으로 전환)
4. 1분 후 알림이 오면 성공!

---

## 남은 과제 (향후 개선)

### 1. 서버 측 FCM 푸시 구현 (권장)
- Supabase Edge Function 또는 외부 Cron 서비스 사용
- `alarm_schedules` 테이블을 주기적으로 체크
- 시간이 되면 해당 사용자의 FCM 토큰으로 푸시 발송

**장점**:
- 브라우저가 완전히 닫혀도 알림 가능
- 여러 기기 동기화
- 더 안정적인 알림 전달

### 2. Service Worker 지속성 개선
- 현재 SW의 `setInterval`도 장시간 후 중지될 수 있음
- Web Push API + 서버 푸시가 더 안정적

### 3. iOS/Safari 지원
- Safari의 Push API 지원 확인
- iOS PWA의 제한사항 검토

---

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/service-worker.ts` | 메모 알림 스케줄 저장/체크/발송 로직 추가 |
| `src/lib/stores/notifications.svelte.ts` | SW 연동 함수 및 디버그 로그 추가 |
| `src/lib/stores/memos.svelte.ts` | 메모 CRUD 시 SW 동기화 호출 추가 |
| `src/routes/settings/+page.svelte` | SW 스케줄 상태 확인 UI 추가 |

---

## 결론

**근본 원인**: 메모 알림이 메인 스레드의 `setInterval`에 의존하여 백그라운드에서 멈춤

**적용된 해결책**: Service Worker에 알림 스케줄을 등록하고 SW에서 매분 체크하도록 변경

**향후 권장**: 서버 측 FCM 푸시 구현으로 더 안정적인 알림 시스템 구축
