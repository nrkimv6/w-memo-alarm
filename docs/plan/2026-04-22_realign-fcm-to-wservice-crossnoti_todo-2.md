# FCM 프로젝트 원복: wservice-cross-noti 기준 재정렬 — TODO 2

> 계획서: [plan](./2026-04-22_realign-fcm-to-wservice-crossnoti.md)
> 대상 프로젝트: memo-alarm
> 실행순서: 2
> 선행조건: ../../../../../tools/gifticon-manager/docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti_todo-1.md
> 테스트명령: `npm run check` + 개발자 모드 FCM 재등록/로그 확인
> 진행률: 0/3 (0%)
> 요약: memo-alarm의 Firebase public config를 `wservice-cross-noti` 기준으로 되돌리고, 자동 FCM 등록 흐름에 project marker 기반 강제 재등록 단계를 추가한다.

> **선행 plan 전제**: 본 todo는 `2026-04-22_fix-notification-fcm-permission-and-duplicate-cron` plan이 이미 `settings/+page.svelte`에 추가해둔 "서버측 FCM 상태" 카드, `notificationLogs`/`lastErrorMessage` 상태, `[CODE]` 접두 표시 위에서 동작한다. 이번 todo는 같은 파일에 **추가 카드/배지**를 붙이는 형태이며, 기존 카드를 제거하거나 대체하지 않는다.

## Phase 3: memo-alarm public Firebase 설정 원복

1. - [ ] **memo-alarm을 shared Firebase 설정에서 분리한다** — `line-minder`와 같은 값을 계속 물고 있지 않게 한다.
   - [ ] `D:\work\project\service\wtools\common\.env.shared`: `memo-alarm`이 shared Firebase 블록에 묶여 있는 현재 구조를 해제할지, 아니면 memo-alarm 전용 `.env.local` override를 둘지 **구현 전에 한 가지만 선택한다**. 기본 경로는 후자(override) — shared 파일은 `line-minder` 값을 유지하고, memo-alarm이 로컬 override로 `wservice-cross-noti` 값을 덮어쓴다. 이때 shared 파일에서 memo-alarm 전용 주석 블록은 삭제한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\.env`: 현재 `common/.env.shared`를 가리키는 심볼릭 링크를 유지한 채, 같은 디렉토리에 `.env.local`을 신규 생성하고 `PUBLIC_FIREBASE_PROJECT_ID`, `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_STORAGE_BUCKET`, `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `PUBLIC_FIREBASE_APP_ID`, `PUBLIC_FIREBASE_VAPID_KEY`를 `wservice-cross-noti` 기준으로 채운다. SvelteKit은 `.env.local`이 `.env`보다 우선 적용된다는 규칙을 주석으로 남긴다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\static\firebase-messaging-sw.js`: 하드코딩된 `lineminder-23489` 식별자와 `"line-minder와 동일한 프로젝트"` 주석을 제거하고, memo-alarm이 실제 사용하는 `wservice-cross-noti` web config(apiKey, authDomain, projectId=`wservice-cross-noti`, messagingSenderId, appId)로 맞춘다. VAPID key는 service worker 쪽에서 사용하지 않으므로 제외.

## Phase 4: sender 전환 시 토큰을 강제 재등록한다

2. - [ ] **project marker mismatch를 first-class 상태로 추가한다** — sender가 바뀌면 토큰을 자동으로 갈아끼운다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: `PUBLIC_FIREBASE_PROJECT_ID`와 `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`를 `${projectId}|${senderId}` 형태로 합친 `FCM_PROJECT_MARKER`를 `localStorage['fcm.projectMarker']`에 저장하는 `readStoredProjectMarker()`/`writeStoredProjectMarker()` 헬퍼를 추가한다. 저장 실패(privacy mode 등) 시 `null` 반환.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: `detectProjectMarkerMismatch(): { mismatch: boolean; stored: string | null; current: string | null }` 헬퍼를 추가해, 저장된 marker와 현재 env 값이 다르면 "토큰 재등록 필요" 상태를 반환한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\routes\+layout.svelte`: 기존 `hasDeactivatedToken()` 분기 위에서 `detectProjectMarkerMismatch()`를 먼저 검사하고, `mismatch === true`면 `resetFCMToken()` 호출 후 `registerFCMToken()` 재진입, 성공 시 `writeStoredProjectMarker(current)`를 호출해 marker를 갱신한다. mismatch 분기에서는 기존 `hasDeactivatedToken()` 검사를 skip해 이중 재등록을 피한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 개발자 모드 FCM 카드(선행 plan이 추가한 "서버측 FCM 상태" 카드 아래)에 `current project marker`, `stored project marker`, `재등록 필요 여부` 3줄과 최근 로그 중 `[SENDER_ID_MISMATCH]` 접두가 포함된 행만 필터해 보여 주는 섹션을 추가한다.

## Phase 5: cutover 완료 조건을 앱 기준으로 잠근다

3. - [ ] **새 sender로 등록된 토큰만 정상 상태로 본다** — old sender token이 남아도 오판하지 않게 한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: 수동 등록 엔트리(`registerFCMToken()` 수동 호출)와 재설정 경로(`resetFCMToken()` 후 재등록) 모두 **토큰 등록 성공 직후에만** `writeStoredProjectMarker()`를 호출하도록 순서를 강제한다. 실패한 경로에서 marker가 앞서 갱신되는 상태를 막는다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `user_devices` 조회 결과에서 `is_active=true` count와 최근 10건 로그의 `[SENDER_ID_MISMATCH]`/`[PERMISSION_DENIED]` 출현 여부를 함께 계산해, `activeTokenCount >= 1 && senderMismatchInRecent === 0 && permissionDeniedInRecent === 0`일 때만 성공 배지(녹색)를 띄우도록 조건을 수정한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\docs\plan\2026-04-22_realign-fcm-to-wservice-crossnoti_todo-2.md`: 아래 `## 최종 수동 검증 순서` 섹션을 추가해, `설정 페이지 재등록 → user_devices active token 확인 → validate_only 성공 → 실제 스케줄 수신 확인` 순서를 문서에 고정한다.

## 최종 수동 검증 순서 (Phase 3~5 완료 후)

1. 설정 페이지 > 개발자 모드 진입 → `현재 marker`가 `wservice-cross-noti|<senderId>`로 표시되는지 확인.
2. "강제 재등록" 트리거(또는 `+layout.svelte` 자동 재등록 경로 재진입)로 `user_devices.is_active=true` 행이 새 sender 기준으로 생성되는지 확인.
3. todo-1 운영 실행 순서 3번의 `validate_only`를 재호출해 `senderMismatchCount === 0`이 되는지 확인.
4. 실제 스케줄 시각에 디바이스에서 푸시 알림을 수신하는지 확인.
5. 선행 plan의 "서버측 FCM 상태" 카드에서 `lastSuccessAt`이 `validate_only` 이후 시각으로 갱신되는지 확인.

---

## 🔴 백엔드/Python 변경 시 — SKILL.md `pytest 강제 Phase 규칙` 적용

Python 수정 없음. Svelte/TypeScript/운영 검증만 포함한다.

---

*진행률: 0/3 (0%)*
