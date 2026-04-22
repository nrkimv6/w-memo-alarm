# FCM 프로젝트 원복: wservice-crossnoti 기준 재정렬 — TODO 2

> 계획서: [plan](./2026-04-22_realign-fcm-to-wservice-crossnoti.md)
> 대상 프로젝트: memo-alarm
> 실행순서: 2
> 선행조건: ../../../../../tools/gifticon-manager/docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti_todo-1.md
> 테스트명령: `npm run check` + 개발자 모드 FCM 재등록/로그 확인
> 진행률: 0/3 (0%)
> 요약: memo-alarm의 Firebase public config를 `wservice-crossnoti` 기준으로 되돌리고, 자동 FCM 등록 흐름에 project marker 기반 강제 재등록 단계를 추가한다.

## Phase 3: memo-alarm public Firebase 설정 원복

1. ☐ **memo-alarm을 shared Firebase 설정에서 분리한다** — `line-minder`와 같은 값을 계속 물고 있지 않게 한다.
   - ☐ `D:\work\project\service\wtools\common\.env.shared`: `memo-alarm`이 shared Firebase 블록에 묶여 있는 현재 구조를 해제할지, 아니면 memo-alarm 전용 `.env.local` override를 둘지 결정하고 한쪽만 남긴다. 핵심은 `line-minder`와 `memo-alarm`이 같은 public Firebase 값을 공유하지 않게 만드는 것이다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\.env`: 현재 심볼릭 링크를 memo-alarm 전용 환경 파일로 대체하거나 `.env.local`을 추가해 `PUBLIC_FIREBASE_*` 값이 `wservice-crossnoti` 기준으로 읽히게 한다. 이때 literal project id는 `wservice-cross-noti`를 사용하되 문서/표시는 `wservice-crossnoti`로 통일한다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\static\firebase-messaging-sw.js`: 하드코딩된 `lineminder-23489` 식별자와 `"line-minder와 동일한 프로젝트"` 주석을 제거하고, memo-alarm이 실제 사용하는 `wservice-crossnoti` web config로 맞춘다.

## Phase 4: sender 전환 시 토큰을 강제 재등록한다

2. ☐ **project marker mismatch를 first-class 상태로 추가한다** — sender가 바뀌면 토큰을 자동으로 갈아끼운다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: `PUBLIC_FIREBASE_PROJECT_ID`와 `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`를 합친 `FCM_PROJECT_MARKER`를 `localStorage`에 저장하고, 저장된 marker와 현재 env가 다르면 "토큰 재등록 필요" 상태를 반환하도록 helper를 추가한다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\src\routes\+layout.svelte`: 기존 `hasDeactivatedToken()` 검사보다 앞에서 project marker mismatch를 확인하고, mismatch면 `resetFCMToken()` 또는 강제 재등록 경로를 실행한다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 개발자 모드 FCM 카드에 `current project marker`, `stored project marker`, `재등록 필요 여부`, 최근 `[SENDER_ID_MISMATCH]` 로그를 노출해 cutover 진행 상태를 한 화면에서 볼 수 있게 한다.

## Phase 5: cutover 완료 조건을 앱 기준으로 잠근다

3. ☐ **새 sender로 등록된 토큰만 정상 상태로 본다** — old sender token이 남아도 오판하지 않게 한다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: 수동 등록/재설정 경로가 새 `FCM_PROJECT_MARKER` 저장을 성공 후에만 갱신하도록 수정해, 실패했는데 marker만 바뀌는 상태를 막는다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `user_devices` 조회 결과에서 active token 수와 최근 failed code를 함께 보여주고, `SENDER_ID_MISMATCH`가 남아 있으면 성공 배지를 띄우지 않도록 한다.
   - ☐ `D:\work\project\service\wtools\memo-alarm\docs\plan\2026-04-22_realign-fcm-to-wservice-crossnoti_todo-2.md`: 최종 수동 검증 순서를 `설정 페이지 재등록 → user_devices active token 확인 → validate_only 성공 → 실제 스케줄 수신 확인`으로 고정한다.

---

## 🔴 백엔드/Python 변경 시 — SKILL.md `pytest 강제 Phase 규칙` 적용

Python 수정 없음. Svelte/TypeScript/운영 검증만 포함한다.

---

*진행률: 0/3 (0%)*
