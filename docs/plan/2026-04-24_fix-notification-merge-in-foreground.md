# fix: foreground 경로에서 동일 시간대 알림 병합 누락

> 작성일시: 2026-04-24 17:30
> 기준커밋: 931c414
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/22 (0%)
> 요약: 기본 알림 시간(예: 09:00) 시점에 13개 개별 알림이 1분 안에 쏟아져 너무 번잡함 — foreground(메인 스레드) 경로도 Service Worker와 동일하게 동일 HH:MM 그룹을 1건의 병합 알림으로 축약

---

## 개요

### 증상

기본 알림 시간(예: 09:00)에 해당 시간대의 reminder를 가진 메모가 13개 있으면, 사용자는 1분 안에 알림 13개를 연속으로 받는다. 알림 센터/잠금화면이 사실상 도배된다.

### 근본 원인

알림 체크·발송 경로가 **두 개**로 병렬 존재하며, 둘의 동작이 비대칭이다.

1. **Service Worker 경로** (`src/service-worker.ts:304-380`)
   - `checkScheduledReminders()`가 같은 HH:MM에 해당하는 reminder를 한 번에 수집 → `remindersToNotify.length > 1`이면 `showMergedNotification()` 호출 → 1건의 병합 알림으로 발송.
   - **병합이 이미 구현되어 있음.** 백그라운드/PWA 닫힘 상태에서는 이 경로가 동작.

2. **메인 스레드(foreground) 경로** (`src/lib/stores/notifications.svelte.ts:249-331`)
   - `checkAndTriggerReminders()`가 `activeReminderMemos.forEach(memo => showNotification(memo))` 로 **각 메모마다 개별 호출** → SW의 `showNotification()`도 `tag: memo.id` 로 메모 단위 알림을 발송.
   - **병합 로직이 없음.** 앱이 foreground(특히 일반 브라우저 탭)일 때 이 경로가 먼저 동작해 13건을 그대로 터뜨린다.
   - `setInterval(..., 60000)` 가 메인 스레드에서 돌고, `permission === 'granted'` 이면 그대로 forEach 발송.

추가로 `reminders[]` 배열(다중 reminder) 대응이 경로별로 비대칭이다:
- `activeReminderMemos` derived는 `memo.reminders` 배열을 보지만, 루프 내부 `line 285: if (!memo.reminder?.enabled) return;` 는 **구 형식 단일 `memo.reminder` 만 체크**. 신 형식 `reminders[]` 메모는 반복마다 누락되거나 중복 발송될 여지가 있다. (부수 결함, 본 plan 범위에 포함)

### 해결 방향

**경로 단일화가 아닌 "병합 로직을 foreground 경로에도 추가"** 를 택한다. 이유:

- 경로 단일화(foreground check 삭제)는 SW active 타이밍/권한 상태/탭 foreground visibility 에 따라 알림 누락 리스크가 크다.
- 병합 로직을 공통 유틸로 뽑아 두 경로가 같은 규칙을 쓰게 하면, 결과 일관성 + 최소 변경.

기각 대안:
- "foreground check 경로를 제거하고 SW 에 일임": SW activating 상태/iOS 제약 등으로 누락 가능, 회귀 리스크 큼.
- "알림 debounce (예: 동일 시점 N초 이내 재발화 억제)": 서로 다른 HH:MM 에 각각 병합되어야 하는 케이스를 놓침. 근본 해결 아님.

## 기술적 고려사항

- **병합 기준**: `HH:MM` 동일한 reminder들을 묶는다. (현재 SW 규칙과 동일)
- **알림 본문 길이 상한**: 13개면 제목이 그대로 쌓여 본문이 매우 길어진다. 상위 3~5개만 `• {title}` 로 노출하고 나머지는 `외 N건` 로 축약. SW 기존 `showMergedNotification` 도 같이 개선.
- **알림 tag**: 병합 시 `tag: memo-batch-{HH:MM}` 로 동일. 연속 분 경계 재발화 시 브라우저가 기존 알림을 덮어쓰게 둔다.
- **클릭 동작**: 병합 알림 클릭 시 `/` (홈) 로 이동 — SW 기존 동작 유지. foreground 경로의 native Notification 분기도 동일하게 맞춘다.
- **`notificationHistory` 기록 단위**: 병합이어도 포함된 reminder 각각에 대해 `addRecord()` 1건씩 남긴다. 이력 상 "몇 건 발송됐는지"를 유지. (SW 기존 동작과 일치)
- **`lastNotifiedMap` 정합성**: 병합 발송 후에도 `lastNotifiedMap[memo.id] = ${todayDate}-${reminderTime}` 을 각 메모별로 기록해야 다음 분 경계에 재발화를 막는다.
- **`isOnce` 처리**: 병합 대상 중 `once` 인 reminder 는 발송 후 기존 로직대로 `enabled=false` 처리. 루프 중 `memosStore.update()` 배치 호출.
- **`reminders[]` 배열 대응은 별도 plan 로 남긴다** — 본 plan 은 병합 누락만 해결한다. 루프 내부의 `memo.reminder?.enabled` 체크는 `getRemindersFromMemo(memo).some(r => r.enabled && r.time === currentTime)` 로 최소 수정만 수행해 다중 reminder 병합에서 빠지는 건 막되, 개별 reminder 단위 발송/스케줄링 개편은 범위 밖.
- **SW 번들 전략**: SvelteKit 의 `src/service-worker.ts` 는 Vite 로 별도 번들됨. `$lib` alias 는 SW 에서 사용 가능하지만 module 경로 해석이 런타임에서 깨질 수 있어, 안전하게 `src/lib/utils/notificationMerge.ts` 의 순수 함수를 SW 에서 relative import 로 참조하거나, 빌드 실패 시 함수 본체를 SW 상단에 복사하는 2안을 Phase 2 에서 검증.

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: blank 슬롯은 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: `worktree 생성 또는 재개`는 `/implement` 또는 `plan-runner` owner flow 임을 적는다
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 병합 유틸 추출

1. - [ ] **공통 병합 로직을 새 유틸 파일로 분리** — SW/메인 스레드가 같은 규칙을 공유
   - [ ] `src/lib/utils/notificationMerge.ts` (신규): `buildMergedBody(titles: string[], maxItems = 4): string` 구현 — 상위 N개 `• {title}` + `외 {rest}건` 축약, `titles.length === 0` 이면 빈 문자열 반환
   - [ ] `src/lib/utils/notificationMerge.ts` (신규): `buildMergedTitle(count: number): string` 구현 — `"{count}개의 메모 알림"` 반환, 기존 SW 제목과 동일 문구 유지
   - [ ] `src/lib/utils/notificationMerge.ts` (신규): 순수 함수 + 외부 import 없음 — SW/메인 양쪽 컨텍스트에서 동작

### Phase 2: Service Worker 병합 본문 개선

2. - [ ] **SW `showMergedNotification` 본문을 축약 형태로 교체**
   - [ ] `src/service-worker.ts:199-223` `showMergedNotification`: `titles` 생성 로직(`reminders.map(r => '• ' + r.title).join('\n')`)을 `buildMergedBody(reminders.map(r => r.title))` 호출로 교체
   - [ ] `src/service-worker.ts:204` 제목 `"${reminders.length}개의 메모 알림"` 을 `buildMergedTitle(reminders.length)` 호출로 교체
   - [ ] `src/service-worker.ts`: SW 가 `$lib/utils/notificationMerge` 를 import 가능한지 `npm run build` 로 확인. 실패 시 `buildMergedTitle`/`buildMergedBody` 본체를 SW 파일 상단에 **복사**하고 `// NOTE: duplicated from src/lib/utils/notificationMerge.ts — SW scope` 주석 남김

### Phase 3: 메인 스레드 체크 루프에 병합 도입

3. - [ ] **`checkAndTriggerReminders` 를 "수집 → 그룹핑 → 발송" 으로 재구성**
   - [ ] `src/lib/stores/notifications.svelte.ts:249-331` `checkAndTriggerReminders`: 루프 내부 `showNotification(memo)` 즉시 호출 제거, `const toFire: Memo[] = []` 로 수집만
   - [ ] `src/lib/stores/notifications.svelte.ts`: 수집 후 `toFire.length === 0` 이면 return, `=== 1` 이면 기존 `showNotification(toFire[0])`, `>= 2` 이면 신규 `showMergedForeground(toFire, currentTime)` 호출
   - [ ] `src/lib/stores/notifications.svelte.ts`: `lastNotifiedMap[memo.id] = notifyKey` 와 `once → enabled=false` 전환을 **발송 전** 일괄 수행 → 같은 분 경계의 동시 재진입 중복 방지
   - [ ] `src/lib/stores/notifications.svelte.ts`: `saveLastNotified()` 는 수집/업데이트 완료 후 1회만 호출 (반복 저장 제거)

4. - [ ] **`showMergedForeground` 신설** — foreground 경로 병합 알림 발송기
   - [ ] `src/lib/stores/notifications.svelte.ts`: `async function showMergedForeground(memos: Memo[], time: string): Promise<void>` 추가 — SW ready 확보 후 `registration.showNotification(buildMergedTitle(memos.length), { body: buildMergedBody(memos.map(m => m.title)), icon: '/favicon.png', tag: ``memo-batch-${time}``, data: { memoIds: memos.map(m => m.id), url: '/', type: 'merged', time }, requireInteraction: true })`
   - [ ] `src/lib/stores/notifications.svelte.ts`: SW 미가용 시 fallback 으로 `new Notification(buildMergedTitle(memos.length), { body: buildMergedBody(...) })` **1회만** 발송 — 각 memo 반복 금지
   - [ ] `src/lib/stores/notifications.svelte.ts`: memo 각각에 대해 `notificationHistoryStore.addRecord({ memoId: m.id, memoTitle: m.title, status: 'success', channel: 'sw-push', reminderType: ..., sentAt })` 를 루프로 기록 (SW 경로와 일관된 이력 단위 유지)
   - [ ] `src/lib/stores/notifications.svelte.ts`: 발송 실패 catch 블록에서 포함 memo 전부에 `status: 'failed'` 레코드 기록

5. - [ ] **snoozed reminder 는 병합 범위 밖임을 명시**
   - [ ] `src/lib/stores/notifications.svelte.ts:266-279` `snoozedReminders.forEach(...) showNotification(memo, true)`: 스누즈 해제 시점은 제각각이라 병합 대상이 아님을 코드 주석 1줄로 남긴다

### Phase 4: 다중 reminder 누락 최소 수정

6. - [ ] **루프 필터를 `reminders[]` 기반으로 수정** — 다중 reminder 시대의 병합 누락 방지
   - [ ] `src/lib/stores/notifications.svelte.ts:285` `if (!memo.reminder?.enabled) return;`: `const rems = getRemindersFromMemo(memo); const active = rems.find(r => r.enabled && r.time === currentTime); if (!active) return;` 로 교체
   - [ ] `src/lib/stores/notifications.svelte.ts:301-314`: `memo.reminder.type/days/date` 참조를 `active.type/active.days/active.date` 로 치환
   - [ ] `src/lib/stores/notifications.svelte.ts:324-329` once → enabled=false 전환: `memosStore.update(memo.id, { reminder: { ..., enabled: false } })` 대신 `memosStore.updateReminderEnabled(memo.id, active.id, false)` 호출 — 다른 reminder 끼지 않게 active.id 하나만 끄기

### Phase 5: 클릭 동작 검증

7. - [ ] **foreground 병합 알림 클릭 라우팅 확인**
   - [ ] `src/service-worker.ts:509-559` `notificationclick`: `data.type === 'merged'` 분기에 foreground 경로에서 온 tag(`memo-batch-${time}`) 도 동일 규칙으로 매칭되는지 확인 — 동일 tag 규칙이므로 자연 매칭, 필요 시 주석으로 명시
   - [ ] `src/lib/stores/notifications.svelte.ts`: `new Notification()` native fallback 분기 `onclick`: `window.focus()` 후 `location.href = '/'` 로 홈 이동. `autoOpen` 외부 URL 처리는 병합 알림에는 적용하지 않는다(복수 memo 대상이라 단일 URL 결정 불가) — 코드 주석으로 명시

### Phase R: 재발 경로 분석 (fix: plan 필수)

R1. - [ ] **알림 발송 경로 전수 열거 + 방어 여부 판정**
   - [ ] Grep: `showNotification\(`, `registration\.showNotification\(`, `new Notification\(` 를 프로젝트 전체에서 검색 (exclude `node_modules`, `build`)
   - [ ] 각 호출 경로별로 "동일 HH:MM 에 N건 이상 발생할 수 있는 컨텍스트인가?" 판정 → 경로별 `방어여부`(병합 적용/대상 아님/미방어) 를 plan 비고 섹션에 표로 기록
   - [ ] 예상 경로: SW `checkScheduledReminders`(병합 적용), SW `push` 이벤트 핸들러(서버 푸시 1건 단위, 대상 아님), foreground `checkAndTriggerReminders`(병합 적용 after fix), foreground `snooze 재발화`(스누즈 해제 타이밍 분산, 대상 아님), foreground `showNotification` 직접 노출(단일 호출, 대상 아님)

R2. - [ ] **todoNotifications 경로 검증**
   - [ ] `src/service-worker.ts:225-302` `checkTodoNotifications`: `todosToNotify.forEach(notif => showNotification(notif.title, ...))` 로 각 todo 마다 개별 발송 — memo reminder 와 동일 시간대 폭주 재현 가능성 존재. 본 plan 범위는 memo reminder 만이므로 **별도 plan** 으로 분리 기록(`todo-notification-merge` 후속 plan 제안)
   - [ ] `src/lib/utils/todoAlertManager.svelte.ts`, `src/lib/utils/todoNotifications.ts`: todo 경로가 foreground 에서도 forEach 발송하는지 Grep 으로 확인 → 해당하면 후속 plan 에 포함 대상으로 기록
   - [ ] plan 본문 하단 "후속 작업" 섹션에 "todo 알림도 동일 병합 필요 여부 판단" 문구 추가

R3. - [ ] **미방어 경로 방어**
   - [ ] R1/R2 에서 `미방어` 로 판정된 경로가 있으면 본 plan 범위 내에서 수정하거나, 범위 밖이면 별도 plan 로 기록하고 plan 본문에 링크
   - [ ] "전체 방어 완료" 문구를 plan 본문 Phase R 종료 부분에 명시 (⚠️ "근본 수정" 표현 금지)

### Phase 6: 수동/통합 테스트

8. - [ ] **foreground 병합 시나리오 수동 검증**
   - [ ] `docs/plan/2026-04-24_fix-notification-merge-in-foreground.md`: 검증 절차 결과를 본 파일 "검증" 섹션에 기록 — 기본 알림 09:00 으로 설정한 메모 13개 생성 → 탭을 열어 둔 상태에서 09:00 도달 → 알림 1건이 뜨고 제목 `"13개의 메모 알림"`, 본문 상위 4건 + `외 9건` 형태인지
   - [ ] `src/lib/stores/notifications.svelte.ts`: `notificationHistoryStore` 에 memo 당 success 레코드 13건이 남는지 확인
   - [ ] 브라우저 탭 닫힘(백그라운드) 상태 동일 시나리오도 1건 병합으로 뜨는지 확인 → SW 경로 회귀 없음 검증
   - [ ] 단일 reminder(메모 1개) 시 기존과 동일한 단일 알림 동작 확인 (type !== 'merged')

9. - [ ] **다중 reminder 메모 검증**
   - [ ] `memo.reminders = [{time:'09:00', enabled:true}, {time:'14:00', enabled:true}]` 형태의 메모 1건 + 다른 메모들(09:00) 혼합 → 09:00 병합에 다중 reminder 메모가 포함되는지 확인
   - [ ] 09:00 발송 후 14:00 reminder 는 동일 분 경계에서 발송되지 않도록 `lastNotifiedMap` 키가 time 단위로 구분되는지 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: `main merge 시도`를 owner step 으로 적는다
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: `root dirty stash/apply (if needed)`를 owner step 으로 적는다
   - [ ] `2026-04-24_fix-notification-merge-in-foreground.md`: `T4/T5 해당 없음 (TypeScript/Svelte UI 경로, pytest 강제 규칙 비대상)`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

## 🔴 pytest 강제 Phase 규칙 — 해당 없음

> T1~T5 해당 없음: 본 plan 은 Python 코드를 수정하지 않는다. 모든 변경은 `src/service-worker.ts`, `src/lib/stores/notifications.svelte.ts`, `src/lib/utils/notificationMerge.ts` (TypeScript) 한정이다. Node 단위 테스트 인프라(Vitest 등)가 이 프로젝트에 상시 가동되지 않아 Phase 6 수동 검증으로 대체한다.

---

## 검증 (수동)

### 검증 시나리오 A — foreground 병합

1. 설정 페이지에서 기본 알림 시간 `09:00`, 요일 `월~금` 로 설정
2. 제목만 다른 메모 13개를 만들고 각 메모에 기본 알림 적용
3. 시스템 시간을 `08:59:30` 으로 맞추고 앱 탭을 연 채 대기
4. `09:00:00` 이 지난 뒤 60초 이내 알림 **1건** 이 뜨고, 제목 `"13개의 메모 알림"`, 본문에 상위 4건과 `외 9건` 노출 확인
5. 설정 페이지 → 알림 이력에서 해당 memo 13건의 success 레코드 확인

### 검증 시나리오 B — background 회귀

1. 시나리오 A 와 동일 조건에서 앱 탭을 완전히 닫고 PWA 도 백그라운드로
2. SW 가 발화시킨 1건 병합 알림이 뜨는지 (SW `showMergedNotification` 경로 회귀 없음)

### 검증 기준

- [ ] 시나리오 A: 알림 1건, 본문 축약
- [ ] 시나리오 A 이력: memo 13건 success
- [ ] 시나리오 B 회귀 없음
- [ ] 단일 reminder(메모 1개) 시 기존과 동일한 단일 알림 동작
- [ ] Phase R1 경로 표에서 모든 경로가 `병합 적용` 또는 `대상 아님` 판정

---

## 후속 작업 (본 plan 범위 밖)

- **todo 알림 병합**: `checkTodoNotifications` 경로도 forEach 개별 발송 구조라 동일 폭주 가능. 별도 plan `fix-todo-notification-merge-in-foreground` 로 분리.
- **reminders[] 배열 스케줄링 개편**: SW 측 `scheduledReminders` 가 memo 단위로만 저장되어 다중 reminder 의 개별 on/off 관리가 제한적. 별도 refactor plan 필요.

---

*상태: 검토완료 | 진행률: 0/22 (0%)*
