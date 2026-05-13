# 기기별 알림 스케줄 초기화 모달

> 작성일시: 2026-05-13 21:44
> 기준커밋: 1ad39da
> 대상 프로젝트: memo-alarm
> 상태: 구현중
> branch: impl/notification-schedule-reset-modal
> worktree: .worktrees/notification-schedule-reset-modal
> worktree-owner: .worktrees/notification-schedule-reset-modal
> <!-- worktree-owner: 단일 경로 또는 쉼표 구분 경로 목록 허용. 첫 항목=primary(생성 소유), 나머지=attached(편승). attach 모드: /implement --attach-worktree <primary-path> -->
> 진행률: 0/56 (0%)
> 요약: 기존 사용자의 각 기기에 남아 있는 과거 예약 알림을 다음 접속 시 1회만 정리한다. 신규 가입자는 대상에서 제외하고, 메모 데이터는 삭제하지 않으며 OS/SW/서버 알림 스케줄만 비운 뒤 현재 메모 기준으로 재동기화한다.

---

## 개요

최근 알림 개선 이후 기기마다 서로 다른 시각의 알림이 발생하는 문제는 메모 데이터 자체보다 각 기기에 남아 있는 과거 예약 큐가 원인일 가능성이 높다. 현재 앱은 Capacitor 로컬 알림, 웹 Service Worker 스케줄, Supabase `alarm_schedules` 기반 서버 알림이 함께 존재하므로, 사용자가 다음 접속 시 명시적으로 "알림 스케줄 초기화"를 실행할 수 있는 1회성 모달을 제공한다.

이 계획은 메모/할일/설정 데이터를 삭제하지 않는다. 목표는 기존 사용자에게만 기기별 1회 모달을 표시하고, 확인 시 해당 기기의 OS pending notification과 브라우저 Service Worker 스케줄, 로그인 계정의 서버 알림 스케줄을 정리한 다음 현재 앱 상태 기준으로 알림을 다시 등록하는 것이다.

## 승인된 요구사항

- 다음 접속 시 알림 초기화 모달을 표시한다.
- 각 기기별 1회만 표시한다.
- 새로 등록하는 사용자는 모달 대상에서 제외한다.
- 초기화는 알림 스케줄만 대상으로 하며 메모 데이터는 삭제하지 않는다.

## 수행하지 않을 작업

- `ma_memos` 메모/할일 데이터를 삭제하지 않는다.
- 사용자의 알림 설정값 자체를 비활성화하지 않는다.
- 신규 가입자에게 초기화 모달을 노출하지 않는다.
- 단순히 개발자 페이지의 수동 초기화 버튼만 추가하고 끝내지 않는다.

## 현재 코드 근거

- `src/routes/+layout.svelte`는 앱 시작 시 `authStore`, `settingsStore`, `memosStore`, `notificationStore`를 초기화하고 `notificationStore.registerRemindersToServiceWorker()`를 호출한다. 전역 1회성 모달을 붙일 위치는 layout이 적합하다.
- `src/lib/utils/capacitor.ts`에는 `cancelAllNotifications()`가 이미 있지만 일반 사용자 플로우에서는 호출되지 않는다.
- `src/service-worker.ts`는 `scheduledReminders`와 `todoNotifications`를 메모리 배열로 유지한다. 현재 `REGISTER_MEMO_REMINDERS`는 전체 교체가 가능하지만, todo 스케줄 전체 비우기는 전용 메시지가 없다.
- `src/lib/services/alarmSchedules.ts`는 메모별 `deleteMemoAlarms(memoId)`만 제공한다. 사용자 계정 전체의 `memo-alarm` 스케줄을 비우는 함수가 필요하다.
- `src/lib/utils/capacitor.ts`의 메모 로컬 알림 스케줄은 구형 `memo.reminder` 중심이며, `reminders` 배열과 다중 알림 ID 충돌까지 함께 점검해야 한다.

## 기술적 고려사항

- 기기별 1회 기준은 서버가 아니라 `localStorage`에 저장한다. 같은 계정이라도 기기가 다르면 각 기기에서 한 번씩 모달이 뜨는 것이 요구사항과 맞다.
- 신규 사용자 제외 기준은 `authStore.user.created_at`과 rollout cutoff를 비교한다. cutoff 이후 생성된 계정은 모달을 표시하지 않고 플래그만 기록한다.
- 로그인하지 않은 로컬 사용자에게는 서버 스케줄 정리가 불가능하다. 이 경우에도 로컬 메모가 있는 기존 기기라면 OS/SW 초기화만 수행할 수 있게 하되, 신규 가입자 제외 판단은 로그인 계정에만 적용한다.
- 모달 닫기와 초기화 완료 모두 "이 기기에서 1회 처리됨"으로 기록한다. 사용자가 건너뛰기를 선택해도 같은 모달을 반복 노출하지 않는다.
- 초기화 실행 중 실패한 채널이 있어도 가능한 채널은 계속 처리하고, 결과 메시지에 실패 채널을 표시한다.
- 초기화 직후에는 현재 `memosStore.memos`와 설정 기준으로 SW, Capacitor, 서버 스케줄을 재등록한다.

## 상태 머신 6축 TC matrix

| 축 | TC/evidence 계획 |
|----|------------------|
| `creator` | layout 초기화 이후 기존 사용자 조건을 만족할 때만 reset prompt state가 생성되는지 검증한다 |
| `preserver` | 모달 건너뛰기/성공/부분 실패 후 localStorage 1회 플래그가 보존되어 재노출되지 않는지 검증한다 |
| `overwrite-block` | 신규 가입자 제외 플래그가 늦은 auth/memo 초기화에 의해 다시 표시 상태로 덮이지 않는지 검증한다 |
| `override` | 사용자의 명시적 "초기화하기" 액션만 실제 스케줄 삭제를 수행하고, 단순 표시 조건 평가로는 삭제하지 않음을 검증한다 |
| `display` | 초기화 중/성공/부분 실패 상태가 모달 UI와 toast에 일관되게 표시되는지 확인한다 |
| `late-writer ordering` | 초기 load의 SW 재등록과 초기화 clear/resync 순서가 뒤집혀 stale 스케줄이 남지 않는지 검증한다 |

---

## TODO

### Phase 0: Worktree 준비

0. [ ] **worktree 준비 상태를 문서에 고정** - `/implement` 진입 게이트
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 초기화 실행 API 정리

1. [ ] **Service Worker 스케줄 전체 초기화 메시지를 추가한다** - 메모/할일 SW 스케줄을 한 번에 비우는 계약
   - [ ] `src/lib/constants/swMessages.ts`: `CLEAR_ALL_NOTIFICATION_SCHEDULES` 메시지 상수를 추가한다
   - [ ] `src/service-worker.ts`: 새 메시지를 수신하면 `scheduledReminders = []`, `todoNotifications = []`로 초기화한다
   - [ ] `src/service-worker.ts`: 초기화 후 `GET_SCHEDULED_REMINDERS`에서 빈 배열과 interval 상태를 확인할 수 있게 로그를 남긴다

2. [ ] **notificationStore에 초기화/재동기화 helper를 추가한다** - layout과 모달이 직접 SW 세부 구현을 알지 않게 한다
   - [ ] `src/lib/stores/notifications.svelte.ts`: `clearAllSchedulesInServiceWorker()`를 추가해 새 SW 메시지를 전송한다
   - [ ] `src/lib/stores/notifications.svelte.ts`: 초기화 시 `lastNotifiedMap`과 `snoozedReminders`를 비우는 내부 helper를 분리한다
   - [ ] `src/lib/stores/notifications.svelte.ts`: 초기화 후 `registerRemindersToServiceWorker()`를 다시 호출할 수 있는 public flow를 노출한다

3. [ ] **서버 alarm_schedules 전체 정리 함수를 추가한다** - 로그인 계정의 memo-alarm 스케줄만 삭제
   - [ ] `src/lib/services/alarmSchedules.ts`: `deleteAllMemoAlarmsForUser(userId)` 함수를 추가한다
   - [ ] `src/lib/services/alarmSchedules.ts`: 삭제 조건은 `user_id`, `app_name = 'memo-alarm'`, `alarm_type = 'memo_reminder'`로 제한한다
   - [ ] `src/lib/services/alarmSchedules.ts`: Supabase 미설정 또는 삭제 실패 시 호출자에게 error를 전달한다

### Phase 2: Capacitor 로컬 알림 재정렬

4. [ ] **메모 로컬 알림 스케줄이 reminders 배열을 지원하게 한다** - 초기화 후 재등록 정확도 확보
   - [ ] `src/lib/utils/capacitor.ts`: 메모에서 `reminders` 배열을 우선 읽고 구형 `reminder`는 fallback으로 처리하는 helper를 추가한다
   - [ ] `src/lib/utils/capacitor.ts`: `scheduleNotification(memo)`가 활성 reminder 전체를 순회해 예약하도록 수정한다
   - [ ] `src/lib/utils/capacitor.ts`: notification id 생성 입력을 `memoId + reminderId + day/date`로 확장해 같은 메모의 다중 알림 충돌을 막는다
   - [ ] `src/lib/utils/capacitor.ts`: 일회성 reminder(`type === 'once'`)도 native schedule 대상에 포함하되 과거 시각은 예약하지 않는다

5. [ ] **현재 메모 기준 전체 native 재스케줄 helper를 만든다** - 초기화 모달이 OS 큐를 비운 뒤 재등록 가능하게 한다
   - [ ] `src/lib/utils/capacitor.ts`: `rescheduleAllNotifications(memos)`를 추가해 `cancelAllNotifications()` 후 활성 알림을 가진 메모를 재예약한다
   - [ ] `src/lib/utils/todoNotifications.ts`: todo native 알림 재스케줄 경로가 `scheduleTodoNotifications(todo)`로 재사용 가능한지 확인하고 필요 시 helper를 export한다
   - [ ] `src/lib/utils/capacitor.ts`: native가 아닌 환경에서는 no-op으로 안전하게 반환한다

### Phase 3: 1회성 초기화 모달 구현

6. [ ] **초기화 대상 판별 로직을 layout에 추가한다** - 기존 사용자만, 기기별 1회
   - [ ] `src/routes/+layout.svelte`: localStorage key를 `memo-alarm:notification-schedule-reset:v1:{userId 또는 local}` 형태로 정의한다
   - [ ] `src/routes/+layout.svelte`: `authStore.user.created_at`이 rollout cutoff 이후면 신규 사용자로 판단하고 모달을 표시하지 않는다
   - [ ] `src/routes/+layout.svelte`: 기존 사용자이며 해당 key가 없으면 현재 메모 수와 무관하게 모달을 표시한다
   - [ ] `src/routes/+layout.svelte`: auth/memos 초기화 완료 후 한 번만 판별되도록 guard state를 둔다

7. [ ] **사용자용 모달 컴포넌트를 추가한다** - 알림 스케줄만 정리한다는 범위를 명확히 표시
   - [ ] `src/lib/components/notifications/NotificationScheduleResetModal.svelte`: `Modal`과 `Button`을 사용해 초기화 안내 UI를 만든다
   - [ ] `src/lib/components/notifications/NotificationScheduleResetModal.svelte`: "초기화하기"와 "건너뛰기" 액션을 제공하고 둘 다 1회 플래그를 기록하게 한다
   - [ ] `src/lib/components/notifications/NotificationScheduleResetModal.svelte`: 실행 중에는 버튼을 disable하고 진행 상태를 표시한다
   - [ ] `src/lib/components/notifications/NotificationScheduleResetModal.svelte`: 메모 데이터는 삭제되지 않는다는 문구를 본문에 포함한다

8. [ ] **초기화 실행 orchestration을 layout에 연결한다** - OS/SW/서버를 순서대로 정리 후 재동기화
   - [ ] `src/routes/+layout.svelte`: 모달 confirm 시 `cancelAllNotifications()`를 호출한다
   - [ ] `src/routes/+layout.svelte`: `notificationStore.clearAllSchedulesInServiceWorker()`로 SW 메모/할일 스케줄을 비운다
   - [ ] `src/routes/+layout.svelte`: 로그인 상태면 `deleteAllMemoAlarmsForUser(authStore.user.id)`를 호출한다
   - [ ] `src/routes/+layout.svelte`: 정리 후 현재 메모 기준으로 SW, native, 서버 스케줄을 재등록한다
   - [ ] `src/routes/+layout.svelte`: 성공/부분 실패 결과를 toast 또는 모달 상태로 표시한다

### Phase 4: 회귀 방지 및 검증

9. [ ] **초기화 대상/비대상 시나리오를 수동 검증 가능하게 정리한다** - 실기기 재현 경로 확보
   - [ ] `MANUAL_TASKS.md`: 기존 사용자 + key 없음 + 알림 있음일 때 모달 표시 절차를 추가한다
   - [ ] `MANUAL_TASKS.md`: 신규 가입자 또는 cutoff 이후 user는 모달 미표시 절차를 추가한다
   - [ ] `MANUAL_TASKS.md`: 같은 기기에서 건너뛰기/초기화 후 재접속해도 모달이 재표시되지 않는 절차를 추가한다
   - [ ] `MANUAL_TASKS.md`: Android native pending notification이 초기화 전후로 줄어드는 확인 절차를 추가한다

10. [ ] **웹앱 빌드와 타입 검증을 실행한다** - Svelte/TypeScript 회귀 확인
   - [ ] `package.json`: 기존 scripts를 확인해 적절한 `npm run check` 또는 `npm run build` 명령을 확정한다
   - [ ] `src/routes/+layout.svelte`: Svelte 5 rune state와 import 경로 타입 오류가 없는지 `npm run check`로 확인한다
   - [ ] `src/lib/utils/capacitor.ts`: Capacitor notification schedule 타입이 통과하는지 `npm run check`로 확인한다
   - [ ] `src/service-worker.ts`: SW message 추가 후 빌드가 통과하는지 `npm run build`로 확인한다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. [ ] **post-merge 정리 확인** - `/merge-test` owner
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: `main merge 시도`를 owner step으로 유지한다
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: `root dirty stash/apply (if needed)`를 owner step으로 유지한다
   - [ ] `docs/plan/2026-05-13_notification-schedule-reset-modal.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 유지한다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

## 검증 기준

- 기존 사용자에게만 초기화 모달이 다음 접속 시 1회 표시된다.
- 신규 가입자에게는 초기화 모달이 표시되지 않는다.
- 초기화 확인 후 Capacitor pending notification, SW memo/todo schedules, 서버 `alarm_schedules`가 정리된다.
- 초기화 후 현재 메모/할일 기준 알림이 재등록되어 정상 시각에만 울린다.
- 메모/할일 데이터와 사용자 알림 설정값은 삭제되거나 비활성화되지 않는다.
- `npm run check`와 `npm run build`가 통과한다.

---

*상태: 초안 | 진행률: 0/56 (0%)*
