# fix: 알림 스케줄 초기화 모달 — todo 재등록 누락 및 서버 alarm_schedules 재동기화 보강

> 작성일시: 2026-05-14
> 기준커밋: 070165c
> 대상 프로젝트: memo-alarm
> 유형: fix
> 상태: 검토대기
> 진행률: 0/34 (0%)
> 출처: /reflect에서 자동 생성
> 요약: 초기화 모달 confirm이 native/SW todo 알림을 복구하지 못하고, 서버 `alarm_schedules`는 삭제만 해서 Supabase Edge Function 발송 경로를 잃을 수 있다. 기존 사용자만 대상으로 하되, 서버 스케줄은 현재 메모 기준으로 삭제 후 재생성하고 KST timezone 계약을 명시한다.

## 문제 요약

`handleNotificationScheduleReset` (기기별 1회 알림 스케줄 초기화 모달 confirm 핸들러)은 OS 큐를 정리할 때 `rescheduleAllNotifications(memos)`를 호출한다. 이 함수 내부에서 `cancelAllNotifications()`로 **모든** native 알림(메모 + 할일)을 취소한 뒤, 메모 reminder만 재예약한다. 할일(todo) native 알림은 재예약되지 않는다.

마찬가지로 `clearAllSchedulesInServiceWorker()`로 SW 메모·할일 스케줄 전체를 비운 뒤, `registerRemindersToServiceWorker()`로 메모 SW 알림만 재등록한다. 할일 SW 알림은 재등록 경로가 없다.

결과적으로 reset 모달을 confirm한 사용자는 할일(todo) 알림이 무음으로 사라진다. 다음에 개별 할일을 수정하거나 전역 알림 설정을 바꿀 때까지 복구되지 않는다.

추가 조사 결과, 사용자가 말한 "사전 설정된 알림이 Supabase 예전 function 같은 것을 타고 검사된다"는 판단은 맞다. `gifticon-manager/supabase/functions/send-notifications/index.ts`는 매분 호출되어 `alarm_schedules`에서 현재 UTC/KST 시각과 맞는 row를 찾고, `user_devices`의 FCM token으로 발송한다. `gifticon-manager/supabase/migrations/010_fcm_pg_cron.sql`도 `send-fcm-notifications-every-minute` cron으로 해당 Edge Function을 호출하도록 관리한다.

따라서 reset 모달에서 서버 `alarm_schedules`를 단순 삭제하는 것은 오래된 서버 알림을 멈추는 효과는 있지만, 현재 메모의 정상 서버 알림까지 없애는 부작용이 있다. 서버 경로는 "삭제 후 현재 메모 기준 재생성"으로 바꿔야 하며, 재생성 row에는 `timezone = 'Asia/Seoul'`을 명시해야 한다. 현재 Edge Function은 `timezone === 'Asia/Seoul'`만 KST로 처리하고 그 외 값/null은 UTC 기준으로 검사하므로, 임의 브라우저 timezone 문자열을 넣으면 오히려 시각 drift가 남을 수 있다.

신규 가입자 제외 기준은 "앱 새 설치"가 아니라 로그인 계정의 `authStore.user.created_at`과 rollout cutoff 비교다. 앱 재설치는 localStorage의 기기별 1회 플래그를 지울 수 있으므로, 같은 기존 계정이 새로 설치한 기기에서는 다시 모달이 뜰 수 있다. 이것은 "각 기기별 1회" 요구와 충돌하지 않는다.

## 관련 파일

- `src/routes/+layout.svelte` — `handleNotificationScheduleReset` 함수 (todos 재등록 호출 누락)
- `src/lib/utils/capacitor.ts` — `rescheduleAllNotifications` (memo만 재예약)
- `src/lib/utils/todoNotifications.ts` — `rescheduleAllTodosForGlobalRemind`, `rescheduleAllTodosForGlobalAutoAlert` (전체 재스케줄 helper 존재, 활용 필요)
- `src/lib/services/alarmSchedules.ts` — `createMemoAlarm`, `syncMemoAlarms`, `deleteAllMemoAlarmsForUser` (서버 스케줄 생성/삭제 계약)
- `src/lib/stores/memos.svelte.ts` — 메모 저장/수정 시 `syncMemoAlarms` 호출 경로
- `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts` — `alarm_schedules` 검사 및 FCM 발송 Edge Function
- `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql` — 매분 Edge Function 호출 cron

## 검증 기준 비교

plan `2026-05-13_notification-schedule-reset-modal.md` 검증 기준:
> "초기화 후 현재 메모/할일 기준 알림이 재등록되어 정상 시각에만 울린다."

현재 구현은 **메모** 기준 알림만 재등록하며, **할일** 기준 알림은 재등록하지 않는다.

## 수정 방향

### Phase 0: 서버 알림 경로 재확인 및 reset 계약 수정

1. [ ] **Supabase 서버 발송 경로를 계획 근거로 고정**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `alarm_schedules` 조회 조건(`is_enabled`, UTC/KST `alarm_time`)과 `timezone === 'Asia/Seoul'` 분기 확인 결과를 주석 또는 plan evidence에 남긴다
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: `send-fcm-notifications-every-minute`가 `/functions/v1/send-notifications`를 매분 호출하는 구조를 확인한다
   - [ ] `docs/archive/2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md`: 과거 운영 조사에서 `alarm_schedules`, `user_devices`, `notification_logs`, `cron.job`가 실제 장애 분석 대상이었다는 근거를 확인한다

2. [ ] **서버 스케줄 delete-only를 delete-and-rebuild로 변경**
   - [ ] `src/lib/services/alarmSchedules.ts`: `deleteAllMemoAlarmsForUser(userId)`는 유지하되, reset 전용 `syncAllMemoAlarmsForUser(userId, memos)` helper를 추가한다
   - [ ] `src/lib/services/alarmSchedules.ts`: helper는 먼저 `deleteAllMemoAlarmsForUser(userId)`를 호출하고, 이후 활성 메모의 활성 reminder를 `createMemoAlarm`으로 다시 생성한다
   - [ ] `src/lib/services/alarmSchedules.ts`: reminder 추출은 앱의 기존 `getRemindersFromMemo` helper를 사용해 구형 `reminder`와 신규 `reminders` 배열을 동일하게 처리한다
   - [ ] `src/routes/+layout.svelte`: reset confirm에서 서버 step은 `deleteAllMemoAlarmsForUser` 직접 호출이 아니라 `syncAllMemoAlarmsForUser(authStore.user.id, memosStore.memos)` 호출로 교체한다
   - [ ] `src/routes/+layout.svelte`: 서버 재동기화 실패 시 partial failure로 남기고, "서버 스케줄까지 정상화됨"으로 오해될 toast/상태 표시를 하지 않는다

3. [ ] **서버 timezone 계약을 KST로 명시**
   - [ ] `src/lib/services/alarmSchedules.ts`: `createMemoAlarm`이 서버 row 생성 시 `timezone: 'Asia/Seoul'`을 명시하도록 수정한다
   - [ ] `src/lib/services/alarmSchedules.ts`: 브라우저의 임의 IANA timezone 문자열은 현재 Edge Function에서 KST 외에는 UTC로 처리되므로 사용하지 않는다는 주석을 남긴다
   - [ ] `src/lib/services/alarmSchedules.ts`: `metadata`에 `memo_id`와 함께 `reminder_id`를 저장해 다중 reminder row 식별성을 높인다
   - [ ] `src/lib/components/settings/dev/DevFcmStatusSection.svelte`: 개발자 FCM 상태 화면에서 reset 후 `alarm_schedules` row가 삭제-only가 아니라 현재 메모 기준으로 재생성되는지 확인 가능한지 점검한다

4. [ ] **신규 가입자/새 설치 판별 기준을 문서와 코드 주석에 맞춘다**
   - [ ] `src/routes/+layout.svelte`: 신규 가입자 제외는 `authStore.user.created_at >= SCHEDULE_RESET_ROLLOUT_CUTOFF` 기준임을 주석으로 명확히 한다
   - [ ] `src/routes/+layout.svelte`: 앱 재설치는 신규 가입 판정이 아니며, localStorage 1회 플래그가 없어진 기존 계정은 다시 대상이 될 수 있음을 plan에 남긴다
   - [ ] `src/routes/+layout.svelte`: cutoff가 날짜 문자열(`2026-05-13`)이라 같은 날짜 가입자까지 제외될 수 있는지 검토하고, 필요하면 정확한 ISO timestamp cutoff로 교체한다

### Phase 1: 할일 전체 재스케줄 helper 추가

5. [ ] **`src/lib/utils/todoNotifications.ts`에 `rescheduleAllTodoNotifications(memos: Memo[]): Promise<void>` export 추가**
   - [ ] `src/lib/utils/todoNotifications.ts` 파일 끝(line 474 이후, `rescheduleAllTodosForGlobalAutoAlert` 함수 닫기 `}` 뒤)에 새 export 함수 삽입
   - [ ] 함수 시그니처: `export async function rescheduleAllTodoNotifications(memos: Memo[]): Promise<void>`
   - [ ] 본문: `memos.filter(m => m.memoType === 'todo' && m.todoStatus === 'pending')`로 대상 목록 추출
   - [ ] `for (const todo of pendingTodos) { await scheduleTodoNotifications(todo); }` 순차 호출 (`scheduleTodoNotifications` 내부에서 조건 재검증하므로 중복 등록 없음)
   - [ ] native가 아닌 환경(웹 PWA)에서는 `scheduleTodoNotifications` 내부의 SW 등록 경로로 자동 fallback됨 (별도 처리 불필요)

### Phase 2: 초기화 orchestration에 할일 재등록 추가

6. [ ] **`src/routes/+layout.svelte`에 `rescheduleAllTodoNotifications` import 추가**
   - [ ] line 17의 기존 `capacitor` import 줄 아래에 새 import 행 삽입: `import { rescheduleAllTodoNotifications } from '$lib/utils/todoNotifications';`

7. [ ] **`src/routes/+layout.svelte` `handleNotificationScheduleReset` — step 5 삽입**
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

8. [ ] **`cancelAllNotifications` 호출처 전체 열거 — Grep으로 `src/` 전체 검색**
   - [ ] 호출처 1: `src/lib/utils/capacitor.ts:rescheduleAllNotifications` (line 203~214) — `handleNotificationScheduleReset` → `rescheduleAllNotifications` 경로. Phase 2 수정으로 todo 재등록 step 5가 뒤에 실행되므로 **방어됨**
   - [ ] 호출처 2: `src/lib/components/settings/dev/DevCapacitorBackgroundNotificationSection.svelte:clearAllScheduledNotifications` — 개발자 설정 패널의 "모든 예약 알림 취소" 버튼. 명시적 디버그 전체 삭제 용도이므로 재등록 의도가 없음. **해당 없음(방어 불필요)**

9. [ ] **방어됨/미방어 표 작성**

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
- 서버 FCM 알림은 클라이언트 기기 큐가 아니라 Supabase `alarm_schedules` row와 `send-notifications` cron/function 조합이 source of truth다. reset이 이 row를 삭제만 하면 "오래된 알림 제거"와 동시에 "정상 서버 알림 제거"가 발생한다.
- 현재 Edge Function의 timezone 처리는 일반 IANA timezone 전체 지원이 아니라 `Asia/Seoul` 특례와 UTC fallback 구조다. memo-alarm 서버 schedule은 KST 알림으로 저장하거나, 별도 Edge Function 개선 계획 없이 브라우저 timezone을 넣지 않는다.

*상태: 검토대기 | 진행률: 0/34 (0%)*
