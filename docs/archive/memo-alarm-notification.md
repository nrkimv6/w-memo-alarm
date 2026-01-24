# memo-alarm 알림 시스템 구현 계획

*상태: ✅ 완료 (2026-01-08)*

## 현황

gifticon-manager 대비 memo-alarm에 누락된 기능:

| 항목 | gifticon-manager | memo-alarm |
|------|------------------|------------|
| 서비스 워커 push 핸들러 | O | ✅ O |
| Supabase Edge Function | O (send-push) | ✅ O (Cloudflare API) |
| pg_cron 서버 스케줄러 | O | ✅ O (외부 cron 호출) |
| 앱 시작 시 알림 초기화 | O | ✅ O |
| 네이티브 로컬 알림 | O (@capacitor/local-notifications) | ✅ O |

## 구현 항목

### 1. 앱 시작 시 알림 초기화 (즉시)

**파일**: `src/routes/+layout.svelte`

```svelte
import { notificationStore } from '$lib/stores/notifications.svelte';

onMount(() => {
  themeStore.init();
  settingsStore.init();
  notificationStore.init();  // 추가
});
```

### 2. 서비스 워커 push 핸들러

**파일**: `src/service-worker.ts`

```typescript
sw.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: '메모 알람',
    body: '알림이 있습니다'
  };

  event.waitUntil(
    sw.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.png',
      tag: data.tag || 'memo-reminder',
      data: { url: data.url || '/' },
      requireInteraction: true
    })
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    sw.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      return sw.clients.openWindow(url);
    })
  );
});
```

### 3. Web Push 구독 유틸리티

**파일**: `src/lib/utils/push.ts`

- VAPID 키 설정
- 푸시 구독/해제 함수
- 구독 정보 서버 저장

### 4. Supabase Edge Function

**파일**: `supabase/functions/send-push/index.ts`

- pg_cron에서 매분 호출
- 사용자별 타임존 확인
- 알림 시간 매칭 시 Web Push 전송

### 5. 네이티브 로컬 알림 (Android)

**패키지**: `@capacitor/local-notifications`

- 알림 채널 생성
- 스케줄 기반 알림 예약
- 알림 클릭 핸들러

## 우선순위

1. ~~**P0**: 앱 시작 시 `notificationStore.init()` 호출~~ - ✅ 구현됨 (2026-01-08 확인)
2. ~~**P1**: 서비스 워커 push 핸들러 + Web Push 구독~~ - ✅ 구현됨 (2026-01-08 확인)
   - `src/service-worker.ts`: push, notificationclick 핸들러
   - `src/lib/utils/push.ts`: subscribeToPush, unsubscribeFromPush
   - `src/routes/api/sync/+server.ts`: subscribe_push, update_push_settings 액션
3. ~~**P2**: Cloudflare Cron Trigger + Web Push 발송~~ - ✅ 구현됨 (2026-01-08)
   - `data/migrations/002_push_subscriptions.sql`: push_subscriptions 테이블
   - `src/lib/server/web-push.ts`: Web Push 발송 유틸리티 (VAPID JWT, 암호화)
   - `src/routes/api/cron/send-push/+server.ts`: Cron API 엔드포인트
   - 설정 필요: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
4. ~~**P3**: 네이티브 로컬 알림 (Capacitor)~~ - ✅ 구현됨
   - `src/lib/utils/capacitor.ts`: @capacitor/local-notifications

## 참고

- gifticon-manager 서비스 워커: `D:\work\project\tools\gifticon-manager\src\service-worker.ts`
- gifticon-manager Edge Function: `D:\work\project\tools\gifticon-manager\supabase\functions\send-push\index.ts`
