# memo-alarm 백그라운드 알림 아키텍처

> FCM (Firebase Cloud Messaging) + Supabase 기반 통합 알림 시스템

## 개요

memo-alarm은 line-minder와 동일한 FCM 기반 백그라운드 알림 시스템을 공유합니다.
Supabase Edge Function이 매분 실행되어 예약된 알림을 FCM으로 발송합니다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    memo-alarm 웹앱                           │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ 로그인 시        │    │ 메모 저장 시                     │ │
│  │ registerFCMToken│    │ createMemoAlarm / updateMemoAlarm│ │
│  └────────┬────────┘    └──────────────┬──────────────────┘ │
└───────────┼─────────────────────────────┼───────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────────────────────────────────────────────┐
│                      Supabase (공유 DB)                        │
│  ┌─────────────────────┐    ┌───────────────────────────────┐ │
│  │ user_devices        │    │ alarm_schedules               │ │
│  │ - user_id           │    │ - user_id                     │ │
│  │ - app_name          │    │ - app_name = 'memo-alarm'     │ │
│  │ - fcm_token         │    │ - alarm_time (HH:MM:SS)       │ │
│  │ - platform = 'web'  │    │ - notification_title/body     │ │
│  │ - is_active         │    │ - days_of_week / target_date  │ │
│  └─────────────────────┘    │ - metadata (memo_id 등)       │ │
│                             └───────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    pg_cron (매분 실행)                        │
│  SELECT cron.schedule('send-notifications-every-minute',    │
│    '* * * * *', ...);                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           Supabase Edge Function: send-notifications         │
│           (line-minder/supabase/functions/ 에 위치)          │
│                                                              │
│  1. alarm_schedules에서 현재 시간 일치하는 알림 조회          │
│     - alarm_time = 현재시각 (HH:MM:00)                       │
│     - days_of_week에 오늘 요일 포함 OR target_date = 오늘    │
│     - is_enabled = true                                      │
│                                                              │
│  2. user_devices에서 해당 사용자의 활성 FCM 토큰 조회         │
│                                                              │
│  3. FCM API v1로 푸시 발송                                   │
│     - Google OAuth2 Access Token (Service Account JWT)       │
│     - https://fcm.googleapis.com/v1/projects/.../messages    │
│                                                              │
│  4. notification_logs에 발송 결과 기록                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   FCM (Firebase Cloud Messaging)             │
│                                                              │
│  message: {                                                  │
│    token: "사용자 FCM 토큰",                                  │
│    notification: { title, body },                            │
│    data: { app_name, memo_id, ... }                         │
│  }                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 브라우저 Service Worker                       │
│                 (firebase-messaging-sw.js)                   │
│                                                              │
│  - 백그라운드: SW가 푸시 수신 → 시스템 알림 표시              │
│  - 포그라운드: onMessage 리스너 → Notification API           │
└─────────────────────────────────────────────────────────────┘
```

## 주요 파일

### 클라이언트 (memo-alarm)

| 파일 | 역할 |
|------|------|
| `src/lib/fcm.ts` | FCM 토큰 발급/등록, 포그라운드 메시지 리스너 |
| `src/lib/services/alarmSchedules.ts` | alarm_schedules CRUD (메모 알림 등록/수정/삭제) |
| `src/routes/+layout.svelte` | 로그인 시 FCM 초기화 |
| `static/firebase-messaging-sw.js` | 백그라운드 푸시 수신 |

### 서버 (line-minder - 공유)

| 파일 | 역할 |
|------|------|
| `supabase/functions/send-notifications/index.ts` | Edge Function (FCM 발송) |
| `docs/DEPLOY_EDGE_FUNCTION.md` | 배포 가이드 |

## 데이터베이스 테이블

### user_devices
```sql
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  app_name TEXT NOT NULL,        -- 'memo-alarm', 'line-minder'
  platform TEXT NOT NULL,        -- 'web', 'android', 'ios'
  fcm_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, app_name, fcm_token)
);
```

### alarm_schedules
```sql
CREATE TABLE alarm_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  app_name TEXT NOT NULL,        -- 'memo-alarm'
  alarm_type TEXT NOT NULL,      -- 'memo_reminder'
  alarm_time TIME NOT NULL,      -- 'HH:MM:SS'
  timezone TEXT DEFAULT 'Asia/Seoul',
  is_enabled BOOLEAN DEFAULT true,
  notification_title TEXT NOT NULL,
  notification_body TEXT,
  days_of_week INTEGER[],        -- [0,1,2,3,4,5,6] (일~토), NULL=매일
  target_date DATE,              -- 일회성 알림용
  metadata JSONB,                -- { memo_id, auto_open, ... }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### notification_logs
```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  app_name TEXT,
  schedule_id UUID,
  fcm_token TEXT,
  notification_title TEXT,
  notification_body TEXT,
  status TEXT,                   -- 'success', 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
```

## 환경 변수

### memo-alarm (.env)
```env
# Firebase (line-minder 프로젝트 공유)
PUBLIC_FIREBASE_API_KEY=AIzaSy...
PUBLIC_FIREBASE_AUTH_DOMAIN=lineminder-23489.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=lineminder-23489
PUBLIC_FIREBASE_STORAGE_BUCKET=lineminder-23489.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
PUBLIC_FIREBASE_APP_ID=...
PUBLIC_FIREBASE_VAPID_KEY=BKymGT9F9SZy4jVJXpqgxqhv6iS_p4sHBHJtuNH4CiAXuhLtxpJ2Zv5A7yE4cRYWRiy14Yf5kdLyPrlqQWVXBaw

# Supabase
PUBLIC_SUPABASE_URL=https://qxiuqztinabmdhclxsuz.supabase.co
PUBLIC_SUPABASE_ANON_KEY=...
```

### Supabase Edge Function Secrets
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_PROJECT_ID=lineminder-23489
```

## pg_cron 설정

Supabase SQL Editor에서 실행:

```sql
-- 크론 작업 등록
SELECT cron.schedule(
  'send-notifications-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qxiuqztinabmdhclxsuz.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 확인 방법

### pg_cron 상태 확인
```sql
SELECT * FROM cron.job WHERE jobname = 'send-notifications-every-minute';
```

### 최근 발송 로그 확인
```sql
SELECT * FROM notification_logs
WHERE app_name = 'memo-alarm'
ORDER BY sent_at DESC
LIMIT 20;
```

### Edge Function 로그
```powershell
supabase functions logs send-notifications --project-ref qxiuqztinabmdhclxsuz --follow
```

## 참고

- Edge Function 배포: `line-minder/docs/DEPLOY_EDGE_FUNCTION.md`
- FCM 설정: `line-minder/docs/FCM_SETUP.md`
