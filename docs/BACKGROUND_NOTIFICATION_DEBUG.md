# 백그라운드 알림 디버깅 가이드

## 개요

이 문서는 메모 알람 앱의 백그라운드 알림 시스템을 설명하고, 알림이 작동하지 않을 때 디버깅하는 방법을 안내합니다.

---

## 알림 시스템 구조

```
알림 시스템
├── 네이티브 경로 (Android/iOS)
│   └── Capacitor LocalNotifications (진정한 백그라운드 알림)
│
├── 웹 경로 (브라우저)
│   ├── Service Worker 알림 (탭이 열려있을 때)
│   ├── FCM 서버 푸시 (서버 필요)
│   └── 브라우저 Notification API (포그라운드)
│
└── 공통 저장소
    └── Supabase alarm_schedules 테이블
```

---

## 플랫폼별 알림 동작

| 항목 | 네이티브 앱 (Android) | 웹 브라우저 |
|------|----------------------|------------|
| **백그라운드 알림** | 완벽 지원 | 제한적 (탭 열려있어야 함) |
| **앱 완전 종료 시** | 알림 가능 | 알림 불가 |
| **기술** | Capacitor LocalNotifications | Service Worker + Notification API |
| **저장소** | OS 로컬 스케줄러 | Supabase alarm_schedules |
| **반복 알림** | 주간 반복 지원 | 주간/1회성 지원 |

---

## 핵심 파일 구조

```
src/
├── lib/
│   ├── utils/
│   │   └── capacitor.ts        # Capacitor 네이티브 알림
│   ├── services/
│   │   └── alarmSchedules.ts   # Supabase 알람 스케줄 관리
│   ├── stores/
│   │   └── notifications.svelte.ts  # 웹 알림 스토어 (1분 간격 체크)
│   └── fcm.ts                  # Firebase Cloud Messaging
├── service-worker.ts           # Service Worker (푸시 수신)
└── routes/settings/+page.svelte # 개발자 모드 테스트 UI
```

---

## 웹에서 "진짜" 백그라운드 알림이 안 되는 이유

### 기술적 한계

1. **브라우저/탭을 완전히 닫으면** Service Worker가 실행되지 않음
2. **서버에서 FCM push를 보내야** 하지만 현재 서버 크론/스케줄러가 없음
3. 클라이언트 JavaScript만으로는 브라우저가 닫힌 상태에서 알림 불가능

### 현재 웹 알림 동작 방식

```
1분 간격 폴링 (notifications.svelte.ts)
  ↓
현재 시간과 메모의 알림 시간 비교
  ↓
일치하면 Notification API로 알림 표시
  ↓
※ 탭이 열려있을 때만 동작!
```

---

## 개발자 모드 진입 방법

1. 설정 페이지로 이동
2. "버전" 숫자(1.0.0)를 **10번 연속 탭**
3. 개발자 모드 섹션이 나타남

---

## 테스트 기능

### 1. 웹 Service Worker 알림 테스트

개발자 모드 → "웹 Service Worker 알림" 섹션

| 버튼 | 설명 |
|------|------|
| **즉시 알림 테스트** | Service Worker에서 직접 알림 발송 |
| **5초 후 백그라운드 알림 테스트** | 5초 지연 후 알림 (백그라운드 테스트용) |

#### 백그라운드 테스트 방법:
```
1. "5초 후 백그라운드 알림 테스트" 클릭
2. 즉시 탭을 최소화하거나 다른 앱으로 전환
3. 5초 후 알림이 오면 → Service Worker 정상 동작!
```

> **주의**: 브라우저를 완전히 닫으면 안 됩니다. 탭이 열려있어야 합니다.

### 2. Capacitor 백그라운드 알림 테스트 (네이티브 앱)

개발자 모드 → "Capacitor 백그라운드 알림" 섹션

| 버튼 | 설명 |
|------|------|
| **네이티브 알림 권한 요청** | Android/iOS 알림 권한 요청 |
| **5초 후 백그라운드 알림 테스트** | Capacitor LocalNotifications로 알림 예약 |
| **예약된 알림 목록** | 현재 스케줄된 알림 확인 |
| **모든 예약 알림 취소** | 모든 스케줄된 알림 삭제 |

### 3. FCM 웹 푸시 상태 확인

개발자 모드 → "FCM 웹 푸시 상태" 섹션

확인 가능한 항목:
- Firebase API Key 설정 여부
- VAPID Key 설정 여부
- Project ID
- 등록된 FCM 토큰 (user_devices)
- 등록된 알림 스케줄 (alarm_schedules)

---

## 알림이 안 올 때 체크리스트

### 공통

| 체크 항목 | 확인 방법 |
|----------|----------|
| 알림 권한 | 개발자 모드에서 "Notification 권한" 확인 |
| 시스템 DnD | 방해 금지 모드 OFF |
| OS 알림 설정 | 시스템 설정에서 앱/브라우저 알림 허용 |

### 웹 브라우저

| 체크 항목 | 확인 방법 |
|----------|----------|
| Service Worker | 개발자 모드에서 "SW 활성" 표시 확인 |
| 탭 상태 | 탭이 열려있는지 (완전히 닫으면 안됨) |
| 브라우저 설정 | 사이트별 알림 허용 확인 |

### 네이티브 앱

| 체크 항목 | 확인 방법 |
|----------|----------|
| 네이티브 권한 | 개발자 모드에서 "네이티브 알림 권한" 확인 |
| 배터리 최적화 | Android: 배터리 최적화에서 앱 제외 |
| 백그라운드 실행 | Android: 백그라운드 실행 제한 해제 |

---

## 코드 흐름

### 메모 저장 시 알림 등록

```typescript
// src/lib/stores/memos.svelte.ts

if (result.reminder?.enabled) {
  if (await isNative()) {
    // 네이티브: Capacitor LocalNotifications
    scheduleNotification(result);
  } else {
    // 웹: Supabase alarm_schedules에 저장
    await createMemoAlarm(userId, memoId, title, reminder);
  }
}
```

### 웹 알림 체크 (1분 간격)

```typescript
// src/lib/stores/notifications.svelte.ts

checkInterval = setInterval(() => {
  checkAndTriggerReminders();
}, 60000);  // 1분마다

function checkAndTriggerReminders() {
  // 현재 시간과 메모의 알림 시간 비교
  // 일치하면 showNotification() 호출
}
```

### Service Worker Push 수신

```typescript
// src/service-worker.ts

sw.addEventListener('push', (event) => {
  const data = event.data?.json();
  sw.registration.showNotification(data.title, {
    body: data.body,
    // ...
  });
});
```

---

## 추가 개발 필요 사항

웹에서 진정한 백그라운드 알림 (브라우저 닫혀도 작동)을 구현하려면:

1. **서버 사이드 스케줄러 필요**
   - Supabase Edge Functions + pg_cron
   - 또는 별도 백엔드 서버

2. **FCM 서버 키로 푸시 발송**
   - 서버에서 정해진 시간에 FCM API 호출
   - 클라이언트의 FCM 토큰으로 푸시 전송

3. **Service Worker가 푸시 수신**
   - 브라우저가 닫혀있어도 OS가 Service Worker 깨움
   - 알림 표시

---

## 관련 환경 변수

```env
# Firebase (FCM)
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_VAPID_KEY=
```

---

## 참고 자료

- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
