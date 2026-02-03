# 알림 병합 기능 계획서

## 개요
같은 계정에서 같은 시간에 발생하는 알림들을 병합하여 하나의 알림으로 표시하는 기능

## 현재 문제점
- 같은 시간에 여러 메모의 알림이 설정되어 있으면 각각 별도의 알림이 발생
- 사용자가 여러 개의 알림을 개별적으로 처리해야 함
- 알림 피로도 증가

## 목표
- 같은 시간대의 알림을 그룹화하여 단일 알림으로 표시
- 알림 클릭 시 해당 메모들을 볼 수 있는 페이지로 이동
- 개별 메모로의 빠른 접근 지원

## 일반적인 알림 병합 패턴

### 1. 그룹 알림 (Notification Grouping)
```javascript
// Android/iOS 네이티브 패턴
notification.setGroup("memo-alerts-09:00");
notification.setGroupSummary(true);
// "3개의 메모 알림이 있습니다"
```

### 2. 스태킹 알림 (Stacking)
- 같은 tag를 사용하여 기존 알림을 대체
- 예: `tag: "memo-reminder-09:00"` → 같은 시간 알림은 하나로 합쳐짐

### 3. 배치 알림 (Batch Notification)
```javascript
// 같은 시간의 알림을 모아서 하나로 표시
showNotification("3개의 메모 알림", {
  body: "• 회의 준비\n• 보고서 작성\n• 점심 약속",
  tag: "batch-09:00"
});
```

## 구현 계획

### Phase 1: Service Worker 수정
**파일**: `src/service-worker.ts`

```typescript
function checkScheduledReminders() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.getDay();
  const todayDate = now.toISOString().split('T')[0];
  const notifyKey = `${todayDate}-${currentTime}`;

  // 같은 시간의 알림들을 그룹화
  const remindersToNotify: ScheduledReminder[] = [];

  scheduledReminders.forEach((reminder) => {
    if (reminder.time !== currentTime) return;
    if (reminder.lastNotified === notifyKey) return;

    if (reminder.type === 'once') {
      if (reminder.date !== todayDate) return;
    } else {
      if (!reminder.days?.includes(today)) return;
    }

    remindersToNotify.push(reminder);
    reminder.lastNotified = notifyKey;

    if (reminder.type === 'once') {
      scheduledReminders = scheduledReminders.filter(r => r.memoId !== reminder.memoId);
    }
  });

  // 병합된 알림 표시
  if (remindersToNotify.length === 0) return;

  if (remindersToNotify.length === 1) {
    // 단일 알림
    showSingleNotification(remindersToNotify[0]);
  } else {
    // 병합 알림
    showMergedNotification(remindersToNotify, currentTime);
  }
}

function showSingleNotification(reminder: ScheduledReminder) {
  sw.registration.showNotification(reminder.title, {
    body: reminder.body || '알림이 도착했습니다',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: `memo-${reminder.memoId}`,
    data: {
      memoId: reminder.memoId,
      url: reminder.url || '/',
      type: 'single'
    },
    vibrate: [200, 100, 200],
    requireInteraction: true
  });
}

function showMergedNotification(reminders: ScheduledReminder[], time: string) {
  const titles = reminders.map(r => `• ${r.title}`).join('\n');
  const memoIds = reminders.map(r => r.memoId);

  sw.registration.showNotification(`${reminders.length}개의 메모 알림`, {
    body: titles,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: `memo-batch-${time}`,
    data: {
      memoIds,
      url: `/notifications?time=${time}`,
      type: 'merged'
    },
    vibrate: [200, 100, 200],
    requireInteraction: true
  });
}
```

### Phase 2: 알림 클릭 핸들러 수정
```typescript
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  if (data?.type === 'merged') {
    // 병합 알림: 알림 목록 페이지로 이동
    url = data.url || '/';
  } else {
    // 단일 알림: 해당 메모로 이동
    url = data?.url || '/';
  }

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(sw.location.origin) && 'focus' in client) {
          (client as WindowClient).focus();
          (client as WindowClient).navigate(url);
          return;
        }
      }
      return sw.clients.openWindow(url);
    })
  );
});
```

### Phase 3: 알림 목록 페이지 (선택사항)
병합 알림 클릭 시 이동할 페이지 구현

**파일**: `src/routes/notifications/+page.svelte`

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/service-worker.ts` | 알림 그룹화 및 병합 로직 추가 |
| `src/routes/notifications/+page.svelte` | 알림 목록 페이지 (선택) |

## 예상 작업량
- Service Worker 수정: 2시간
- 테스트: 1시간
- (선택) 알림 목록 페이지: 2시간

## 테스트 시나리오
1. 같은 시간에 1개 알림 → 단일 알림 표시
2. 같은 시간에 2개 이상 알림 → 병합 알림 표시
3. 병합 알림 클릭 → 알림 목록 또는 홈으로 이동
4. 단일 알림 클릭 → 해당 메모로 이동
