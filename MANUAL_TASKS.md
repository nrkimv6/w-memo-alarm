# memo-alarm - 수동 검증 작업

> CLI로 검증할 수 없는 항목들입니다. 브라우저/실기기에서 직접 확인이 필요합니다.

## 2026-02-11: 알림 시스템 네이티브 빌드 테스트

### Issue 1: Capacitor 네이티브 알림 클릭 동작
- [ ] iOS 네이티브 빌드에서 알림 클릭 동작 테스트
- [ ] Android 네이티브 빌드에서 알림 클릭 동작 테스트

### Issue 2: 포그라운드 알림 URL 중복 방지
- [ ] 포그라운드 상태에서 알림 발생 → 클릭 시 URL이 1번만 열리는지 테스트
- [ ] 백그라운드 상태에서 알림 클릭 시 URL 열기 정상 동작 테스트

## 2026-02-11: Android PWA 외부 URL 알림 테스트

### 수정 보고서 테스트 체크리스트 (from: plan/2026-02-04_fix-report-android-pwa-notification-click)
- [ ] Android PWA: 알림 탭 → 앱 열림 + 해당 메모 상세 모달 표시
- [ ] Android PWA: 앱이 이미 열린 상태에서 알림 탭 → 앱 포커스 + 메모 이동
- [ ] Android PWA: 외부 URL이 있는 메모 알림 탭 → 브라우저에서 외부 URL 열림
- [ ] Android PWA: 병합 알림(다건) 탭 → 홈 화면으로 이동
- [ ] Android PWA: FCM 푸시 알림 탭 → 앱 열림 + 해당 메모 표시
- [ ] 데스크톱 Chrome: 기존 알림 동작이 깨지지 않음
- [ ] iOS Safari PWA: 알림 동작 확인 (iOS 16.4+ 해당 시)

## 2026-03-30: 상하 스크롤 시 좌우 스와이프 오동작 방지

### 수동 테스트 (모바일 브라우저/에뮬레이터)
- [ ] 상하 스크롤 시 카드가 좌우로 밀리지 않는지 확인 — from: 2026-03-30_fix-swipe-scroll-conflict.md (2026-03-30)
- [ ] 의도적 좌우 스와이프(삭제/핀)가 정상 동작하는지 확인 — from: 2026-03-30_fix-swipe-scroll-conflict.md (2026-03-30)
- [ ] 대각선 터치 시 먼저 감지된 방향으로만 동작하는지 확인 — from: 2026-03-30_fix-swipe-scroll-conflict.md (2026-03-30)

## 2026-03-31: 북마크 전환 버그 수정 후 시나리오 검증

- [ ] 메모에 핀 추가 → 할일 전환 → TodoCard에 핀 배지 표시 — from: 2026-03-31_fix-bookmark-conversion-bug.md#9 (2026-03-31)
- [ ] 메모에 즐겨찾기 추가 → 할일 전환 → TodoCard에 별 아이콘 표시 — from: 2026-03-31_fix-bookmark-conversion-bug.md#9 (2026-03-31)
- [ ] 핀 추가된 할일 → 메모 전환 → MemoCard에 핀 유지 — from: 2026-03-31_fix-bookmark-conversion-bug.md#9 (2026-03-31)
- [ ] 북마크 필터에서 전환된 할일 표시 확인 — from: 2026-03-31_fix-bookmark-conversion-bug.md#9 (2026-03-31)

---

## 2026-04-23: Cloudflare 환경변수 업데이트 (wservice-cross-noti 전환)

> from: [`2026-04-22_realign-fcm-to-wservice-crossnoti`](docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti.md) 배포 단계

현재 Cloudflare 대시보드에는 구버전 `lineminder-23489` Firebase 값이 등록되어 있다.
로컬 `.env.local`은 이미 `wservice-cross-noti` 기준으로 업데이트됐으므로, **머지+배포 후 아래 값으로 Cloudflare 환경변수를 교체해야 한다.**

- [ ] Cloudflare Workers > `wservice-memo-alarm` > Settings > Environment Variables 에서 아래 변수 교체

| 변수 | 새 값 |
|------|-------|
| `PUBLIC_FIREBASE_API_KEY` | `AIzaSyAVh8Enn3VjbLo4JMBmvhK5zE2nZJvMzDA` |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | `wservice-cross-noti.firebaseapp.com` |
| `PUBLIC_FIREBASE_PROJECT_ID` | `wservice-cross-noti` |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | `wservice-cross-noti.firebasestorage.app` |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `570337797776` |
| `PUBLIC_FIREBASE_APP_ID` | `1:570337797776:web:dd0e36c66152ad18275a15` |
| `PUBLIC_FIREBASE_VAPID_KEY` | `BLHcqgg12jg0gWLQOuJjM_Kucv_WGCkaNq48BdAKHgZKn6rfsgrKD4RNnVnYeeSPzJhBnO6coebq8NEaTqzvdv0` |

> `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`는 변경 없음.

### Firebase Console 도메인 승인 (Cloudflare env 교체와 별개의 선행 수동 조치)

> 이 작업은 Cloudflare 환경변수 교체와 독립적으로 먼저 완료해야 FCM 토큰 등록 400 에러가 해소됩니다.

- [ ] Firebase Console > `wservice-cross-noti` 프로젝트 > Authentication > Authorized domains > `memo.woory.day` 추가

---

## 2026-04-23: FCM 알림 merge window 브라우저 검증

> from: [`2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md`](docs/plan/2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md)#10

- [ ] 동일 분에 예약된 메모 2건 이상 등록 후, 앱 백그라운드로 두고 FCM push 수신 → "N개의 메모 알림" 1건만 표시되는지 확인 — from: 2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md#10 (2026-04-23)
- [ ] 단일 FCM push 수신 → 개별 tag `memo-alarm-{schedule_id}`로 표시, 이전 알림과 교체되지 않는지 확인 — from: 2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md#10 (2026-04-23)
- [ ] 병합 알림 클릭 → `memoIds[0]` 메모 상세로 네비게이트 확인 — from: 2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md#10 (2026-04-23)
- [ ] 개별 알림 클릭 → 기존 `memoId` 경로 유지 확인 — from: 2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md#10 (2026-04-23)

---

## 2026-04-24: SW 동일 시간대 할일 알림 병합 검증

> from: [`2026-04-24_fix-todo-notification-merge-in-sw`](docs/archive/2026-04-24_fix-todo-notification-merge-in-sw.md)

- [ ] `src/lib/utils/todoNotifications.ts` 경로로 등록되는 상기(remind) todo 3개 이상을 같은 `time: HH:MM` 으로 만든다
- [ ] 해당 시각 도달 시 OS 알림이 1건만 뜨는지 확인한다
- [ ] 병합 제목이 `"N개의 할일 알림"` 형식인지 확인한다
- [ ] 병합 본문이 `buildMergedBody()` 규칙대로 상위 항목만 노출하는지 확인한다
- [ ] 병합 알림 클릭 시 앱이 `/todos` 로 이동하는지 확인한다
- [ ] 같은 조건에서 `TODO_NOTIFICATION_SENT` 메시지 또는 로그가 success path로 남는지 devtools/로그로 확인한다
- [ ] 동일 시각 대상이 1건만 남도록 조정한 뒤 기존 단일 알림이 `tag: notificationId` 로 발송되는지 확인한다
- [ ] 단일 todo 알림 클릭 시 기존 `/?memo={memoId}` 이동이 유지되는지 확인한다
- [ ] one-time alert 발송 후 해당 `notificationId` 가 `todoNotifications` 배열에서 제거되는지 확인한다

---

## 2026-04-24: todo 알림 click 라우팅 + SW 메시지 계약 검증

> from: [`2026-04-24_fix-todo-notification-click-and-sw-messages`](docs/archive/2026-04-24_fix-todo-notification-click-and-sw-messages.md)

- [ ] todo 상기(remind) 알림 1건 발송 → 클릭 시 `/todos` 리스트로 이동하는지 확인 — 단일 todo click → /todos
- [ ] todo 병합 알림(2건 이상, 동일 시각) → 클릭 시 `/todos`로 이동하는지 확인 — 병합 todo click → /todos
- [ ] devtools console에서 `TODO_NOTIFICATION_SENT` success payload(memoId, notificationId, notificationType, status, errorMessage, sentAt)가 SW에서 전달되는지 확인
- [ ] 알림 내역 페이지(`/notifications`)에서 todo 기록이 `channel=sw-todo`, `채널 라벨="Todo"`로 표시되는지 확인
- [ ] 알림 내역 카드의 클릭이 `sw-todo` 채널 기록은 `/todos`, 메모 채널 기록은 `/memos`로 이동하는지 확인 — todo history click → /todos
- [ ] 기존 메모 알림 click(단일/병합) 동작이 변경 없음(회귀 없음) — smoke: memo click → /memos 또는 `/?memo=...`

## 2026-04-24: notification_history DB CHECK 제약 직접 반영 ✅ 완료

> from: [`2026-04-24_fix-todo-notification-click-and-sw-messages`](docs/archive/2026-04-24_fix-todo-notification-click-and-sw-messages.md) Phase DB-Direct item 7
> 다른 세션에서 실행 완료됨 (2026-04-24)

- [x] `data/migrations/011_notification_history_todo_contract.sql` 실행 완료
- [x] CHECK 제약 업데이트 확인
- [ ] 확인 후 todo 알림 1건 발송 → `/notifications` 페이지에서 기록이 생성되는지 확인한다 (DB CHECK 통과 증거)

---

## 2026-04-24: Google 로그인 운영 재현 검증

> from: `docs/archive/2026-04-24_fix-google-login-regression.md` (수동 DevTools 재현)

- [ ] Chrome DevTools Application: SW unregister 직후와 hard reload 후 각각 `navigator.serviceWorker.controller?.scriptURL`을 기록해 callback 페이지가 최신 SW control 상태인지 비교한다
- [ ] Chrome DevTools Network: `/auth/callback` document 응답이 SW on/off 각각에서 최신 번들로 로드되는지 비교 확인한다
- [ ] Chrome DevTools Network: `signInWithIdToken()` 호출의 실제 URL, 상태코드, 실패 타입(`blocked`, `cancelled`, `net::ERR_*`, CORS)을 기록한다
- [ ] 브라우저 콘솔: callback 로그에 토큰 원문이 남지 않으면서도 `provider`, `hasGoogleTokens`, `hasSupabaseTokens`, `navigator.onLine`이 보이는지 확인한다
- [ ] 회귀 확인: Kakao 로그인, 기존 `returnTo=/settings` 복귀, 재배포 직후 `/auth/callback` 최신 반영이 유지되는지 확인한다

---

## 2026-04-24: Settings 페이지 재디자인 UI 검증

> from: [`2026-04-24_redesign-settings-page`](docs/archive/2026-04-24_redesign-settings-page.md)

- [ ] Settings Hub 페이지(`/settings`) 로드 → NavGroup/NavRow 목록이 정상 렌더링되는지 확인
- [ ] Notifications 서브페이지(`/settings/notifications`) 진입 → 모든 토글/섹션 정상 표시 확인
- [ ] Developer 서브페이지(`/settings/developer`) 진입 → dev mode unlock PIN 입력 흐름 동작 확인
- [ ] 다크/라이트 테마 전환 시 `settings-*` CSS 네임스페이스 색상이 정상 적용되는지 확인
- [ ] markdown 미리보기 토글(SegmentedControl) 전환 시 Pill 상태 갱신 확인
- [ ] developer 모드 unlock 후 페이지 재이동 시 `dev_mode_unlocked` localStorage 유지 확인

---

## 2026-04-24: 알림 기본설정 계정단위 동기화 수동 검증

> from: `docs/plan/2026-04-24_clarify-default-reminder-settings.md`

### 2세션(2브라우저/2기기) 동기화

- [ ] 같은 계정으로 세션 A/B 로그인
- [ ] 세션 A에서 기본알림 시간/요일 변경 → 세션 B에 반영되는지 확인 (realtime 또는 새로고침)
- [ ] 세션 A에서 “새 메모 자동알림” 토글 변경 → 세션 B에 반영되는지 확인
- [ ] 세션 A에서 할일 기본 알림시간/자동알림(분) 변경 → 세션 B에 반영되는지 확인
- [ ] 두 세션 모두 새로고침/재진입 후에도 서버값이 우선으로 유지되는지 확인 (remote fetch)
- [ ] 비로그인 창에서는 localStorage fallback이 유지되는지 확인 (로그인 후에는 서버값 우선)

### 연쇄 업데이트 회귀 (기존 알림 동작 보존)

- [ ] `isDefault: true` 메모가 있는 상태에서 기본알림 시간/요일/자동열기 변경 → 기존 메모 알림이 예상대로 갱신되는지 확인
- [ ] `useGlobalRemind/useGlobalAutoAlert` 할일이 있는 상태에서 할일 기본값 변경 → 기존 할일 알림 시각/분이 예상대로 따라오는지 확인
- [ ] 세션 B에서도 동일하게 갱신/표시가 맞는지 확인 (중복 적용/폭주 징후 포함)

---

*마지막 업데이트: 2026-04-24*
