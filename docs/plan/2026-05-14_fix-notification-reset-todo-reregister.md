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
   - [ ] `src/lib/utils/todoNotifications.ts` 파일 끝(line 474 이후, `rescheduleAllTodosForGlobalAutoAlert` 함수 닫기 `}` 뒤)에 새 export 함수 삽입
   - [ ] 함수 시그니처: `export async function rescheduleAllTodoNotifications(memos: Memo[]): Promise<void>`
   - [ ] 본문: `memos.filter(m => m.memoType === 'todo' && m.todoStatus === 'pending')`로 대상 목록 추출
   - [ ] `for (const todo of pendingTodos) { await scheduleTodoNotifications(todo); }` 순차 호출 (`scheduleTodoNotifications` 내부에서 조건 재검증하므로 중복 등록 없음)
   - [ ] native가 아닌 환경(웹 PWA)에서는 `scheduleTodoNotifications` 내부의 SW 등록 경로로 자동 fallback됨 (별도 처리 불필요)

### Phase 2: 초기화 orchestration에 할일 재등록 추가

2. - [ ] **`src/routes/+layout.svelte`에 `rescheduleAllTodoNotifications` import 추가**
   - [ ] line 17의 기존 `capacitor` import 줄 아래에 새 import 행 삽입: `import { rescheduleAllTodoNotifications } from '$lib/utils/todoNotifications';`

3. - [ ] **`src/routes/+layout.svelte` `handleNotificationScheduleReset` — step 5 삽입**
   - [ ] `handleNotificationScheduleReset` 함수(line 163~201)에서 step 4 try/catch 블록(`results.push('sw-resync')`) 닫기 `}` 직후, `if (results.length > 0)` 블록 이전에 step 5 삽입:
     ```typescript
     // 5. 할일 native/SW 알림 재등록
     try {
         await rescheduleAllTodoNotifications(memosStore.memos);
     } catch {
         results.push('todo-notify');
     }
     ```
   - [ ] step 5는 await이므로 `handleNotificationScheduleReset` 반환 전에 완료됨 (toast 표시 전 await 계약 충족)

### Phase R: 재발 경로 분석

4. - [ ] **`cancelAllNotifications` 호출처 전체 열거 — Grep으로 `src/` 전체 검색**
   - [ ] 호출처 1: `src/lib/utils/capacitor.ts:rescheduleAllNotifications` (line 203~214) — `handleNotificationScheduleReset` → `rescheduleAllNotifications` 경로. Phase 2 수정으로 todo 재등록 step 5가 뒤에 실행되므로 **방어됨**
   - [ ] 호출처 2: `src/lib/components/settings/dev/DevCapacitorBackgroundNotificationSection.svelte:clearAllScheduledNotifications` — 개발자 설정 패널의 "모든 예약 알림 취소" 버튼. 명시적 디버그 전체 삭제 용도이므로 재등록 의도가 없음. **해당 없음(방어 불필요)**

5. - [ ] **방어됨/미방어 표 작성**

   | 경로 | 방어여부 | 근거 |
   |------|---------|------|
   | `handleNotificationScheduleReset` → `rescheduleAllNotifications` → `cancelAllNotifications` | 방어됨 | Phase 2 step 5 추가로 todo 재등록 실행 |
   | `DevCapacitorBackgroundNotificationSection.clearAllScheduledNotifications` → `cancelAllNotifications` | 해당 없음 | 개발자 디버그 패널 전체 취소 버튼 — 재등록 의도 없음 |

### Phase T1: TC 작성

> T1/T2 해당 없음: memo-alarm은 테스트 인프라가 없음 (tests/ 디렉터리 및 .test.ts 파일 없음 — Glob 확인 완료)

### Phase T2: TC 검증

> T1/T2 해당 없음: memo-alarm은 테스트 인프라가 없음

### Phase T3: 재현/통합 TC

> T3 해당 없음: memo-alarm은 테스트 인프라가 없음. 수동 검증 경로 — native 앱에서 할일 알림 설정 후 초기화 모달 confirm → 할일 알림이 재등록되는지 설정 패널 pending 목록으로 확인

---

## 기술적 고려사항

- `Memo` 타입의 todo 판별 필드는 `memoType: 'todo'`이고 상태는 `todoStatus: 'pending'`이다 (`src/lib/types/memo.ts` 확인 완료).
- `scheduleTodoNotifications`는 todo별 기존 알림을 먼저 취소(`REMOVE_TODO_NOTIFICATIONS`)한 뒤 재등록하므로, 중복 등록 위험은 없다.
- todo가 많으면 순차 호출 시 지연이 생길 수 있다. 완료 후 toast 표시 전에 `await` 처리가 필요하다.
- `rescheduleAllTodosForGlobalRemind`/`rescheduleAllTodosForGlobalAutoAlert`는 각각 `useGlobalRemind`/`useGlobalAutoAlert` flag가 있는 todo만 필터링하므로 reset 시 전체 재등록 용도로 부적합하다. 새 `rescheduleAllTodoNotifications`는 flag 무관하게 모든 pending todo를 대상으로 한다.

*상태: 검토대기 | 진행률: 0/0 (0%)*
