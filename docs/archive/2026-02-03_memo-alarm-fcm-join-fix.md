# memo-alarm FCM 알림 수정사항

> 작성일: 2026-02-03
> 완료일: 2026-02-03
> 상태: 완료

## 배경

FCM 서버 푸시 알림이 작동하지 않는 문제 해결 과정에서 발견된 이슈들을 수정함.

## 수정 완료 사항

### 1. Edge Function 수정 (send-notifications)

**파일**: `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`

#### 1.1 djwt v3 CryptoKey 변환 추가
- djwt v3에서 PEM 문자열 대신 CryptoKey 객체 필요
- `pemToCryptoKey()` 함수 추가하여 PEM → CryptoKey 변환

#### 1.2 AlarmSchedule 인터페이스 timezone 필드 추가
- `timezone` 필드 누락으로 KST 시간이 UTC로 처리되던 문제 수정

#### 1.3 NotRegistered 토큰 자동 비활성화
- FCM에서 NotRegistered 에러 반환 시 해당 토큰을 `is_active = false`로 업데이트
- 만료된 토큰으로 인한 불필요한 알림 시도 방지

### 2. memo-alarm 앱 수정

**파일**: `memo-alarm/src/lib/fcm.ts`

#### 2.1 비활성화된 토큰 확인 함수 추가
```typescript
export async function hasDeactivatedToken(userId: string): Promise<boolean>
```
- 서버에서 비활성화된 토큰이 있는지 확인
- `is_active = false`인 토큰 존재 여부 반환

#### 2.2 토큰 재설정 함수 추가
```typescript
export async function resetFCMToken(userId: string): Promise<FCMToken | null>
```
- 비활성화된 토큰 삭제 후 새 토큰 등록
- 사용자가 "알림 재설정" 선택 시 호출

**파일**: `memo-alarm/src/routes/+layout.svelte`

#### 2.3 알림 재설정 Alert UI 추가
- `showNotificationResetAlert` 상태 변수 추가
- `initFCM()` 함수에서 비활성화된 토큰 확인 로직 추가
- 재설정 Alert 다이얼로그 UI 구현
  - "재설정" 버튼: `handleResetNotification()` 호출
  - "나중에" 버튼: Alert 닫기

### 3. Edge Function FCM 메시지 구조 수정 (undefined 버그 수정)

**파일**: `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`

#### 3.1 모바일 "undefined" 알림 버그 수정

**현상**:
- 모바일에서 알림 수신 시 제목이 "undefined"로 표시됨
- 서비스 워커에 fallback 로직이 있음에도 불구하고 발생

**원인**:
- FCM 메시지의 `android.notification`에 `title`과 `body`가 누락됨
- Android 네이티브에서는 `android.notification` 설정을 우선 사용
- 해당 필드에 title/body가 없어서 "undefined" 표시

**수정 내용**:
```typescript
// 수정 전
android: {
  priority: "high",
  notification: {
    sound: "default",
    channel_id: `${schedule.app_name}-notifications`,
  },
},

// 수정 후
android: {
  priority: "high",
  notification: {
    title: schedule.notification_title,
    body: schedule.notification_body,
    sound: "default",
    channel_id: `${schedule.app_name}-notifications`,
  },
},
```

## 배포 필요 사항

- [ ] Edge Function 재배포: `supabase functions deploy send-notifications`

## 테스트 체크리스트

- [x] Edge Function 배포 확인
- [x] FCM 알림 발송 성공 (notification_logs 확인)
- [?] 비활성화된 토큰 Alert 동작 확인
- [x] 토큰 재설정 후 알림 정상 수신 확인
- [] 모바일 undefined 버그 수정 및 테스트

## 관련 문서

- [background-notification-system.md](../guide/background-notification-system.md) - FCM 트러블슈팅 가이드 추가됨
