# memo-alarm FCM 백그라운드 알림 통합

> 작성일: 2026-01-19
> 대상 프로젝트: memo-alarm
> 상태: 완료

---

## 개요

memo-alarm은 현재 Web Notification API 기반 로컬 알림을 사용합니다. 브라우저가 열려있을 때만 동작하는 한계가 있어, 서버 기반 FCM 백그라운드 알림으로 전환합니다.

**현재 상태:**
- ✅ Supabase 연동 완료 (Auth, 메모/폴더 CRUD)
- ✅ Web Notification API 기반 로컬 알림 (브라우저 열려있을 때만)
- ❌ 백그라운드 알림 미지원 (브라우저 꺼지면 알림 안 옴)

**목표:**
- FCM 기반 서버 백그라운드 알림 구현
- 기존 `alarm_schedules` 테이블 재사용 (`app_name='memo-alarm'`)
- line-minder의 `send-notifications` Edge Function 공유

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | Firebase 웹 앱 설정 | 기존 line-minder 프로젝트에 추가 설정 | 낮음 |
| P0 | FCM 클라이언트 코드 | `src/lib/fcm.ts`, Service Worker | 낮음 |
| P0 | 토큰 등록 | 앱 시작 시 `user_devices` 테이블에 저장 | 낮음 |
| P1 | 알림 스케줄 저장 | 메모 저장 시 `alarm_schedules` 테이블에 등록 | 중간 |
| P1 | 알림 스케줄 동기화 | 메모 수정/삭제 시 알림 갱신 | 중간 |
| P2 | 기존 로컬 알림 제거 | `notifications.svelte.ts` 정리 | 낮음 |

---

## 기술적 고려사항

1. **반복 알림 vs 일회성 알림**
   - memo-alarm: 주로 반복 알림 (매일/특정 요일)
   - `alarm_schedules.days_of_week` 컬럼 사용
   - 일회성 알림: `target_date` 사용

2. **기존 인프라 재사용**
   - Supabase 테이블: `user_devices`, `alarm_schedules`, `notification_logs`
   - Edge Function: `send-notifications` (이미 `app_name` 필터링 지원)
   - pg_cron: 1분마다 자동 실행 (모든 앱 공통)

3. **Firebase 프로젝트 공유**
   - line-minder와 동일한 Firebase 프로젝트 사용
   - 웹 앱 설정 추가 (domains에 `memo.woory.day` 추가)

---

## 구현 순서

1. [x] P0: Firebase Console에서 `memo.woory.day` 도메인 추가 - 공통 .env 사용
2. [x] P0: `src/lib/fcm.ts` 작성 ✅ (2026-01-19)
3. [x] P0: `static/firebase-messaging-sw.js` 작성 ✅ (2026-01-19)
4. [x] P0: `.env`에 Firebase 환경변수 추가 - 공통 .env에 이미 있음
5. [x] P0: `+layout.svelte`에서 FCM 토큰 등록 ✅ (2026-01-19)
6. [x] P1: 메모 저장 시 알림 스케줄 생성 ✅ (2026-01-19)
7. [x] P1: 메모 수정 시 알림 스케줄 갱신 ✅ (2026-01-19)
8. [x] P1: 메모 삭제 시 알림 스케줄 삭제 ✅ (2026-01-19)
9. [ ] P2: 기존 로컬 알림 코드 정리 - 선택적 (로컬+FCM 병행 가능)
10. [x] 빌드 테스트 및 배포 ✅ (2026-01-19)

---

## 파일 수정 상세

### 1. Firebase 환경변수 (`.env`)

```env
# Firebase (line-minder와 동일한 프로젝트)
PUBLIC_FIREBASE_API_KEY=AIzaSyA7D62gSqecQ-gUMUJ8C-P-0Fs6CeybyK4
PUBLIC_FIREBASE_AUTH_DOMAIN=lineminder-23489.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=lineminder-23489
PUBLIC_FIREBASE_STORAGE_BUCKET=lineminder-23489.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=426056584594
PUBLIC_FIREBASE_APP_ID=1:426056584594:web:XXXXXX  # 새 웹 앱 ID 필요
PUBLIC_FIREBASE_VAPID_KEY=XXXXX  # 새 VAPID 키 또는 기존 공유
```

### 2. `src/lib/services/alarmSchedules.ts` 생성

line-minder의 `alarmSchedules.ts`를 복사하고 수정:
- `app_name`: `'memo-alarm'`
- `createMemoAlarm()`: 메모의 리마인더를 알림 스케줄로 변환
- `deleteMemoAlarms()`: 메모 삭제 시 알림 삭제

### 3. `src/lib/stores/memos.svelte.ts` 수정

```typescript
// 상단에 import 추가
import { createMemoAlarm, deleteMemoAlarms } from '$lib/services/alarmSchedules';

// add() 함수 수정 - 리마인더가 있으면 알림 스케줄 생성
if (memo.reminder?.enabled && authStore.user?.id) {
  await createMemoAlarm(authStore.user.id, newMemo.id, newMemo.title, memo.reminder);
}

// remove() 함수 수정 - 알림 스케줄 삭제
await deleteMemoAlarms(memoId);
```

---

*상태: 검토 대기*
