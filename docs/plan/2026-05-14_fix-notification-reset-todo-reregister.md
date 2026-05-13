# fix: 알림 스케줄 초기화 모달 — todo 알림 재등록 누락

> 작성일시: 2026-05-14
> 기준커밋: 070165c
> 대상 프로젝트: memo-alarm
> 유형: fix
> 상태: 검토대기
> 진행률: 0/0 (0%)
> 출처: /reflect에서 자동 생성

## 문제 요약

`handleNotificationScheduleReset` (기기별 1회 알림 스케줄 초기화 모달 confirm 핸들러)은 OS 큐를 정리할 때 `rescheduleAllNotifications(memos)`를 호출한다. 이 함수 내부에서 `cancelAllNotifications()`로 **모든** native 알림(메모 + 할일)을 취소한 뒤, 메모 reminder만 재예약한다. 할일(todo) native 알림은 재예약되지 않는다.

마찬가지로 `clearAllSchedulesInServiceWorker()`로 SW 메모·할일 스케줄 전체를 비운 뒤, `registerRemindersToServiceWorker()`로 메모 SW 알림만 재등록한다. 할일 SW 알림은 재등록 경로가 없다.

결과적으로 reset 모달을 confirm한 사용자는 할일(todo) 알림이 무음으로 사라진다. 다음에 개별 할일을 수정하거나 전역 알림 설정을 바꿀 때까지 복구되지 않는다.

## 관련 파일

- `src/routes/+layout.svelte` — `handleNotificationScheduleReset` 함수 (todos 재등록 호출 누락)
- `src/lib/utils/capacitor.ts` — `rescheduleAllNotifications` (memo만 재예약)
- `src/lib/utils/todoNotifications.ts` — `rescheduleAllTodosForGlobalRemind`, `rescheduleAllTodosForGlobalAutoAlert` (전체 재스케줄 helper 존재, 활용 필요)

## 검증 기준 비교

plan `2026-05-13_notification-schedule-reset-modal.md` 검증 기준:
> "초기화 후 현재 메모/할일 기준 알림이 재등록되어 정상 시각에만 울린다."

현재 구현은 **메모** 기준 알림만 재등록하며, **할일** 기준 알림은 재등록하지 않는다.

## 수정 방향

### Phase 1: 할일 전체 재스케줄 helper 추가

1. - [ ] **`src/lib/utils/todoNotifications.ts`에 `rescheduleAllTodoNotifications(memos: Memo[]): Promise<void>` export 추가**
   - [ ] `memos` 배열에서 todo type 메모만 필터링한다 (`memo.type === 'todo'` 또는 todo 판별 조건 확인)
   - [ ] 각 todo에 대해 `scheduleTodoNotifications(todo)`를 순차 호출한다
   - [ ] native가 아닌 환경에서는 SW-only 경로로 fallback한다

### Phase 2: 초기화 orchestration에 할일 재등록 추가

2. - [ ] **`src/routes/+layout.svelte` `handleNotificationScheduleReset` — 할일 재등록 step 추가**
   - [ ] step 4(SW 재동기화) 이후에 `rescheduleAllTodoNotifications(memosStore.memos)`를 호출하는 step 5를 추가한다
   - [ ] 실패 시 `results.push('todo-notify')`로 partial failure 목록에 포함한다

### Phase R: 재발 경로 분석

3. - [ ] **`rescheduleAllNotifications` 내 `cancelAllNotifications()` 호출이 todo 알림도 지우는 모든 경로 열거**
   - [ ] Grep으로 `cancelAllNotifications` 호출처 전체 확인
   - [ ] 각 호출 경로에서 todo 알림 복구가 필요한지 판정 (방어됨/미방어 표 작성)
   - [ ] 미방어 경로가 있으면 해당 경로에도 todo 재등록 코드 추가

### Phase T1: TC 작성

4. - [ ] `test_rescheduleAllTodoNotifications_filters_todo_memos()` — R: todo type만 필터링하는지
5. - [ ] `test_rescheduleAllTodoNotifications_empty_memos()` — B: 빈 배열 입력 시 에러 없이 반환

### Phase T2: TC 검증

6. - [ ] 위 TC 실행 및 passed 확인 (테스트 인프라가 없으면 `> T1/T2 해당 없음: 테스트 인프라 미구비` 처리)

### Phase T3: 재현/통합 TC

7. - [ ] `rescheduleAllNotifications` 호출 후 todo 알림이 실제로 재등록되는지 통합 경로 확인

---

## 기술적 고려사항

- `todo` 판별 조건을 `memo.type === 'todo'`로 쓸 수 있는지, 별도 필드가 있는지 실제 `Memo` 타입을 Read로 확인한다.
- `scheduleTodoNotifications`는 todo별 기존 알림을 먼저 취소(`REMOVE_TODO_NOTIFICATIONS`)한 뒤 재등록하므로, 중복 등록 위험은 없다.
- todo가 많으면 순차 호출 시 지연이 생길 수 있다. 완료 후 toast 표시 전에 `await` 처리가 필요하다.

*상태: 검토대기 | 진행률: 0/0 (0%)*
