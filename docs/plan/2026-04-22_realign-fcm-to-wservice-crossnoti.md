# FCM 프로젝트 원복: wservice-crossnoti 기준 재정렬

> 작성일시: 2026-04-22 14:04
> 기준커밋: 7d9cc88
> 대상 프로젝트: gifticon-manager, memo-alarm
> 상태: 초안
> 진행률: 0/6 (0%)
> 요약: 사용자 기준 canonical 이름은 `wservice-crossnoti`이며, 제공된 Google Console URL·서비스계정 JSON의 literal project id는 `wservice-cross-noti`다. 이 계획은 임시로 되돌아간 `lineminder-23489` 경로를 정답으로 간주하지 않고, `wservice-crossnoti` 기준으로 서버 secret, 클라이언트 Firebase 식별자, 기존 토큰 재등록 흐름을 다시 맞춘다.
>
> **실행 TODO:**
> - [gifticon-manager: Phase 1~2](../../../../../tools/gifticon-manager/docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti_todo-1.md) — independent, 선행조건 없음
> - [memo-alarm: Phase 3~5](./2026-04-22_realign-fcm-to-wservice-crossnoti_todo-2.md) — parent, 선행조건: `../../../../../tools/gifticon-manager/docs/plan/2026-04-22_realign-fcm-to-wservice-crossnoti_todo-1.md`

---

## 개요

현재 운영 경로는 `lineminder-23489` 기준으로 돌아가 있지만, 사용자 메모 기준 원래 의도한 이름은 `wservice-crossnoti`다. 제공된 서비스계정 JSON은 `D:\Data\obsidian2\Study\Dev\Tools\woory\wservice-cross-noti-firebase-adminsdk-fbsvc-bc0aff608d.json`이며, 키 생성 시각도 2026-02-06으로 남아 있어 이후 즉흥적으로 만든 `lineminder-23489` 서비스계정보다 앞선다.

실제 검증 기준으로도 provided JSON 자체가 깨진 것은 아니다. `wservice-cross-noti` 서비스계정으로 자기 프로젝트에 FCM `validate_only`를 보냈을 때 `PERMISSION_DENIED`가 아니라 `SENDER_ID_MISMATCH`가 반환됐다. 이는 현재 저장된 `memo-alarm` 토큰이 다른 sender에서 발급됐다는 뜻이고, "admin JSON 교체만 하면 끝"이 아니라 **클라이언트 public Firebase 식별자와 토큰 재발급까지 같이 가야 한다**는 뜻이다.

또 하나의 핵심 리스크는 `memo-alarm/.env`가 프로젝트 로컬 파일이 아니라 `D:\work\project\service\wtools\common\.env.shared`를 가리키는 심볼릭 링크라는 점이다. 여기에는 `line-minder`, `memo-alarm`, 다른 wtools 앱이 함께 의존하므로, 이번 수정은 "memo-alarm만 조용히 교체"가 아니라 shared env 분리 또는 memo-alarm 전용 override 전략을 같이 설계해야 한다.

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | 서버 secret 원복 | `send-notifications`가 provided JSON과 literal project id `wservice-cross-noti`를 기준으로 발송하도록 정렬 | 중간 |
| P0 | sender mismatch 분리 | `SENDER_ID_MISMATCH`를 cutover 신호로 분리하고 stale token을 재등록 대상으로 전환 | 중간 |
| P0 | memo-alarm public config 원복 | `memo-alarm`의 web FCM 식별자를 `wservice-crossnoti` 기준으로 되돌리고 하드코딩/공유 env 의존을 정리 | 높음 |
| P0 | 토큰 재발급 플로우 | 현재 활성 `lineminder` 토큰을 비활성화하고 새 sender 기준 토큰을 강제 재등록 | 중간 |
| P1 | 운영 검증 루틴 | validate_only, `notification_logs`, `user_devices`, `cron.job` 기준으로 cutover 완료 여부를 재확인 | 중간 |

## 기술적 고려사항

- provided 서비스계정 JSON은 서버용 자격증명이다. 클라이언트 전환에는 `apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId`, `VAPID key`가 별도로 필요하다. 현재 확인된 `wservice-crossnoti` artifact에는 `project_id`, `project_number`, Android API key만 있고 web `appId`와 VAPID key는 별도 수집이 필요하다.
- `memo-alarm/.env`는 `common/.env.shared` 심볼릭 링크이므로, shared 파일을 그대로 바꾸면 `line-minder` 등 다른 앱도 함께 영향을 받는다. 이번 plan은 memo-alarm 전용 env override 또는 shared env 분리를 포함해야 한다.
- `memo-alarm/static/firebase-messaging-sw.js`는 public env와 별개로 Firebase 식별자를 하드코딩한다. sender cutover 이후 이 파일이 남아 있으면 브라우저 토큰 발급 프로젝트와 서비스워커 수신 프로젝트가 다시 어긋날 수 있다.
- 현재 `+layout.svelte`는 로그인 후 자동으로 `registerFCMToken()`을 호출한다. 이 자동 흐름을 이용하면 cutover 직후 "project marker mismatch"를 감지해 `resetFCMToken()` 또는 강제 재등록으로 연결할 수 있다.
- 운영 cron 중복은 이미 정리돼 있으므로 이번 계획의 주초점은 권한보다 sender 정합성 복구다. 다만 cutover 동안 `send-fcm-notifications-every-minute` 1개만 유지되는지는 계속 확인한다.

---

*상태: 초안 | 진행률: 0/6 (0%)*
