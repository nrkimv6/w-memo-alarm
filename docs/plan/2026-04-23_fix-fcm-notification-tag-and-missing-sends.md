# fix: FCM 알림 덮어쓰기 + 6개 미전송 원인 수정

> 작성일시: 2026-04-23 16:45
> 기준커밋: 06f7142
> 대상 프로젝트: memo-alarm, line-minder
> 상태: 초안
> 유형: fix
> 진행률: 0/73 (0%) (memo-alarm 42 + line-minder 31, 하위 TODO 참조)
> 요약: FCM push 알림이 고정 tag으로 서로 덮어쓰여 동일 시각 여러 알림 병합 불가, 14개 중 6개 미수신 — firebase-messaging-sw.js merge window 구현 + send-notifications INVALID_ARGUMENT 토큰 비활성화 오처리 수정
>
> **실행 TODO:**
> - [memo-alarm: Phase 0~1 SW merge window](./2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-1.md) — independent, 선행조건 없음
> - [line-minder: Phase 0~2 send-notifications 수정](../../../line-minder/docs/plan/2026-04-23_fix-fcm-notification-tag-and-missing-sends_todo-2.md) — independent, 선행조건 없음

---

## 개요

### 문제 1: FCM 알림 병합 미동작 (고정 tag 덮어쓰기)

`static/firebase-messaging-sw.js`는 모든 FCM background push에 동일한 `tag: 'memo-alarm-notification'`을 사용한다.
브라우저의 Notifications API는 동일 tag를 가진 새 알림이 오면 이전 알림을 **교체(replace)** 하므로,
같은 시각에 여러 FCM 알림이 도달하면 마지막 1개만 화면에 남는다.

반면 `src/service-worker.ts`는 동일 분에 발송될 로컬 알림을 모아 `showMergedNotification()`으로
N개 병합 후 `"N개의 메모 알림"` 형태로 표시한다. FCM에는 이 로직이 없다.

### 문제 2: 14개 중 6개 미전송

Cloudflare 환경변수 오설정(잘못된 PROJECT_ID + 나머지 7개 불일치)으로 인해:
1. FCM 토큰 등록 시 INVALID_ARGUMENT → `send-notifications` Edge Function이 해당 토큰을 `is_active=false`로 비활성화
2. 이후 알림 스케줄 조회 시 `user_devices.is_active = true` 필터로 제외 → 알림 미전송
3. Cloudflare 수정 후 새 토큰이 등록됐지만, 이미 비활성화된 디바이스 레코드가 남아있어 일부 스케줄이 join에서 누락

추가로, Edge Function이 INVALID_ARGUMENT를 일반 만료 토큰과 동일하게 처리하므로
일시적인 설정 오류로도 영구적인 토큰 비활성화가 발생한다.

### 근본 원인

| ID | 위치 | 원인 |
|----|------|------|
| RC-1 | `static/firebase-messaging-sw.js` | `tag: 'memo-alarm-notification'` 고정 → 동일 시각 FCM push 교체, 병합 없음 |
| RC-2 | `send-notifications/index.ts` | `INVALID_ARGUMENT` 에러 시 `is_active=false` 처리 → 설정 오류로 인한 일시적 INVALID_ARGUMENT도 영구 비활성화 |

---

## 수정 방향

### Fix 1 (memo-alarm): FCM merge window

`firebase-messaging-sw.js`에 module-level pending buffer + 800ms debounce timer를 도입한다.
- 단일 알림: `tag: memo-alarm-{schedule_id}` (schedule_id별 고유 tag, 중복 방지)
- 복수 알림(같은 800ms window 내): `"N개의 메모 알림"` + 제목 목록 (service-worker.ts 스타일)
  - merged tag는 고정값 사용 금지 (이전 merged 알림이 교체되지 않도록 `schedule_id` 또는 timestamp 기반 key 사용)
  - memo 식별자는 FCM payload `data.memo_id` (snake_case) 기반으로 수집

`notificationclick` 핸들러도 merged type을 처리하도록 확장한다.

### Fix 2 (line-minder): INVALID_ARGUMENT 처리 분리

토큰 비활성화 트리거를 `NOT_FOUND` / `UNREGISTERED` 로만 제한한다.
`INVALID_ARGUMENT`는 설정 오류·포맷 오류 가능성이 있으므로 경고 로그만 남기고 토큰을 유지한다.

---

## 기술적 고려사항

- **merge window 800ms**: FCM은 동일 cron(1분 주기)에서 보내므로 실제로 수십 ms 안에 다수 push가 도착.
  800ms는 충분한 집합 window다. SW keepalive를 위해 handler가 반환하는 Promise는 timer 완료까지 resolve 보류.
- **Promise chain in merge**: `messaging.onBackgroundMessage` 각 호출이 별도 Promise를 반환하며 SW는 모두 대기.
  마지막 push의 Promise만 notification을 표시하고 나머지는 idle로 resolve 해도 동작에 문제없다.
  (각 handler가 동일 timer reference를 공유해 마지막 handler가 실제 표시를 담당)
- **INVALID_ARGUMENT 범위**: FCM API v1은 `INVALID_ARGUMENT`를 메시지 payload 오류, 잘못된 토큰 포맷,
  프로젝트 불일치 등 다양한 상황에서 반환한다. 토큰 만료/삭제는 `UNREGISTERED` / `NOT_FOUND`이다.
  따라서 `INVALID_ARGUMENT`는 비활성화 사유가 아니다.

---

*상태: 초안 | 진행률: 하위 TODO 참조*
