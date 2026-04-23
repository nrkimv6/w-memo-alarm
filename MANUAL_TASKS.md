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

*마지막 업데이트: 2026-04-23*
