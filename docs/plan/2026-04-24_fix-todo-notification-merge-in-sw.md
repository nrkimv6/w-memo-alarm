# fix: SW checkTodoNotifications 동일 시간대 할일 알림 개별 발송 폭주

> 작성일시: 2026-04-24 08:45
> 기준커밋: 72f5989
> 대상 프로젝트: memo-alarm
> branch: impl/fix-todo-notification-merge-in-sw
> worktree: .worktrees/impl-fix-todo-notification-merge-in-sw
> worktree-owner: D:\work\project\service\wtools\memo-alarm\docs\plan\2026-04-24_fix-todo-notification-merge-in-sw.md
> 상태: 검증중
> 유형: fix
> 진행률: 54/71 (76%)
> 요약: SW `checkTodoNotifications`가 동일 HH:MM 시간대의 할일 알림을 `todosToNotify.forEach(showNotification)` 로 개별 발송 — 메모 reminder 동일 버그(fix-notification-merge-in-foreground)의 todo 버전. 상기(remind) 알림이 여러 할일에 같은 시간으로 설정된 경우 동일 폭주 발생. 병합 발송으로 수정.
> 출처: /reflect에서 자동 생성 (fix-notification-merge-in-foreground Phase R2 후속 plan)

---

## 개요

### 증상

기본 상기 시간(예: 09:00)으로 설정된 할일이 여러 개 있으면, SW `checkTodoNotifications`가 각 할일마다 `sw.registration.showNotification(...)` 을 개별 호출한다. 할일 N개가 있으면 N개 알림이 1분 안에 연속으로 발생한다.

### 근본 원인

`src/service-worker.ts:279` `checkTodoNotifications` 발송 단계:

```typescript
// 현재 코드 (개별 발송)
todosToNotify.forEach((notif) => {
    sw.registration.showNotification(notif.title, {
        tag: notif.notificationId,   // 각 notif 고유 tag — 덮어쓰기 없음
        ...
    });
    // postMessage clients
});
```

- `tag: notif.notificationId` — 메모 reminder 버그와 동일한 구조
- 병합 로직 없음
- `todosToNotify` 수집은 이미 되어 있으나, 발송 단계에서 묶지 않음

### 관련 fix: plan

`fix-notification-merge-in-foreground` (머지커밋: fea06a6): 메모 reminder foreground/SW 병합 수정 완료.

- `src/lib/utils/notificationMerge.ts`: `buildMergedTitle(count)`, `buildMergedBody(titles, maxItems)` 이미 존재
- SW 내부 복사본: `src/service-worker.ts:60-69` (SW scope 제약으로 inline 복사, `// NOTE: duplicated` 주석)
- `buildMergedTitle`은 `"${count}개의 메모 알림"` 반환 — todo 전용 `buildMergedTodoTitle` 추가 필요

### 해결 방향

`checkTodoNotifications` 발송 단계에서:
- `todosToNotify.length === 0` → return
- `todosToNotify.length === 1` → 기존 단일 발송 유지
- `todosToNotify.length >= 2` → `showMergedTodoNotification(todosToNotify, currentTime)` 신설 함수 호출

병합 알림 설계:
- `tag: todo-batch-${currentTime}` (메모 `memo-batch-${time}` 와 구분)
- `data.type: 'todo-merged'`
- 클릭 → `/todos` (할일 목록 — `src/routes/todos/+page.svelte` 존재 확인)
- 각 notif 별 `postMessage(TODO_NOTIFICATION_SENT)` 는 병합 시에도 유지 (기록 일관성)

### 주의사항

- **remind vs alert 분리**: `notif.time`(매일 반복 상기)와 `notif.dateTime`(일회성 알람) 혼재. 동일 HH:MM 알람 폭주 가능성은 remind 쪽이 더 높음. alert는 각 todo의 기한 종속 — 동시 발생 드묾. 본 plan은 두 타입을 구분 없이 `todosToNotify` 에 수집된 전체를 대상으로 병합.
- **`sendNotificationRecord`**: `ScheduledReminder` 타입 전용 — todo 경로에서 사용 불가. 병합 시에도 inline `postMessage(TODO_NOTIFICATION_SENT)` 유지.
- **`notificationclick` 핸들러**: 현재 `data.type === 'merged'` → `/` 분기만 존재. `todo-merged` 분기 추가 필요.

## 기술적 고려사항

- `buildMergedBody` SW 내부 복사본 (`src/service-worker.ts:63-68`) 재사용 — 신규 import 불필요
- `buildMergedTodoTitle` 신설: SW 상단 복사본 블록(`line 59-68`) 직후에 추가 (`"${count}개의 할일 알림"`)
- `showMergedTodoNotification` 위치: `showMergedNotification` (line 210-233) 직후, `checkTodoNotifications` (line 236) 직전
- `vibrate: [200, 100, 200]` 병합 알림에 포함 (`showMergedNotification` 메모 버전 line 225 와 동일 패턴)
- `currentTime` 변수는 `checkTodoNotifications` 내부(line 238)에서 선언 → `showMergedTodoNotification(todosToNotify, currentTime)` 호출 시 정상 접근 가능
- `src/lib/utils/todoNotifications.ts` `scheduleTodoNotificationsNative()` 는 todo별 개별 native 예약을 유지한다. 본 plan 완료 판정은 SW 경로 한정이며, native 경로는 Phase R에서 `대상 아님/별도 plan` 여부를 명시한다.
- `notificationclick` 는 단일 todo 알림에서 `data.url` 대신 `/?memo=${data.memoId}` 로 이동한다. 본 plan은 `todo-merged` 신규 분기만 추가하고, 단일 todo 라우팅 정합성은 Phase R에서 후속 plan 필요 여부를 기록한다.
- 현재 코드베이스에는 `TODO_NOTIFICATION_SENT` 소비 지점이 없다 (`src/service-worker.ts` 발송만 존재). 본 plan은 메시지 payload parity 유지까지만 다루고, 실제 소비자 추가 여부는 Phase R에서 범위 포함 여부를 판정한다.

---

## TODO

### Phase 0: Worktree 준비

0. - [x] **worktree 준비 상태 고정**
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: `> branch:` 에 `impl/fix-todo-notification-merge-in-sw` 를 기록했다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: `> worktree:` 에 `.worktrees/impl-fix-todo-notification-merge-in-sw` 를 기록했다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: `> worktree-owner:` 에 부모 plan 절대경로를 기록했다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: worktree 메타가 현재 plan 소유임을 헤더에 고정했다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: 상태를 `구현중` 으로 전환했다
   - [x] `D:\work\project\service\wtools\memo-alarm\.worktrees\impl-fix-todo-notification-merge-in-sw`: 구현 cwd를 worktree 루트로 고정했다

### Phase 1: SW 병합 함수 추가

1. - [x] **`buildMergedTodoTitle` 함수 신설 (SW scope 복사본)**
   - [x] `src/service-worker.ts`: `buildMergedBody()` 바로 아래에 `buildMergedTodoTitle(count: number): string` 선언 블록을 추가한다
   - [x] `src/service-worker.ts`: `buildMergedTodoTitle()` 반환 문자열을 `` `${count}개의 할일 알림` `` 1줄로 고정한다
   - [x] `src/service-worker.ts`: 새 함수 앞에 `// NOTE: duplicated label for todo — SW scope` 주석을 추가한다
   - [x] `src/service-worker.ts`: 기존 `buildMergedTitle()` 본문과 `showMergedNotification()` 호출은 메모 전용으로 그대로 둔다

2. - [x] **`showMergedTodoNotification` 함수 신설**
   - [x] `src/service-worker.ts`: `showMergedNotification()` 바로 아래에 `function showMergedTodoNotification(todos: TodoScheduledNotification[], time: string): void` 시그니처를 추가한다
   - [x] `src/service-worker.ts`: 함수 시작부에서 `todos.map(t => t.memoId)` 로 merged data용 `memoIds` 배열을 만든다
   - [x] `src/service-worker.ts`: `sw.registration.showNotification()` 제목에 `buildMergedTodoTitle(todos.length)` 를 사용한다
   - [x] `src/service-worker.ts`: `showNotification()` 본문에 `buildMergedBody(todos.map(t => t.title))` 를 사용한다
   - [x] `src/service-worker.ts`: 병합 tag를 `` `todo-batch-${time}` `` 으로 설정한다
   - [x] `src/service-worker.ts`: notification `data` 에 `{ type: 'todo-merged', time, memoIds }` 만 담아 merged click 분기와 맞춘다
   - [x] `src/service-worker.ts`: 병합 옵션에 `vibrate: [200, 100, 200]` 와 `requireInteraction: true` 를 넣는다
   - [x] `src/service-worker.ts`: 성공 경로에서 `sw.clients.matchAll()` 을 1회 호출하고 각 todo마다 `TODO_NOTIFICATION_SENT` success payload를 보낸다
   - [x] `src/service-worker.ts`: 실패 경로에서 `swLog('error', 'Failed to show merged todo notification', e)` 를 호출한다
   - [x] `src/service-worker.ts`: 실패 경로에서도 각 todo마다 `TODO_NOTIFICATION_SENT` failed payload를 보내 payload shape parity를 유지한다

### Phase 2: checkTodoNotifications 발송 단계 분기

3. - [x] **`src/service-worker.ts:279-311` `todosToNotify.forEach(...)` 블록 전체를 length 분기로 교체**
   - [x] `src/service-worker.ts`: `todosToNotify.length === 0` 이면 즉시 `return` 하는 early-return을 추가한다
   - [x] `src/service-worker.ts`: `todosToNotify.length === 1` 분기에서 `const notif = todosToNotify[0]` 추출을 추가한다
   - [x] `src/service-worker.ts`: 단일 분기 `showNotification()` 옵션에서 `body`, `icon`, `badge`, `tag` 를 기존 단일 todo 값과 동일하게 유지한다
   - [x] `src/service-worker.ts`: 단일 분기 `data` 를 `{ memoId: notif.memoId, url: notif.url, type: notif.type }` 로 유지한다
   - [x] `src/service-worker.ts`: 단일 분기 `vibrate` ternary 와 `requireInteraction` 을 기존 단일 todo 값 그대로 유지한다
   - [x] `src/service-worker.ts`: 단일 분기 success path에서 기존 `TODO_NOTIFICATION_SENT` payload shape를 그대로 유지한다
   - [x] `src/service-worker.ts`: 단일 분기 catch에서 `swLog('error', \`Failed to show todo notification: \${notif.title}\`, e)` 를 그대로 유지한다
   - [x] `src/service-worker.ts`: `todosToNotify.length >= 2` 분기에서 `showMergedTodoNotification(todosToNotify, currentTime)` 만 호출한다
   - [x] `src/service-worker.ts`: 기존 `todosToNotify.forEach((notif) => { ... })` 반복 발송 블록 전체를 제거한다
   - [x] `src/service-worker.ts`: `lastNotified` 갱신과 one-time `todoNotifications` 제거는 발송 전 수집 루프에 그대로 남겨 재진입 semantics를 바꾸지 않는다

### Phase 3: notificationclick 핸들러 분기 추가

4. - [x] **`data.type === 'todo-merged'` 분기를 `'merged'` 분기 앞에 삽입**
   - [x] `src/service-worker.ts`: `if (data?.type === 'todo-merged')` 분기를 기존 `merged` 분기 앞에 추가한다
   - [x] `src/service-worker.ts`: `todo-merged` 분기 `appUrl` 을 `'/todos'` 로 고정한다
   - [x] `src/service-worker.ts`: `todo-merged` 분기 로그를 `📱 Merged todo notification clicked, navigating to todos` 로 추가한다
   - [x] `src/service-worker.ts`: 기존 `data?.type === 'merged'` home 분기는 메모 병합용으로 그대로 유지한다
   - [x] `src/service-worker.ts`: 기존 `data?.memoId` 단일 todo/memo 분기와 `externalUrl` 계산 로직은 그대로 둔다
   - [x] `src/service-worker.ts`: `data.url` 이 상대경로(`/todos?id=...`)여도 merged todo 경로는 `appUrl='/todos'` 로 이동하도록 scope를 명시한다

### Phase R: 재발 경로 분석 (fix: plan 필수)

R1. - [x] **todo 알림 발송 경로 전수 열거 + 방어 여부 판정**
   - [x] `src/service-worker.ts`: `showNotification(` / `registration.showNotification(` 검색 결과에서 push, memo single, memo merged, todo single-or-merged, 테스트 알림 경로를 파일 내 표로 분류한다
   - [x] `src/service-worker.ts`: `checkTodoNotifications()` 만 이번 수정의 `병합 적용` 경로로 표시한다
   - [x] `src/service-worker.ts`: push 이벤트와 테스트 알림 두 경로는 동일 HH:MM fan-out 구조가 없음을 근거로 `대상 아님` 으로 표시한다
   - [x] `src/lib/utils/todoNotifications.ts`: `scheduleTodoNotificationsNative()` 와 `LocalNotifications.schedule()` 가 OS 예약 경로임을 기록하고 SW plan 범위 밖인지 판정한다
   - [x] `src/lib/utils/todoAlertManager.svelte.ts`: `checkForAlerts()` / `onAlertTrigger` 가 AlertModal 트리거만 수행함을 근거로 `대상 아님` 여부를 적는다
   - [x] `src/service-worker.ts` + `src`: `TODO_NOTIFICATION_SENT` 검색 결과가 발송부 1곳뿐인지 확인하고, 소비자 부재를 비고에 적는다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: 경로별 방어여부 표를 `병합 적용 / 대상 아님 / 별도 plan 필요` 중 하나로 기록한다

R2. - [x] **미방어 경로 수정**
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: native 예약 경로가 미방어면 "현재 SW plan 범위 제외" 문구와 후속 plan 필요 여부를 비고에 남긴다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: `TODO_NOTIFICATION_SENT` 소비자 부재가 범위 내 수정이 아닌지 판정하고 필요 시 후속 plan 메모만 남긴다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: 본 plan 완료 기준을 `checkTodoNotifications` 병합 + `todo-merged` click route 추가로 고정한다
   - [x] `docs/plan/2026-04-24_fix-todo-notification-merge-in-sw.md`: `전체 방어 완료` 표현은 SW 경로에 한정하고 scope 밖 경로는 `별도 plan 필요` 로 남긴다

#### Phase R 결과표

| 경로 | 판정 | 근거 |
|------|------|------|
| `src/service-worker.ts` `checkTodoNotifications()` | 병합 적용 | 동일 HH:MM todo fan-out 지점이며 이번 수정으로 `showMergedTodoNotification()` 분기 추가 |
| `src/service-worker.ts` push / memo / 테스트 알림 | 대상 아님 | 서버 push, memo reminder, 수동 테스트 알림은 todo SW fan-out 수정 범위가 아님 |
| `src/lib/utils/todoNotifications.ts` `scheduleTodoNotificationsNative()` | 별도 plan 필요 | Capacitor native 예약은 todo별 개별 OS 스케줄을 유지하며 이번 SW 배치 fix 범위 밖 |
| `src/lib/utils/todoAlertManager.svelte.ts` `checkForAlerts()` | 대상 아님 | OS notification 발송이 아니라 `AlertModal` 트리거만 수행 |
| `src/service-worker.ts` `TODO_NOTIFICATION_SENT` | 별도 plan 필요 | 발송부만 있고 소비 지점은 현재 코드베이스에 없음 |
| `src/service-worker.ts` 단일 todo click route | 별도 plan 필요 | 단일 todo 알림은 여전히 `/?memo={memoId}` 로 이동하며 이번 merged route fix와 별도 |

> SW 범위 전체 방어 완료: `checkTodoNotifications` fan-out 은 병합 적용됨. native 예약 경로, `TODO_NOTIFICATION_SENT` 소비자, 단일 todo click route 는 별도 후속 plan 후보로 남긴다.

### Phase 4: 수동 검증

5. - [ ] **동일 시간대 상기 알림 병합 시나리오**
   - [ ] `src/lib/utils/todoNotifications.ts` 경로로 등록되는 상기 todo 3개 이상을 같은 `time: HH:MM` 으로 만든다
   - [ ] 해당 시각 도달 시 OS 알림이 1건만 뜨는지 확인한다
   - [ ] 병합 제목이 `"N개의 할일 알림"` 형식인지 확인해 `buildMergedTodoTitle()` 반환값을 검증한다
   - [ ] 병합 본문이 `buildMergedBody()` 규칙대로 상위 항목만 노출하는지 확인한다
   - [ ] 병합 알림 클릭 시 앱이 `/todos` 로 이동하는지 확인한다
   - [ ] 같은 조건에서 `TODO_NOTIFICATION_SENT` 메시지 또는 로그가 success path로 남는지 devtools/로그로 확인한다

6. - [ ] **단일 발송 및 alert 경로 회귀 시나리오**
   - [ ] 동일 시각 대상이 1건만 남도록 조정한 뒤 기존 단일 알림이 `tag: notificationId` 로 발송되는지 확인한다
   - [ ] `todo-alert` 2건 이상을 같은 분으로 맞춰 병합되더라도 `vibrate: [200, 100, 200]` merged 규칙으로 동작하는지 확인한다
   - [ ] 단일 todo 알림 클릭 시 기존 `/?memo={memoId}` 이동이 유지되는지 확인한다
   - [ ] one-time alert 발송 후 해당 `notificationId` 가 `todoNotifications` 배열에서 제거되는지 확인한다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `main merge` 단계에서 TypeScript/SW 변경만 포함되는지 확인한다
   - [ ] T4/T5는 Python 변경과 `tests/` 디렉토리 부재를 근거로 해당 없음 처리한다
   - [ ] 구현 worktree 제거와 구현 branch 제거를 owner 단계로 남긴다
   - [ ] merge 완료 후 `branch/worktree/worktree-owner` 헤더 메타를 제거한다

## 작업 수 요약

- Phase 0: Worktree 준비 (7개 체크박스)
- Phase 1: SW 병합 함수 추가 (16개 체크박스)
- Phase 2: checkTodoNotifications 발송 단계 분기 (11개 체크박스)
- Phase 3: notificationclick 핸들러 분기 추가 (7개 체크박스)
- Phase R: 재발 경로 분석 (13개 체크박스)
- Phase 4: 수동 검증 (12개 체크박스)
- Phase Z: Post-Merge Cleanup (5개 체크박스)
- 총 71개 체크박스

> T4/T5 해당 없음: Python 코드 없음, `tests/` 디렉토리 없음 (2026-04-24 확인). Phase 4 수동 검증으로 대체.

---

*상태: 검증중 | 진행률: 54/71 (76%)*
