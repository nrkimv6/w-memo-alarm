# fix: Supabase 등록 알람 정리 및 deprecated 알림 경로 제거

> 작성일시: 2026-05-14
> 기준커밋: 070165c
> 대상 프로젝트: memo-alarm
> 유형: fix
> 상태: 검토대기
> 진행률: 0/76 (0%)
> 출처: /reflect에서 자동 생성
> 요약: 운영 Supabase에 이미 등록된 `alarm_schedules`를 먼저 조사·정리하고, deprecated/legacy 알림 생성·발송 경로를 제거한다. reset 모달은 그 정리의 사용자 단말 보조 수단이며, 서버 스케줄은 현재 메모 기준으로 재생성하고 KST timezone 계약을 명시한다.

## 문제 요약

`handleNotificationScheduleReset` (기기별 1회 알림 스케줄 초기화 모달 confirm 핸들러)은 OS 큐를 정리할 때 `rescheduleAllNotifications(memos)`를 호출한다. 이 함수 내부에서 `cancelAllNotifications()`로 **모든** native 알림(메모 + 할일)을 취소한 뒤, 메모 reminder만 재예약한다. 할일(todo) native 알림은 재예약되지 않는다.

마찬가지로 `clearAllSchedulesInServiceWorker()`로 SW 메모·할일 스케줄 전체를 비운 뒤, `registerRemindersToServiceWorker()`로 메모 SW 알림만 재등록한다. 할일 SW 알림은 재등록 경로가 없다.

결과적으로 reset 모달을 confirm한 사용자는 할일(todo) 알림이 무음으로 사라진다. 다음에 개별 할일을 수정하거나 전역 알림 설정을 바꿀 때까지 복구되지 않는다.

추가 조사 결과, 사용자가 말한 "사전 설정된 알림이 Supabase 예전 function 같은 것을 타고 검사된다"는 판단은 맞다. `gifticon-manager/supabase/functions/send-notifications/index.ts`는 매분 호출되어 `alarm_schedules`에서 현재 UTC/KST 시각과 맞는 row를 찾고, `user_devices`의 FCM token으로 발송한다. `gifticon-manager/supabase/migrations/010_fcm_pg_cron.sql`도 `send-fcm-notifications-every-minute` cron으로 해당 Edge Function을 호출하도록 관리한다.

따라서 핵심 작업은 앱 단말에서 reset 모달을 띄우는 것만이 아니다. 운영 Supabase에 이미 등록된 알람 리스트를 먼저 inventory로 뽑고, 현재 memo-alarm 스키마/메모 상태와 매칭되지 않는 stale row, timezone이 비어 있거나 UTC fallback으로 처리되는 row, 구형 metadata를 가진 row, 중복 cron/legacy function이 만든 row를 정리해야 한다. reset 모달에서 서버 `alarm_schedules`를 단순 삭제하는 것은 오래된 서버 알림을 멈추는 효과는 있지만, 현재 메모의 정상 서버 알림까지 없애는 부작용이 있다. 서버 경로는 "운영 DB 정리 + deprecated 경로 제거 + 현재 메모 기준 재생성"으로 바꿔야 하며, 재생성 row에는 `timezone = 'Asia/Seoul'`을 명시해야 한다. 현재 Edge Function은 `timezone === 'Asia/Seoul'`만 KST로 처리하고 그 외 값/null은 UTC 기준으로 검사하므로, 임의 브라우저 timezone 문자열을 넣으면 오히려 시각 drift가 남을 수 있다.

신규 가입자 제외 기준은 "앱 새 설치"가 아니라 로그인 계정의 `authStore.user.created_at`과 rollout cutoff 비교다. 앱 재설치는 localStorage의 기기별 1회 플래그를 지울 수 있으므로, 같은 기존 계정이 새로 설치한 기기에서는 다시 모달이 뜰 수 있다. 이것은 "각 기기별 1회" 요구와 충돌하지 않는다.

## 관련 파일

- `src/routes/+layout.svelte` — `handleNotificationScheduleReset` 함수 (todos 재등록 호출 누락)
- `src/lib/utils/capacitor.ts` — `rescheduleAllNotifications` (memo만 재예약)
- `src/lib/utils/todoNotifications.ts` — `rescheduleAllTodosForGlobalRemind`, `rescheduleAllTodosForGlobalAutoAlert` (전체 재스케줄 helper 존재, 활용 필요)
- `src/lib/services/alarmSchedules.ts` — `createMemoAlarm`, `syncMemoAlarms`, `deleteAllMemoAlarmsForUser` (서버 스케줄 생성/삭제 계약)
- `src/lib/stores/memos.svelte.ts` — 메모 저장/수정 시 `syncMemoAlarms` 호출 경로
- `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts` — `alarm_schedules` 검사 및 FCM 발송 Edge Function
- `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql` — 매분 Edge Function 호출 cron
- `D:\work\project\tools\gifticon-manager\supabase\migrations\013_fix_duplicate_notification_crons.sql` — 중복/legacy cron 정리 여부 확인 대상
- Supabase 운영 DB `alarm_schedules` — 기존 등록 알람 inventory와 정리 대상
- Supabase 운영 DB `cron.job` — canonical/legacy 발송 job 판정 대상
- Supabase 운영 DB `notification_logs` — 정리 전후 발송 결과 검증 대상

## 검증 기준 비교

plan `2026-05-13_notification-schedule-reset-modal.md` 검증 기준:
> "초기화 후 현재 메모/할일 기준 알림이 재등록되어 정상 시각에만 울린다."

현재 구현은 **메모** 기준 알림만 재등록하며, **할일** 기준 알림은 재등록하지 않는다.

## 정리 대상 정의

이 계획에서 "deprecated 방법"은 Supabase 서버 알림 전체를 뜻하지 않는다. 현재 canonical 서버 경로는 `alarm_schedules` + `send-notifications` Edge Function + 단일 pg_cron + FCM이다. 제거/정리 대상은 다음이다.

- `alarm_schedules.timezone`이 비어 있거나 `Asia/Seoul` 계약과 맞지 않아 UTC fallback으로 검사되는 기존 row
- `metadata.memo_id`가 없거나 현재 메모 데이터와 매칭되지 않는 memo-alarm row
- 현재 앱의 다중 reminder 계약과 맞지 않는 구형 metadata row(`reminder_id` 부재 등)
- 동일 사용자/메모/reminder/time 조합의 중복 row
- `app_name = 'memo-alarm'`, `alarm_type = 'memo_reminder'` 범위 밖에서 memo-alarm 알림처럼 동작하는 legacy row
- `cron.job`에 남아 있는 `send-notifications-every-minute`, `send-push-notifications-*` 등 canonical이 아닌 발송 job
- 앱 코드에서 reset 시 서버 스케줄을 delete-only로 다루거나 timezone 없이 생성하는 경로

## 수정 방향

### Phase A: 운영 Supabase alarm_schedules inventory 및 dry-run

1. [ ] **운영 DB 등록 알람 현황을 read-only로 수집**
   - [ ] Supabase SQL editor 또는 운영 read-only 경로에서 `alarm_schedules`의 `app_name`, `alarm_type`, `timezone`, `is_enabled`별 count를 조회한다
   - [ ] `app_name = 'memo-alarm'` and `alarm_type = 'memo_reminder'` row의 `user_id`, `alarm_time`, `timezone`, `days_of_week`, `target_date`, `metadata` 샘플을 추출한다
   - [ ] `metadata->>'memo_id'` 부재 row와 `timezone IS NULL OR timezone <> 'Asia/Seoul'` row 수를 별도 집계한다
   - [ ] 동일 `(user_id, metadata->>'memo_id', metadata->>'reminder_id', alarm_time, target_date, days_of_week)` 후보 중복 row를 집계한다
   - [ ] 결과를 계획서 또는 작업 로그에 "삭제 후보가 아니라 inventory"로 먼저 남긴다

2. [ ] **deprecated/stale row 판정 기준을 SQL dry-run으로 고정**
   - [ ] `alarm_schedules`: memo-alarm 범위 밖 row는 삭제 대상에서 제외한다
   - [ ] `alarm_schedules`: `metadata.memo_id`가 없는 memo-alarm row는 stale 후보로 분류하되 즉시 삭제하지 않고 샘플 확인 대상으로 둔다
   - [ ] `alarm_schedules`: 현재 메모 테이블과 join 가능한 경우, 존재하지 않는 memo_id row를 stale 후보로 분류한다
   - [ ] `alarm_schedules`: timezone null/비KST row는 삭제 또는 KST 재생성 후보로 분류한다
   - [ ] dry-run SELECT가 실제 DELETE/UPDATE 대상 row id를 모두 출력하게 만들고, row count가 예상 범위를 벗어나면 중단한다고 적는다

3. [ ] **백업 및 rollback 절차를 먼저 작성**
   - [ ] `alarm_schedules` 정리 전 대상 row를 JSON/CSV export 또는 backup table로 보존하는 절차를 작성한다
   - [ ] backup에는 최소 `id`, `user_id`, `app_name`, `alarm_type`, `alarm_time`, `timezone`, `days_of_week`, `target_date`, `metadata`, `is_enabled`, `created_at`, `updated_at`를 포함한다
   - [ ] rollback은 backup row를 다시 insert/upsert하는 방식으로 작성하고, canonical 재생성 후에는 중복 insert를 막는 조건을 둔다

### Phase B: deprecated 서버 발송 경로 및 legacy cron 제거

4. [ ] **cron.job canonical/legacy 상태를 정리**
   - [ ] 운영 DB `cron.job`에서 `send-fcm-notifications-every-minute`, `send-notifications-every-minute`, `send-push-notifications-every-minute`, `send-push-notifications-hourly` 존재 여부와 active 상태를 조회한다
   - [ ] canonical job은 `send-fcm-notifications-every-minute` 하나로 고정하고, 나머지는 deprecated 제거 대상으로 분류한다
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`과 `013_fix_duplicate_notification_crons.sql`이 운영 직접 실행 절차와 일치하는지 확인한다
   - [ ] legacy cron 제거 SQL은 `SELECT` 검증 → `cron.unschedule` → 재조회 순서로 작성한다

5. [ ] **legacy Edge Function/발송 코드 참조를 전수 조사**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions`: `send-push`, `send-notifications`, `FIREBASE_SERVICE_ACCOUNT`, `alarm_schedules` grep 결과를 표로 남긴다
   - [ ] memo-alarm 앱 코드에서 `alarm_schedules`, `createMemoAlarm`, `syncMemoAlarms`, `deleteAllMemoAlarmsForUser` 호출처를 전수 조사한다
   - [ ] legacy/deprecated로 판정된 함수나 endpoint가 운영 cron에서 호출되지 않는지 확인한 뒤 제거 또는 비활성화 계획을 세운다
   - [ ] canonical `send-notifications`는 제거 대상이 아니라 유지 대상임을 명시한다

### Phase C: 운영 alarm_schedules 정리 실행 계획

6. [ ] **정리 SQL을 destructive 실행 전 단계별로 나눈다**
   - [ ] Step 1: backup/export 생성
   - [ ] Step 2: legacy cron 비활성화 또는 canonical 단일화
   - [ ] Step 3: deprecated/stale `alarm_schedules` row 삭제 또는 비활성화
   - [ ] Step 4: 앱 reset 또는 서버 재생성 helper를 통해 현재 메모 기준 row 재생성
   - [ ] Step 5: `notification_logs`와 개발자 FCM 상태 화면으로 발송 성공/실패를 검증

7. [ ] **삭제 대신 비활성화가 나은 row와 즉시 삭제 row를 분리**
   - [ ] memo_id 불명확 row는 먼저 `is_enabled = false` 후보로 둔다
   - [ ] duplicate row 중 canonical로 유지할 1개를 제외한 row는 삭제 후보로 둔다
   - [ ] timezone null/비KST row는 canonical 재생성 가능 여부에 따라 삭제 또는 비활성화로 나눈다
   - [ ] row count와 샘플 확인 전에는 운영 DELETE를 실행하지 않는다고 명시한다

### Phase D: 앱 reset/재생성 로직 보강

8. [ ] **Supabase 서버 발송 경로를 계획 근거로 고정**

   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `alarm_schedules` 조회 조건(`is_enabled`, UTC/KST `alarm_time`)과 `timezone === 'Asia/Seoul'` 분기 확인 결과를 주석 또는 plan evidence에 남긴다
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: `send-fcm-notifications-every-minute`가 `/functions/v1/send-notifications`를 매분 호출하는 구조를 확인한다
   - [ ] `docs/archive/2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md`: 과거 운영 조사에서 `alarm_schedules`, `user_devices`, `notification_logs`, `cron.job`가 실제 장애 분석 대상이었다는 근거를 확인한다

9. [ ] **서버 스케줄 delete-only를 delete-and-rebuild로 변경**
   - [ ] `src/lib/services/alarmSchedules.ts`: `deleteAllMemoAlarmsForUser(userId)`는 유지하되, reset 전용 `syncAllMemoAlarmsForUser(userId, memos)` helper를 추가한다
   - [ ] `src/lib/services/alarmSchedules.ts`: helper는 먼저 `deleteAllMemoAlarmsForUser(userId)`를 호출하고, 이후 활성 메모의 활성 reminder를 `createMemoAlarm`으로 다시 생성한다
   - [ ] `src/lib/services/alarmSchedules.ts`: reminder 추출은 앱의 기존 `getRemindersFromMemo` helper를 사용해 구형 `reminder`와 신규 `reminders` 배열을 동일하게 처리한다
   - [ ] `src/routes/+layout.svelte`: reset confirm에서 서버 step은 `deleteAllMemoAlarmsForUser` 직접 호출이 아니라 `syncAllMemoAlarmsForUser(authStore.user.id, memosStore.memos)` 호출로 교체한다
   - [ ] `src/routes/+layout.svelte`: 서버 재동기화 실패 시 partial failure로 남기고, "서버 스케줄까지 정상화됨"으로 오해될 toast/상태 표시를 하지 않는다

10. [ ] **서버 timezone 계약을 KST로 명시**
   - [ ] `src/lib/services/alarmSchedules.ts`: `createMemoAlarm`이 서버 row 생성 시 `timezone: 'Asia/Seoul'`을 명시하도록 수정한다
   - [ ] `src/lib/services/alarmSchedules.ts`: 브라우저의 임의 IANA timezone 문자열은 현재 Edge Function에서 KST 외에는 UTC로 처리되므로 사용하지 않는다는 주석을 남긴다
   - [ ] `src/lib/services/alarmSchedules.ts`: `metadata`에 `memo_id`와 함께 `reminder_id`를 저장해 다중 reminder row 식별성을 높인다
   - [ ] `src/lib/components/settings/dev/DevFcmStatusSection.svelte`: 개발자 FCM 상태 화면에서 reset 후 `alarm_schedules` row가 삭제-only가 아니라 현재 메모 기준으로 재생성되는지 확인 가능한지 점검한다

11. [ ] **신규 가입자/새 설치 판별 기준을 문서와 코드 주석에 맞춘다**
   - [ ] `src/routes/+layout.svelte`: 신규 가입자 제외는 `authStore.user.created_at >= SCHEDULE_RESET_ROLLOUT_CUTOFF` 기준임을 주석으로 명확히 한다
   - [ ] `src/routes/+layout.svelte`: 앱 재설치는 신규 가입 판정이 아니며, localStorage 1회 플래그가 없어진 기존 계정은 다시 대상이 될 수 있음을 plan에 남긴다
   - [ ] `src/routes/+layout.svelte`: cutoff가 날짜 문자열(`2026-05-13`)이라 같은 날짜 가입자까지 제외될 수 있는지 검토하고, 필요하면 정확한 ISO timestamp cutoff로 교체한다

### Phase E: 할일 전체 재스케줄 helper 추가

12. [ ] **`src/lib/utils/todoNotifications.ts`에 `rescheduleAllTodoNotifications(memos: Memo[]): Promise<void>` export 추가**
   - [ ] `src/lib/utils/todoNotifications.ts` 파일 끝(line 474 이후, `rescheduleAllTodosForGlobalAutoAlert` 함수 닫기 `}` 뒤)에 새 export 함수 삽입
   - [ ] 함수 시그니처: `export async function rescheduleAllTodoNotifications(memos: Memo[]): Promise<void>`
   - [ ] 본문: `memos.filter(m => m.memoType === 'todo' && m.todoStatus === 'pending')`로 대상 목록 추출
   - [ ] `for (const todo of pendingTodos) { await scheduleTodoNotifications(todo); }` 순차 호출 (`scheduleTodoNotifications` 내부에서 조건 재검증하므로 중복 등록 없음)
   - [ ] native가 아닌 환경(웹 PWA)에서는 `scheduleTodoNotifications` 내부의 SW 등록 경로로 자동 fallback됨 (별도 처리 불필요)

### Phase F: 초기화 orchestration에 할일 재등록 추가

13. [ ] **`src/routes/+layout.svelte`에 `rescheduleAllTodoNotifications` import 추가**
   - [ ] line 17의 기존 `capacitor` import 줄 아래에 새 import 행 삽입: `import { rescheduleAllTodoNotifications } from '$lib/utils/todoNotifications';`

14. [ ] **`src/routes/+layout.svelte` `handleNotificationScheduleReset` — step 5 삽입**
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

15. [ ] **`cancelAllNotifications` 호출처 전체 열거 — Grep으로 `src/` 전체 검색**
   - [ ] 호출처 1: `src/lib/utils/capacitor.ts:rescheduleAllNotifications` (line 203~214) — `handleNotificationScheduleReset` → `rescheduleAllNotifications` 경로. Phase 2 수정으로 todo 재등록 step 5가 뒤에 실행되므로 **방어됨**
   - [ ] 호출처 2: `src/lib/components/settings/dev/DevCapacitorBackgroundNotificationSection.svelte:clearAllScheduledNotifications` — 개발자 설정 패널의 "모든 예약 알림 취소" 버튼. 명시적 디버그 전체 삭제 용도이므로 재등록 의도가 없음. **해당 없음(방어 불필요)**

16. [ ] **방어됨/미방어 표 작성**

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

### Phase T4: 운영 검증

17. [ ] **정리 전후 운영 지표를 비교**
   - [ ] `alarm_schedules`: 정리 전/후 memo-alarm active row count를 비교한다
   - [ ] `cron.job`: canonical job 1개만 active인지 재조회한다
   - [ ] `notification_logs`: 정리 후 첫 발송 window에서 duplicate 발송이나 permission failure가 증가하지 않았는지 확인한다
   - [ ] 개발자 FCM 상태 화면: 대상 사용자 1명 이상에서 `user_devices`, `alarm_schedules`, 최근 `notification_logs`가 기대 상태인지 확인한다

---

## 기술적 고려사항

- `Memo` 타입의 todo 판별 필드는 `memoType: 'todo'`이고 상태는 `todoStatus: 'pending'`이다 (`src/lib/types/memo.ts` 확인 완료).
- `scheduleTodoNotifications`는 todo별 기존 알림을 먼저 취소(`REMOVE_TODO_NOTIFICATIONS`)한 뒤 재등록하므로, 중복 등록 위험은 없다.
- todo가 많으면 순차 호출 시 지연이 생길 수 있다. 완료 후 toast 표시 전에 `await` 처리가 필요하다.
- `rescheduleAllTodosForGlobalRemind`/`rescheduleAllTodosForGlobalAutoAlert`는 각각 `useGlobalRemind`/`useGlobalAutoAlert` flag가 있는 todo만 필터링하므로 reset 시 전체 재등록 용도로 부적합하다. 새 `rescheduleAllTodoNotifications`는 flag 무관하게 모든 pending todo를 대상으로 한다.
- 서버 FCM 알림은 클라이언트 기기 큐가 아니라 Supabase `alarm_schedules` row와 `send-notifications` cron/function 조합이 source of truth다. reset이 이 row를 삭제만 하면 "오래된 알림 제거"와 동시에 "정상 서버 알림 제거"가 발생한다.
- 현재 Edge Function의 timezone 처리는 일반 IANA timezone 전체 지원이 아니라 `Asia/Seoul` 특례와 UTC fallback 구조다. memo-alarm 서버 schedule은 KST 알림으로 저장하거나, 별도 Edge Function 개선 계획 없이 브라우저 timezone을 넣지 않는다.
- 운영 DB 정리는 destructive 작업이므로, dry-run SELECT와 backup/export 없는 DELETE/UPDATE를 금지한다.
- deprecated 제거의 대상은 `send-notifications` canonical path가 아니라 중복 cron, legacy function/job, stale `alarm_schedules` row, delete-only 생성/정리 방식이다.
- `syncAllMemoAlarmsForUser`는 `deleteAllMemoAlarmsForUser` 직후 `createMemoAlarm` 순차 호출 구조이므로 그 사이 짧은 window(메모 수에 비례)에 매분 `send-fcm-notifications-every-minute` cron이 돌면 정상 알람 1회 발송 누락 가능성이 있다. 가능하면 동일 트랜잭션/배치 upsert로 묶거나, reset 실행 시각을 cron 발송 직후로 권고하는 절차를 둔다.
- Phase T4 운영 검증은 운영 Supabase DB read 권한과 개발자 FCM 상태 화면 접근이 필요한 수동 절차다. `/merge-test`나 자동 CI로 cover되지 않으므로 PR 머지와 분리해 실행하고, 결과는 별도 로그/주석으로 남긴다.

*상태: 검토대기 | 진행률: 0/76 (0%)*
