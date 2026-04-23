# fix: SW checkTodoNotifications 동일 시간대 할일 알림 개별 발송 폭주

> 작성일시: 2026-04-24 08:45
> 기준커밋: 72f5989
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 유형: fix
> 진행률: 0/27 (0%)
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

- `buildMergedBody` SW 내부 복사본 (`src/service-worker.ts:60-69`) 재사용 — 신규 import 불필요
- `showMergedTodoNotification` 위치: `checkTodoNotifications` 위에 선언 (SW top-level function)

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태 고정**
   - [ ] `2026-04-24_fix-todo-notification-merge-in-sw.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯 채우기 (impl 워크트리 생성 후)
   - [ ] worktree cwd 고정 확인

### Phase 1: SW 병합 함수 추가

1. - [ ] **`showMergedTodoNotification` 함수 신설**
   - [ ] `src/service-worker.ts`: `function showMergedTodoNotification(todos: TodoScheduledNotification[], time: string): void` 추가 — `checkTodoNotifications` 정의 위에 선언
   - [ ] 함수 본체: `sw.registration.showNotification(buildMergedTitle(todos.length), { body: buildMergedBody(todos.map(t => t.title)), tag: \`todo-batch-${time}\`, data: { type: 'todo-merged', time, memoIds: todos.map(t => t.memoId) }, requireInteraction: true, icon: '/favicon.png', badge: '/favicon.png' })`
   - [ ] try/catch 래핑 — catch에서 `todos.forEach(t => { /* postMessage TODO_NOTIFICATION_SENT status:'failed' */ })`
   - [ ] 성공 시: `todos.forEach(t => { clients.matchAll().then(clients => clients.forEach(c => c.postMessage({ type: 'TODO_NOTIFICATION_SENT', memoId: t.memoId, notificationId: t.notificationId, notificationType: t.type, status: 'success', sentAt: ... }))) })`

### Phase 2: checkTodoNotifications 발송 단계 분기

2. - [ ] **발송 단계를 length 기반으로 분기**
   - [ ] `src/service-worker.ts:278` `todosToNotify.forEach(...)` 블록 전체를 다음 분기로 교체:
     ```
     if (todosToNotify.length === 0) return;
     if (todosToNotify.length === 1) { /* 기존 단일 발송 코드 */ }
     else { showMergedTodoNotification(todosToNotify, currentTime); }
     ```
   - [ ] 기존 단일 발송 코드(`sw.registration.showNotification(notif.title, { tag: notif.notificationId, ... }) + postMessage`)는 `length === 1` 분기로 이동 (내용 변경 없음)

### Phase 3: notificationclick 핸들러 분기 추가

3. - [ ] **`data.type === 'todo-merged'` 분기 추가**
   - [ ] `src/service-worker.ts:526` `notificationclick` 핸들러: `if (data?.type === 'merged') { appUrl = '/'; }` 위에 `if (data?.type === 'todo-merged') { appUrl = '/todos'; swLog(...) }` 선행 추가
   - [ ] 단일 todo 알림 클릭 (`data.memoId` 존재 시)은 기존 `/?memo=${data.memoId}` 그대로 유지 — 변경 없음

### Phase R: 재발 경로 분석 (fix: plan 필수)

R1. - [ ] **todo 알림 발송 경로 전수 열거 + 방어 여부 판정**
   - [ ] Grep: `showNotification\(`, `registration\.showNotification\(` 를 `src/` 전체 검색
   - [ ] todo 관련 경로 (`checkTodoNotifications`, `todoAlertManager`, `todoNotifications.ts`) 각각 "동일 HH:MM N건 이상 발생 컨텍스트인가?" 판정
   - [ ] 경로별 방어여부 표 기록: `병합 적용 / 대상 아님 / 미방어`

R2. - [ ] **미방어 경로 수정**
   - [ ] R1에서 미방어 판정 경로가 있으면 수정하거나 별도 plan 분리
   - [ ] 전체 방어 완료 명시

### Phase 4: 수동 검증

4. - [ ] **동일 시간대 상기 알림 병합 시나리오**
   - [ ] 기본 상기 시간이 동일한 할일 3개 이상 생성 → 해당 시간 도달 시 알림 1건 병합, 제목 `"N개의 할일 알림"` 확인
   - [ ] 단일 할일 알림 → 기존 단일 발송 동작 확인 (tag: notificationId 유지)
   - [ ] 병합 알림 클릭 → `/todos` 페이지 이동 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge, T4/T5 해당 없음 (TypeScript/SW, pytest 강제 규칙 비대상), worktree remove, branch remove, header meta 제거

> T4/T5 해당 없음: Python 코드 없음, `tests/` 디렉토리 없음 (2026-04-24 확인). Phase 4 수동 검증으로 대체.

---

*상태: 초안 | 진행률: 0/27 (0%)*
