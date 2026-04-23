# FCM 프로젝트 원복: wservice-cross-noti 기준 재정렬

> 작성일시: 2026-04-22 14:04
> 기준커밋: 7d9cc88
> 대상 프로젝트: gifticon-manager, memo-alarm
> 상태: 초안
> 진행률: 0/6 (0%)
> 선행 plan: [`2026-04-22_fix-notification-fcm-permission-and-duplicate-cron`](./2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md) (진행중) — Phase 1~4와 Phase R이 이미 추가해둔 `NormalizedFcmErrorCode`, `normalizeFcmError()`, `[CODE]` 정규화, `FCM_PROJECT_ID_MISMATCH` 가드, settings "서버측 FCM 상태" 카드 위에서 본 plan이 동작한다. **선행 plan의 Phase 5(운영 secret 교체)는 `lineminder-23489` 방향으로 명시되어 있는데, 본 plan이 그 방향을 `wservice-cross-noti`로 뒤집는다.** 선행 plan의 Phase 5는 본 plan 완료 시점에 "대체됨"으로 정리한다 — 정리 시점은 본 plan의 Phase 5가 운영 반영될 때.
> 요약: 프로젝트 id는 `wservice-cross-noti`(Google Console literal)로 통일한다. 이전에 혼용된 alias `wservice-crossnoti`(하이픈 없음) 표기는 폐기하며, 본 계획은 임시로 되돌아간 `lineminder-23489` 경로를 정답으로 간주하지 않고 `wservice-cross-noti` 기준으로 서버 secret, 클라이언트 Firebase 식별자, 기존 토큰 재등록 흐름을 다시 맞춘다.
>
> **실행 TODO:**
> - [gifticon-manager: Phase 1~2](../../../../../tools/gifticon-manager/docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti_todo-1.md) — independent, 선행조건 없음
> - [memo-alarm: Phase 3~5](./2026-04-22_realign-fcm-to-wservice-crossnoti_todo-2.md) — parent, 선행조건: `../../../../../tools/gifticon-manager/docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti_todo-1.md`

---

## 개요

현재 운영 경로는 `lineminder-23489` 기준으로 돌아가 있지만, 원래 사용자가 의도한 프로젝트는 `wservice-cross-noti`다(`cross-noti/google-services_crossnoti.json` literal과 동일). 제공된 서비스계정 JSON은 `D:\Data\obsidian2\Study\Dev\Tools\woory\wservice-cross-noti-firebase-adminsdk-fbsvc-bc0aff608d.json`이며, 키 생성 시각도 2026-02-06으로 남아 있어 이후 즉흥적으로 만든 `lineminder-23489` 서비스계정보다 앞선다. 과거 plan 본문에서 사용했던 alias `wservice-crossnoti`(하이픈 없음)는 Google API 어디에서도 유효하지 않은 사용자 노트 관습이었으므로 본 plan부터는 하이픈 있는 literal 하나로 통일한다. (예외: Android package `day.woory.crossnoti`는 Android 네이밍 규칙상 하이픈 불가라서 별개로 유지한다.)

실제 검증 기준으로도 provided JSON 자체가 깨진 것은 아니다. `wservice-cross-noti` 서비스계정으로 자기 프로젝트에 FCM `validate_only`를 보냈을 때 `PERMISSION_DENIED`가 아니라 `SENDER_ID_MISMATCH`가 반환됐다. 이는 현재 저장된 `memo-alarm` 토큰이 다른 sender에서 발급됐다는 뜻이고, "admin JSON 교체만 하면 끝"이 아니라 **클라이언트 public Firebase 식별자와 토큰 재발급까지 같이 가야 한다**는 뜻이다.

또 하나의 핵심 리스크는 `memo-alarm/.env`가 프로젝트 로컬 파일이 아니라 `D:\work\project\service\wtools\common\.env.shared`를 가리키는 심볼릭 링크라는 점이다. 여기에는 `line-minder`, `memo-alarm`, 다른 wtools 앱이 함께 의존하므로, 이번 수정은 "memo-alarm만 조용히 교체"가 아니라 shared env 분리 또는 memo-alarm 전용 override 전략을 같이 설계해야 한다.

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | 서버 secret 원복 | `send-notifications`가 provided JSON과 literal project id `wservice-cross-noti`를 기준으로 발송하도록 정렬 | 중간 |
| P0 | sender mismatch 분리 | `SENDER_ID_MISMATCH`를 cutover 신호로 분리하고 stale token을 재등록 대상으로 전환 | 중간 |
| P0 | memo-alarm public config 원복 | `memo-alarm`의 web FCM 식별자를 `wservice-cross-noti` 기준으로 되돌리고 하드코딩/공유 env 의존을 정리 | 높음 |
| P0 | 토큰 재발급 플로우 | 현재 활성 `lineminder` 토큰을 비활성화하고 새 sender 기준 토큰을 강제 재등록 | 중간 |
| P1 | 운영 검증 루틴 | validate_only, `notification_logs`, `user_devices`, `cron.job` 기준으로 cutover 완료 여부를 재확인 | 중간 |

## 기술적 고려사항

- provided 서비스계정 JSON은 서버용 자격증명이다. 클라이언트 전환에는 `apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId`, `VAPID key`가 별도로 필요하다. **2026-04-23 web config + VAPID key 수집 완료** — Firebase Console에서 Web 앱을 등록하고 Web Push certificates를 확보했다. 실값은 obsidian `2026-02-11_key.md`와 todo-2 Phase 3.1 체크박스 아래 템플릿에 박혀 있다. 따라서 Phase 3 진입 시 추가 수집 작업은 없다.
- `memo-alarm/.env`는 `common/.env.shared` 심볼릭 링크이므로, shared 파일을 그대로 바꾸면 `line-minder` 등 다른 앱도 함께 영향을 받는다. 본 plan은 **memo-alarm 전용 `.env.local` override** 경로를 기본으로 선택한다(shared 파일은 건드리지 않음). 구현 중 override로는 해결 불가능하다는 게 드러나면 shared env 분리로 전환하되, 전환 판단을 개별 체크박스 단위로 흩뜨리지 않는다.
- `memo-alarm/static/firebase-messaging-sw.js`는 public env와 별개로 Firebase 식별자를 하드코딩한다. sender cutover 이후 이 파일이 남아 있으면 브라우저 토큰 발급 프로젝트와 서비스워커 수신 프로젝트가 다시 어긋날 수 있다.
- 현재 `+layout.svelte`는 로그인 후 자동으로 `registerFCMToken()`을 호출한다. 이 자동 흐름을 이용하면 cutover 직후 "project marker mismatch"를 감지해 `resetFCMToken()` 또는 강제 재등록으로 연결할 수 있다.
- 운영 cron 중복은 선행 plan(`fix-notification-fcm-permission-and-duplicate-cron`)의 Phase 2에서 이미 정리돼 있으므로 이번 계획의 주초점은 권한보다 sender 정합성 복구다. 다만 cutover 동안 `send-fcm-notifications-every-minute` 1개만 유지되는지는 선행 plan의 013 migration 확인 쿼리로 계속 확인한다.
- 선행 plan의 `settings/+page.svelte` "서버측 FCM 상태" 카드와 `notification_logs` 조회 로직은 본 plan이 재활용한다. 본 plan은 그 위에 `project marker` 카드와 `SENDER_ID_MISMATCH` 필터만 덧붙이며, 기존 카드를 제거하거나 로직을 대체하지 않는다.

### 재검토 보강 (2026-04-22, /review-plan)

- 🟡 **선행 plan Phase 5 충돌**: 선행 plan(`fix-notification-fcm-permission-and-duplicate-cron`)의 Phase 5 step 11이 "`lineminder-23489`(또는 현 운영 project_id) 대상 service account로 교체"를 명시한다. 본 plan이 `wservice-cross-noti`로 방향을 뒤집으므로, 본 plan의 Phase 5 완료 후 선행 plan의 Phase 5는 더 이상 유효하지 않다. 선행 plan 쪽 체크박스 정리는 **본 plan을 운영 반영까지 마친 뒤** `/done` 또는 `/review-plan` 재실행 시 수동으로 "대체됨" 메모와 함께 체크 처리한다. 본 plan에서는 선행 plan 파일을 수정하지 않는다(외부 수정 임의 되돌리기 금지 규칙).
- 🟢 **web artifact 수집 완료 (2026-04-23)**: Firebase Console에서 Web 앱(`1:570337797776:web:dd0e36c66152ad18275a15`) 등록 완료, VAPID key(`BLHcqgg12jg0gWLQOuJjM_Kucv_WGCkaNq48BdAKHgZKn6rfsgrKD4RNnVnYeeSPzJhBnO6coebq8NEaTqzvdv0`, 2026-04-23 추가된 pair) 확보. 전체 web config는 obsidian `D:\Data\obsidian2\Study\Dev\Tools\woory\2026-02-11_key.md`의 "Web config (PUBLIC — memo-alarm 용)" 섹션에 기록되어 있고, todo-2 Phase 3.1에도 `.env.local`/`firebase-messaging-sw.js` 복붙용 템플릿이 박혀 있다. Phase 3 진입 블로커 해소.
- 🟡 **`.env.local` vs shared 분리 선택**: Phase 3.1에서 override/분리 두 경로를 열어 두면 구현 중 혼선이 생긴다. 본 plan은 **override를 기본 경로로 고정**하고, override 실패 시에만 shared 분리로 전환하도록 todo-2 Phase 3.1에서 명시했다.
- 🟡 **settings UI 중복 렌더링 리스크**: 선행 plan이 `settings/+page.svelte`에 이미 "서버측 FCM 상태" 카드를 추가했고 진행률 29/33으로 대부분 완료 상태다. 본 plan의 "project marker" 카드는 그 아래에 **추가**하며, 동일 `notification_logs` 조회를 중복 수행하지 않고 기존 `fcmStatus.notificationLogs` 배열을 필터해 재활용한다.
- 🟢 **Phase T1~T5 미적용 사유**: 본 plan은 Deno Edge Function(TypeScript) + Svelte/TS + 운영 SQL/.env만 수정하며 Python/FastAPI 백엔드 변경이 없으므로 expand-todo의 5-Phase 테스트 블록은 필수 대상이 아니다. 대신 todo-1 "운영 실행 순서"와 todo-2 "최종 수동 검증 순서"를 유지한다.
- 🟢 **main drift**: 기준커밋 `7d9cc88` 이후 gifticon-manager/memo-alarm 두 레포의 `send-notifications/index.ts`, `settings/+page.svelte`, `fcm.ts`, `+layout.svelte`에 선행 plan의 Phase 1~4/R 작업이 반영돼 있다. 본 plan 구현 직전 `git status` + `git log --since` 교차 확인으로 선행 plan 커밋 이외의 예기치 않은 변경이 없는지 재점검한다.
- 🟢 **naming 통일 (사용자 결정)**: 이전 draft에서 `wservice-crossnoti`(alias) vs `wservice-cross-noti`(literal) 이중 표기를 유지했으나, alias는 Google API 어디서도 유효하지 않아 혼선의 원인이었다. 본 plan/todo-1/todo-2는 Firebase literal `wservice-cross-noti` 하나로 통일하고 todo-1 Phase 2 step 2의 `CANONICAL_PROJECT_ALIAS` 상수 도입 지시, todo-2 Phase 3.1의 "literal project id" 병기 표현도 제거했다. 예외: Android package `day.woory.crossnoti`는 Android 네이밍 제약상 하이픈 불가라 별개 유지. 파일명(`..._realign-fcm-to-wservice-crossnoti*.md`)은 내부 링크 깨짐을 피하기 위해 rename하지 않고 유지한다.

---

*상태: 초안 | 진행률: 0/6 (0%)*
