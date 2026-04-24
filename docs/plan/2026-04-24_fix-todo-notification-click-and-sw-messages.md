# fix: todo 알림 click 라우팅 + SW 메시지 계약 정리

> 작성일시: 2026-04-24 10:40
> 기준커밋: 38eb43a
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/33 (0%)
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
- 최소 변경으로는 `notificationclick`에서 `data.type`이 `todo-` prefix면 `/todos`로 보내는 것만으로 click 회귀는 막을 수 있다.
- 기록/디버깅 정합성을 위해 `TODO_NOTIFICATION_SENT`를 `SW_MSG`에 추가하고, 메인 스레드에서 history 기록을 남기도록 한다.
- SW 번들 제약 때문에 `src/lib/constants/swMessages.ts`를 SW에서 import하는 것은 피하고, 문자열은 그대로 두되 **메인 스레드 상수와 값이 일치**하도록만 맞춘다.

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: blank 슬롯은 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `worktree 생성 또는 재개`는 `/implement` 또는 `plan-runner` owner flow 임을 적는다
   - [ ] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 단일 todo 알림 click 라우팅 정합

1. - [ ] **`notificationclick`에서 todo 알림을 `/todos`로 라우팅한다**
   - [ ] `src/service-worker.ts`: `notificationclick`에서 `data?.type === 'todo-merged'` 분기가 이미 `/todos`로 가는지 확인한다 (현상 기준선)
   - [ ] `src/service-worker.ts`: `data?.type?.startsWith('todo-')` 분기를 `data?.memoId` 분기보다 먼저 추가해, 단일 todo 알림(`todo-remind|todo-alert|todo-overdue`)도 `/todos`로 보내게 한다
   - [ ] `src/service-worker.ts`: todo 단일 알림 click 로그를 추가한다 (예: `📱 Single todo notification clicked: type=..., todoId=...`)
   - [ ] `src/service-worker.ts`: memo 알림 click 라우팅(`/?memo=...`)은 기존 동작을 유지한다
   - [ ] `src/service-worker.ts`: `externalUrl` 처리(외부 URL openWindow + AUTO_OPEN_TRIGGERED)는 memo 경로에만 적용되는지 확인하고, todo 경로는 현행 유지(또는 명시적으로 제외) 중 하나로 결정해 문서에 남긴다

### Phase 2: SW→메인 메시지 계약 정리

2. - [ ] **`TODO_NOTIFICATION_SENT`를 메인 스레드에서 소비해 히스토리 기록을 남긴다**
   - [ ] `src/lib/constants/swMessages.ts`: `TODO_NOTIFICATION_SENT` 상수를 추가한다
   - [ ] `src/lib/stores/notifications.svelte.ts`: SW message listener에서 `event.data.type === SW_MSG.TODO_NOTIFICATION_SENT` 분기를 추가한다
   - [ ] `src/lib/stores/notifications.svelte.ts`: `memosStore.getById(event.data.memoId)`로 title을 조회해 `memoTitle`에 채운다 (없으면 `'(unknown todo)'` fallback)
   - [ ] `src/lib/stores/notifications.svelte.ts`: `notificationHistoryStore.addRecord` 호출 시 `reminderType=event.data.notificationType`, `channel='sw-todo'`, `status/sentAt`를 매핑한다
   - [ ] `src/service-worker.ts`: `TODO_NOTIFICATION_SENT` payload에 `errorMessage?: string`를 포함할지 결정한다 (포함한다면 merged/단일 catch 모두에서 채운다)
   - [ ] `src/service-worker.ts`: 단일 todo 알림 실패 케이스에서도 `TODO_NOTIFICATION_SENT` failed를 보내도록 catch 블록을 보강한다 (현재는 로그만 남음)

### Phase R: 재발 경로 분석 (fix: plan 필수)

R1. - [ ] **같은 패턴이 다른 경로에도 없는지 확인한다**
   - [ ] 프로젝트 전체: `rg -n \"TODO_NOTIFICATION_SENT\" src`로 SW 발송부/메인 소비부가 1:1로 정합해졌는지 확인한다
   - [ ] 프로젝트 전체: `rg -n \"notificationclick\" src`로 click handler가 SW 외에 중복 구현되지 않았는지 확인한다
   - [ ] 프로젝트 전체: `rg -n \"openWindow\\(\" src`로 click 시 openWindow 호출이 의도한 위치에만 존재하는지 확인한다
   - [ ] `docs/plan/2026-04-24_fix-todo-notification-click-and-sw-messages.md`: 위 grep 결과를 근거로 "재발 경로 표"를 추가한다 (방어됨/대상 아님/별도 plan 필요)

### Phase 4: 수동 검증

4. - [ ] **브라우저/실기기에서 알림 클릭 동작을 확인한다** (결과는 `MANUAL_TASKS.md`에 기록)
   - [ ] 단일 todo 알림 클릭 → `/todos` 이동 확인
   - [ ] 병합 todo 알림 클릭 → `/todos` 이동 확인
   - [ ] memo 알림 click 회귀 없음 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] T4/T5 해당 없음: Python 변경 없음, `tests/` 디렉토리 없음
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:`)

---

*상태: 초안 | 진행률: 0/33 (0%)*
