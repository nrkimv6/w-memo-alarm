# fix: todo 알림 click 라우팅 + SW 메시지 계약 정리

> 작성일시: 2026-04-24 10:40
> 기준커밋: 38eb43a
> 대상 프로젝트: memo-alarm
> 상태: 머지대기
> branch: impl/fix-todo-notification-click-and-sw-messages
> worktree: .worktrees/impl-fix-todo-notification-click-and-sw-messages
> worktree-owner: D:/work/project/service/wtools/memo-alarm/docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md
> 진행률: 63/78 (81%)
> 요약: SW todo 알림은 `data.type === 'todo-*'` 인데도 `notificationclick`이 `memoId`만 보고 `/?memo=...`로 라우팅한다. 또한 SW가 `TODO_NOTIFICATION_SENT`를 보내지만 메인 스레드 소비자가 없어 기록/디버깅 경로가 단절되어 있다. click 라우팅/메시지 상수/히스토리 기록을 정합하게 맞춘다.
> 출처: /reflect에서 자동 생성

---

## 개요

`2026-04-24_fix-todo-notification-merge-in-sw`에서 todo 알림 폭주를 병합 알림으로 축약했다. 다만 후속 확인 결과, **단일 todo 알림 클릭 라우팅**과 **SW→메인 메시지 계약**이 정합하지 않다.

- `src/service-worker.ts` `notificationclick`:
  - `data.type === 'todo-merged'`면 `/todos`로 이동 (정상)
  - 그 외는 `data.memoId` 존재 시 `/?memo=${memoId}`로 이동 (todo 단일 알림도 여기로 떨어짐)
- `src/service-worker.ts` todo 알림 발송은 `client.postMessage({ type: 'TODO_NOTIFICATION_SENT', ... })`를 사용하지만
  - `src/lib/stores/notifications.svelte.ts`는 `SW_MSG.NOTIFICATION_SENT`만 소비한다 (TODO 경로 미소비)

결과적으로:
- 단일 todo 알림 클릭 시 `/todos`로 가지 않고 홈(메모 상세 쿼리)로 이동할 수 있다.
- todo 알림 발송 기록이 `notificationHistoryStore`에 남지 않는다 (devtools 메시지 확인 외에는 근거가 빈약함).

## 기술적 고려사항

- `/todos` 페이지는 memo 기반으로 todo를 렌더링한다 (`memoType === "todo"`). 따라서 todo의 식별자는 현재 SW payload의 `memoId`와 동일할 수 있다.
- 현재 `src/routes/todos/+page.svelte`는 `?id=` 같은 쿼리 파라미터를 소비하지 않는다. 따라서 이번 fix의 click 목표는 todo 상세 deep-link가 아니라 `/todos` 리스트 진입으로 고정하는 편이 현재 코드와 맞다.
- 최소 변경으로는 `notificationclick`에서 `data.type`이 `todo-` prefix면 `/todos`로 보내는 것만으로 click 회귀는 막을 수 있다.
- 기록/디버깅 정합성을 위해 `TODO_NOTIFICATION_SENT`를 `SW_MSG`에 추가하고, 메인 스레드에서 history 기록을 남기도록 한다.
- SW 번들 제약 때문에 `src/lib/constants/swMessages.ts`를 SW에서 import하는 것은 피하고, 문자열은 그대로 두되 **메인 스레드 상수와 값이 일치**하도록만 맞춘다.
- 현재 `NotificationHistory` 타입은 `reminderType: 'default' | 'additional'`, `channel: 'sw-push' | 'capacitor-local' | 'fcm-push'`만 허용한다. plan대로 todo 전용 값을 기록하려면 `src/lib/types/memo.ts`와 이를 소비하는 UI 계약을 함께 넓혀야 한다.
- 현재 `data/migrations/006_notification_history.sql`의 `ma_notification_history` 테이블은 `reminder_type`, `channel`에 CHECK 제약이 있다. 즉 `sw-todo`, `todo-remind`, `todo-alert`, `todo-overdue`를 쓰려면 TypeScript 수정만이 아니라 SQL 마이그레이션과 running DB 직접 반영이 함께 필요하다.
- `src/lib/components/notifications/HistoryCard.svelte`는 현재 `sw-todo` 채널 라벨을 모른다. 이 값을 그대로 기록하면 UI에 raw string이 노출되므로 label 매핑 보강 여부를 plan 범위에 포함한다.
- `src/lib/components/notifications/HistoryCard.svelte`는 클릭 시 항상 `goto('/memos')`를 호출하지만, 실제 `src/lib/stores/filter.svelte.ts`는 `/memos` 기본 목록에서 `memoType === 'todo'`를 숨긴다. 즉 todo history를 추가하면 카드 클릭이 대상 리스트를 못 보여주는 회귀가 생기므로, history click 동선도 함께 고쳐야 한다.
- `docs/plan/todo-feature/phase-2-alarm-postpone.md` 7장에 "할일 알림도 기존 notificationHistoryStore에 기록" backlog가 이미 있다. 이번 fix plan은 그 중 **Service Worker click 라우팅 + SW history contract**만 선반영하고, native/FCM/전반 UI 확장은 범위에서 제외한다고 명시해야 중복 구현을 피할 수 있다.
- `git diff --name-only 38eb43a..main` 기준으로 현재 main drift는 `TODO.md`, 본 계획서 2개뿐이다. 대상 코드(`src/service-worker.ts`, `src/lib/stores/notifications.svelte.ts`, `src/lib/types/memo.ts`, `data/migrations/`)에는 기준커밋 이후 추가 drift가 없다.

---

## TODO

### Phase 0: Worktree 준비

0. - [x] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: blank 슬롯은 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `worktree 생성 또는 재개`는 `/implement` 또는 `plan-runner` owner flow 임을 적는다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 단일 todo 알림 click 라우팅 정합

1. - [x] **`notificationclick`에서 todo 알림을 `/todos`로 라우팅한다**
   - [x] `src/service-worker.ts`: `notificationclick`의 `data?.type === 'todo-merged'` 분기가 이미 `/todos`로 가는지 기준선으로 다시 확인한다
   - [x] `src/routes/todos/+page.svelte`: 현재 페이지가 `?id=` 같은 쿼리 파라미터로 특정 todo를 여는 로직이 없는지 확인하고, 이번 click target을 `/todos` 고정으로 문서에 남긴다
   - [x] `src/service-worker.ts`: 기존 `todo-merged` exact-match 분기는 그대로 유지하고, 새 `data?.type?.startsWith('todo-')` 분기는 `data?.type === 'merged'` 분기 직후, `data?.memoId` 분기 직전에 삽입한다 (`notificationclick` 핸들러 내 `} else if (data?.memoId)` 앞)
   - [x] `src/service-worker.ts`: 단일 todo 알림(`todo-remind|todo-alert|todo-overdue`)이 모두 `/todos`로 가도록 분기 조건을 추가한다
   - [x] `src/service-worker.ts`: todo 단일 알림 click 로그를 `type`, `memoId`가 함께 보이도록 추가한다
   - [x] `src/service-worker.ts`: memo 알림 click 라우팅(`data?.type === 'merged'`와 `/?memo=...`)은 기존 동작을 유지한다
   - [x] `src/service-worker.ts`: `externalUrl`는 `data.url.startsWith('http')`인 경우에만 열리므로 todo payload의 상대경로(`/todos?id=...`)는 외부 탭을 열지 않는다는 점을 문서에 남긴다
   - [x] `src/service-worker.ts`: `AUTO_OPEN_TRIGGERED` postMessage는 absolute external URL + `memoId`가 있는 memo 경로에만 남기고, todo click 라우팅과 섞지 않는다

### Phase 2: SW→메인 메시지 계약 정리

2. - [x] **SW todo 발송 payload를 성공/실패 경로 모두에서 동일한 shape로 맞춘다**
   - [x] `src/service-worker.ts`: merged success path의 `TODO_NOTIFICATION_SENT` payload에 `notificationId`, `notificationType`, `status`, `sentAt`, `errorMessage` 키를 고정한다
   - [x] `src/service-worker.ts`: merged failed path도 success path와 같은 키 집합을 유지하고 `errorMessage: e instanceof Error ? e.message : String(e)`를 추가한다 (`showMergedTodoNotification` catch 블록에서 `e`가 이미 스코프에 있음)
   - [x] `src/service-worker.ts`: single success path도 merged path와 같은 키 집합을 유지하고 `errorMessage`는 `null` 또는 생략 중 하나로 일관되게 맞춘다
   - [x] `src/service-worker.ts`: single catch path에서 `swLog(...)`만 남기지 말고 `TODO_NOTIFICATION_SENT` failed payload를 추가로 보낸다
   - [x] `src/service-worker.ts`: batch 안의 여러 todo는 동일 `sentAt`을 공유한다 — `showMergedTodoNotification`에서 이미 `const sentAt = new Date().toISOString()`을 `todos.forEach` 전에 선언하여 공유하므로 현행 방식 유지로 결정
   - [x] `src/service-worker.ts`: `notificationId`가 기존 history schema의 `reminderId` 슬롯으로 매핑될 예정임을 주석 또는 계획서 비고로 남긴다

3. - [x] **메인 스레드 상수와 `NotificationHistory` 타입을 todo 경로까지 확장한다**
   - [x] `src/lib/constants/swMessages.ts`: `TODO_NOTIFICATION_SENT` 상수를 추가한다
   - [x] `src/lib/types/memo.ts`: `NotificationHistory['reminderType']` 유니온을 `default | additional | todo-remind | todo-alert | todo-overdue`로 확장한다
   - [x] `src/lib/types/memo.ts`: `NotificationHistory['channel']` 유니온을 `sw-push | sw-todo | capacitor-local | fcm-push`로 확장한다
   - [x] `src/lib/types/memo.ts`: 기존 `NotificationHistory` 모델에 `notificationId` 전용 필드를 새로 만들지 않고, todo 경로도 기존 `reminderId` 필드를 재사용한다는 결정을 문서에 남긴다
   - [x] `src/lib/stores/notificationHistory.svelte.ts`: 타입 확장 후 `rowToRecord`의 `row.reminder_type as NotificationHistory['reminderType']`와 `recordToRow`의 `record.reminderType` 모두 type cast 방식이므로 TypeScript 유니온 확장만으로 새 값이 자동 통과하는지 확인

4. - [x] **메인 스레드 listener에서 todo 발송 기록을 저장한다**
   - [x] `src/lib/stores/notifications.svelte.ts`: SW message listener에 `event.data.type === SW_MSG.TODO_NOTIFICATION_SENT` 분기를 추가한다
   - [x] `src/lib/stores/notifications.svelte.ts`: `memosStore.getById(event.data.memoId)`로 title을 조회하고, 누락 시 `'(unknown todo)'` fallback을 사용한다
   - [x] `src/lib/stores/notifications.svelte.ts`: `notificationHistoryStore.addRecord` 호출 시 `reminderId`에 `event.data.notificationId`를 매핑한다
   - [x] `src/lib/stores/notifications.svelte.ts`: `reminderType=event.data.notificationType`, `channel='sw-todo'`, `status`, `errorMessage`, `sentAt`를 그대로 전달한다
   - [x] `src/lib/stores/notifications.svelte.ts`: memo SW 기록(`SW_MSG.NOTIFICATION_SENT`) 분기와 todo SW 기록(`SW_MSG.TODO_NOTIFICATION_SENT`) 분기가 서로 간섭하지 않도록 독립 로그 문구를 둔다
   - [x] `src/lib/stores/notifications.svelte.ts`: 새 branch 추가 뒤에도 기존 `AUTO_OPEN_TRIGGERED` 처리 순서가 바뀌지 않는지 확인한다

5. - [x] **알림 내역 UI가 새 channel 값을 읽을 수 있게 한다**
   - [x] `src/lib/components/notifications/HistoryCard.svelte`: `getChannelLabel('sw-todo')`를 추가해 raw string 대신 읽을 수 있는 라벨을 표시한다
   - [x] `src/lib/components/notifications/HistoryCard.svelte`: `handleClick()`에서 `record.channel === 'sw-todo'`면 `goto('/todos')`, 그 외는 기존 `goto('/memos')`를 유지하도록 분기한다
   - [x] `src/lib/components/notifications/HistoryCard.svelte`: todo history click은 `/todos` 리스트 진입으로 고정하고, memo history click만 `/memos`로 남긴다는 점을 코드와 계획서에 일치시킨다
   - [x] `src/routes/notifications/+page.svelte`: 목록 필터/그룹핑이 `channel` 값에 의존하지 않으므로 추가 분기 없이 새 기록이 노출되는지 확인한다
   - [x] `src/lib/components/notifications/HistoryCard.svelte`: todo 기록이 생겨도 status badge / 에러 펼침 로직은 공통으로 그대로 재사용 가능한지 확인한다

### Phase DB-Direct: notification_history 제약 직접 확장 (마이그레이션 필수)

6. - [x] **`ma_notification_history` CHECK 제약 확장 SQL을 추가한다** — worktree/impl 단계에서 수행
   - [x] `data/migrations/011_notification_history_todo_contract.sql`: 새 마이그레이션 파일을 추가한다
   - [x] `data/migrations/011_notification_history_todo_contract.sql`: `reminder_type` CHECK를 `default`, `additional`, `todo-remind`, `todo-alert`, `todo-overdue`를 허용하도록 갱신한다
   - [x] `data/migrations/011_notification_history_todo_contract.sql`: `channel` CHECK를 `sw-push`, `sw-todo`, `capacitor-local`, `fcm-push`를 허용하도록 갱신한다
   - [x] `data/migrations/011_notification_history_todo_contract.sql`: 기존 row를 rewrite하지 않고 제약만 넓히는 ALTER 순서로 작성한다
   - [x] `data/migrations/006_notification_history.sql`: 원본 생성 DDL과 011 후속 ALTER의 역할 분리가 문서상 혼동되지 않도록 계획서에 설명을 남긴다

7. - [ ] **running DB에도 동일 제약 변경을 직접 반영한다** — ⚠️ 실행 시점: main 머지 후, T4/T5 직전
   - [ ] 운영/개발 DB에 `ALTER TABLE ma_notification_history DROP CONSTRAINT IF EXISTS ...; ADD CONSTRAINT ... CHECK (...)`를 직접 실행한다
   - [ ] constraint 이름은 기본명(`ma_notification_history_reminder_type_check`, `ma_notification_history_channel_check`)을 우선 사용하되 `IF EXISTS`로 차이를 방어한다
   - [ ] 실행 결과를 기준으로 새 todo history row insert가 DB CHECK에 막히지 않는지 확인한다

8. - [ ] **스키마 드리프트를 검증한다** — N+1 직후 실행
   - [ ] `data/migrations/006_notification_history.sql` + `011_notification_history_todo_contract.sql`를 함께 읽고 허용 값 집합이 최종적으로 일치하는지 확인한다
   - [ ] `src/lib/types/memo.ts`, `src/lib/stores/notifications.svelte.ts`, `src/lib/stores/notificationHistory.svelte.ts`에서 old narrow union/상수 가정이 남아 있지 않은지 grep으로 재확인한다
   - [ ] `HistoryCard.svelte` label 매핑과 DB CHECK 값이 어긋나지 않는지 마지막으로 대조한다

### Phase R: 재발 경로 분석 (fix: plan 필수)

R1. - [x] **같은 패턴이 다른 경로에도 없는지 repo-wide로 다시 확인한다**
   - [x] 프로젝트 전체: `rg -n \"TODO_NOTIFICATION_SENT\" . -g \"!node_modules\" -g \"!build\" -g \"!\\.svelte-kit\"`로 producer/consumer가 각각 어디인지 다시 센다
   - [x] 프로젝트 전체: `rg -n \"notificationclick\" . -g \"!node_modules\" -g \"!build\" -g \"!\\.svelte-kit\"`로 `src/service-worker.ts` 외 `static/firebase-messaging-sw.js` 존재를 포함해 분류한다
   - [x] 프로젝트 전체: `rg -n \"openWindow\\(|AUTO_OPEN_TRIGGERED\" . -g \"!node_modules\" -g \"!build\" -g \"!\\.svelte-kit\"`로 외부 URL open flow가 memo 경로에만 묶여 있는지 확인한다
   - [x] `docs/plan/todo-feature/phase-2-alarm-postpone.md`: 7장 "알림 내역 연동" backlog와 현재 fix plan의 겹침 범위를 문서에 남긴다
   - [x] `docs/archive/2026-04-24_fix-todo-notification-merge-in-sw.md`: 이번 follow-up의 직접 선행 plan으로 참조한다
   - [x] `docs/archive/2026-02-04_followup-plan-notification-issues.md` + `2026-02-04_fix-report-android-pwa-notification-click.md`: 기존 `notificationclick`/`openWindow` 결정 근거로 참조한다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: 위 결과를 근거로 "재발 경로 표"를 추가한다 (방어됨/대상 아님/별도 plan 필요)

R2. - [x] **중복/범위 충돌을 현재 plan에 명시한다**
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: 이번 fix의 완료 기준을 `src/service-worker.ts` click route + `TODO_NOTIFICATION_SENT` consumer + NotificationHistory contract 확장으로 고정한다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `static/firebase-messaging-sw.js`는 memo/FCM click 경로이며 todo SW payload contract 대상이 아니라고 적는다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: Capacitor/native todo 알림 기록은 broader todo feature backlog 또는 별도 plan 범위로 남긴다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `todo-feature/phase-2-alarm-postpone.md`의 "할일 알림도 기존 notificationHistoryStore에 기록" 항목은 이번 fix가 SW subset만 선반영한 것임을 적는다

#### Phase R 결과표

| 경로 | 판정 | 근거 |
|------|------|------|
| `src/service-worker.ts` `notificationclick` | 방어 대상 | 단일 todo 알림이 현재 `/?memo={memoId}`로 빠지는 직접 원인 |
| `src/service-worker.ts` `TODO_NOTIFICATION_SENT` producer | 방어 대상 | todo SW 발송 기록의 payload parity와 실패 경로 누락을 이번 plan에서 수정 |
| `src/lib/stores/notifications.svelte.ts` SW listener | 방어 대상 | 현재 `SW_MSG.NOTIFICATION_SENT`만 소비하고 todo payload를 버림 |
| `src/lib/types/memo.ts` + `data/migrations/006_notification_history.sql` | 방어 대상 | 새 channel/reminderType 값을 막는 타입/DB 제약이 존재 |
| `src/lib/components/notifications/HistoryCard.svelte` | 방어 대상 | `sw-todo` 라벨 미정의 + 클릭 시 `/memos` 고정이라 todo 기록 동선이 깨질 수 있음 |
| `static/firebase-messaging-sw.js` `notificationclick` | 대상 아님 | FCM memo push 경로이며 todo SW payload를 사용하지 않음 |
| `src/lib/utils/capacitor.ts` todo/native 경로 | 별도 plan 필요 | broader todo history integration 범위이며 이번 fix의 SW click/message 계약 밖 |
| `docs/plan/todo-feature/phase-2-alarm-postpone.md` 7장 | 중복 회피 | todo history 전반 backlog는 유지, 이번 plan은 SW subset만 선반영 |

### Phase T3/T4/T5: 자동 테스트

> T3 해당 없음: TypeScript/Svelte 프론트엔드 프로젝트 — Python/백엔드 변경 없음, 통합 테스트 인프라 미구성. 검증은 Phase 4 수동 시나리오로 대체.
> T4 해당 없음: `tests/**/*e2e*`, `tests/**/*integration*` Glob 탐색 결과 0건 — e2e 테스트 파일 없음.
> T5 해당 없음: SvelteKit SSG/SPA 구조이며 서버 측 HTTP 엔드포인트 없음. `tests/**/*http*`, `tests/**/*api*` Glob 탐색 결과 0건.

### Phase 4: 수동 검증

9. - [x] **수동 검증 항목은 별도 운영 문서 기준으로 관리한다**
   - [x] 본 계획서에서는 수동 검증을 완료 조건에서 제외하고, 결과 기록 위치만 `MANUAL_TASKS.md`로 명시한다
   - [x] 수동 검증 시나리오는 최소 `단일 todo click → /todos`, `병합 todo click → /todos`, `todo history success/failed record 확인` 3개로 적는다
   - [x] memo 알림 click 회귀 없음은 todo 검증과 분리해 smoke 항목으로만 남긴다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] `data/migrations/011_notification_history_todo_contract.sql` 반영 뒤 running DB direct step이 완료됐는지 확인한다
   - [ ] T4/T5 해당 없음 여부를 이번 변경 기준으로 재판정한다 (`TypeScript/Svelte + SQL migration` 중심, Python 테스트 없음 전제 재확인)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:`)

## 작업 수 요약

- Phase 0: Worktree 준비 (5개 체크박스)
- Phase 1: 단일 todo 알림 click 라우팅 정합 (9개 체크박스)
- Phase 2: SW→메인 메시지 계약 정리 (26개 체크박스)
- Phase DB-Direct: notification_history 제약 직접 확장 (14개 체크박스)
- Phase R: 재발 경로 분석 (13개 체크박스)
- Phase 4: 수동 검증 운영 문서화 (4개 체크박스)
- Phase Z: Post-Merge Cleanup (7개 체크박스)
- 총 78개 체크박스

> fix plan 재검토 결과: `NotificationHistory` 타입/DB CHECK 제약, `HistoryCard` 채널 라벨, repo-wide `notificationclick` 탐색 범위를 보강했다. 수동 검증은 `MANUAL_TASKS.md` 운영 규칙만 유지하고 본 plan 완료 조건에서는 제외한다.
> review-plan 검토(2026-04-24): 소스코드 대조 — 단일 todo catch path의 failed payload 누락(`errorMessage` 미전달), merged 양 경로의 `errorMessage` 누락, `sentAt` 공유 방식 확인(현행 유지), T3/T4/T5 해당 없음(Glob 0건 확인), 로컬 drift 없음(38eb43a 이후 대상 코드 무변경).

---

*상태: 머지대기 | 진행률: 63/78 (81%)*
