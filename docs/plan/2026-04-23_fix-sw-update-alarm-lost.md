# SW 업데이트 후 알림 소실 수정

> 작성일시: 2026-04-23 15:30
> 기준커밋: 31ee2fb
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/16 (0%)
> 요약: 앱 업데이트 버튼(SW unregister) 이후 알람 실행 불가 — SW 재등록 시 reminders 0개 등록, FCM 토큰 400 실패를 유발하는 4가지 결함을 race 방어 + fingerprint 재등록 + 수동 도메인 승인으로 함께 수정

---

## 개요

사용자가 웹앱 업데이트 버튼을 누르면 Service Worker(SW)가 unregister되고 새 SW(#530)가 install/activate됨.
이 과정에서 두 개의 독립적 결함이 겹쳐 알람이 완전히 동작하지 않는다.

### 재현 로그 분석

```
✅ SW ready, state: activating          ← RC-B: activating 상태에서 진행
📊 memosStore.memos.length = 1
📤 Registering 0 reminders to SW        ← RC-C: activeReminderMemos 비어있음
POST .../wservice-cross-noti/installations 400   ← RC-A: 도메인 미승인
FCM token registration failed: INVALID_ARGUMENT  ← RC-A
```

### 근본 원인 4가지

| ID | 분류 | 원인 |
|----|------|------|
| RC-A | FCM 도메인 | `memo.woory.day`가 `wservice-cross-noti` Firebase Console 승인 도메인 목록에 없음 → Installations API 400 |
| RC-B | SW race | `navigator.serviceWorker.ready`는 Chrome에서 SW가 "activating" 상태일 때도 resolve; `clients.claim()` 실행 전 postMessage 전송 |
| RC-C | 0 reminders | `registerRemindersToServiceWorker`는 `onMount` 1회만 호출 — Supabase 재동기화 후 memos가 업데이트되어도 SW에 재전송하는 reactive 경로 없음 |
| RC-D | controllerchange | SW 교체(앱 업데이트) 후 새 SW가 `clients.claim()`으로 control을 가져올 때 reminders 자동 재등록 코드 없음 |

### RC-A 상세

`firebase-messaging-sw.js`와 `fcm.ts`는 `wservice-cross-noti` 프로젝트로 이미 전환됐지만, Firebase Console에서 `memo.woory.day` 도메인을 승인하지 않아 Firebase Installations API가 400을 반환함. FCM 토큰 없이는 서버 푸시(FCM) 알림 불가.

> **수동 조치 필요**: Firebase Console → Authentication → Authorized domains → `memo.woory.day` 추가  
> 체크리스트: `MANUAL_TASKS.md` > `2026-04-23: Cloudflare 환경변수 업데이트 (wservice-cross-noti 전환)` 섹션 하단에 병기

### RC-B 상세

`registerRemindersToServiceWorker`의 현재 로직:
```typescript
const registration = await navigator.serviceWorker.ready;
// registration.active?.state가 "activating"일 수 있음
if (!registration.active) return;  // activating이면 통과
registration.active.postMessage(...);  // 불안정 타이밍에 전송
```

Chrome 구현상 `navigator.serviceWorker.ready`는 SW state가 "activating"일 때도 resolve됨. SW가 `activate` 이벤트 핸들러에서 `clients.claim()`을 호출하기 전에 postMessage가 전송되면, SW가 현재 페이지를 아직 control하지 못하는 상태에서 메시지를 받는다.

### RC-C 상세

`+layout.svelte`의 `onMount`:
```typescript
await memosStore.init();      // localStorage 캐시 → Supabase sync (순서대로)
notificationStore.registerRemindersToServiceWorker();  // 1회 호출
```

`memosStore.init()`이 완료될 때 `fetchFromSupabase()`도 awaited되므로 이론상 Supabase 데이터가 있어야 함. 그러나:
- Realtime 구독 / 앱 업데이트 직후 재로드 시 타이밍에 따라 memo가 `reminders: []` 또는 `enabled: false`로 캐시됐을 가능성
- **근본 문제**: `activeReminderMemos`는 Svelte 5 `$derived`로 reactively 업데이트되지만 SW 재전송을 트리거하는 `$effect`가 없음
- 현재 `memosStore.update()`는 `changes.reminders`, `changes.reminder`, `changes.title`일 때만 `updateReminderInServiceWorker(result)`를 호출하므로, `content`/`url`만 바뀌는 경우 SW payload가 갱신되지 않을 수 있음

### RC-D 상세

앱 업데이트(SW unregister → 새 SW install → activate → `clients.claim()`) 후, 새 SW가 페이지를 control하는 순간(`controllerchange` 이벤트)에 reminders를 재전송하는 코드가 없음. `onMount`의 1회성 등록은 이미 지나간 후다.

## 기술적 고려사항

- RC-A 코드 수정: `registerFCMToken()`에서 `INVALID_ARGUMENT` 에러를 구분하고, Firebase Installations 400이 도메인 미승인인지 로그로 명확히 드러낸다.
- RC-B 수정은 `registerRemindersToServiceWorker()` 1곳만이 아니라, `notifications.svelte.ts` 내부의 `navigator.serviceWorker.ready` + `postMessage`/상태 조회 경로 전체에 공통 적용해야 한다. 동일 race가 `updateReminderInServiceWorker()`, `removeReminderFromServiceWorker()`, `getServiceWorkerScheduleStatus()`, `cleanup()`에 남아 있으면 SW 교체 직후 일부 경로가 다시 누락 등록을 만들 수 있다.
- RC-C 수정은 `activeReminderCount` 같은 개수 기반 감지가 아니라, `memoId`, `reminderId`, `time`, `type`, `days`, `date`, `title`, `body`, `url`, `autoOpen`까지 포함한 fingerprint 기반 재등록이어야 한다. 같은 개수의 알림에서 시각/제목/URL만 바뀌는 케이스를 count 기반으로는 잡지 못한다.
- `controllerchange` 리스너는 `await authStore.initialize()`/`await memosStore.init()`보다 먼저 등록해야 한다. 앱 업데이트 직후 새 SW가 `clients.claim()`을 끝내기 전에 listener를 늦게 붙이면 이벤트를 놓칠 수 있다.
- `MANUAL_TASKS.md`에는 이미 `2026-04-23: Cloudflare 환경변수 업데이트 (wservice-cross-noti 전환)` 섹션이 있으므로, Firebase 도메인 승인 체크는 새 날짜 섹션을 만들지 말고 기존 2026-04-23 섹션에 합쳐 중복을 피한다.
- 연관 active plan은 `2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md`(구현중)와 `2026-04-22_realign-fcm-to-wservice-crossnoti.md`(구현완료) 2건이다. 본 plan은 기존 project marker / settings 진단 카드 / Cloudflare env 전환 계획을 재사용하고, 범위를 `fcm.ts`, `notifications.svelte.ts`, `+layout.svelte`, `MANUAL_TASKS.md`로 제한한다.
- **⚠️ 로컬 drift (review-plan 감지)**: 사용자가 `firebase-messaging-sw.js`에 `install/activate` handler(`skipWaiting()` + `clients.claim()`)를 추가했다. 이 SW는 SvelteKit SW(`/service-worker.js`)와 동일 scope(`/`)로 등록되므로, FCM SW가 활성화되면 SvelteKit SW를 교체할 수 있다. SvelteKit SW가 제거되면 캐시·오프라인·reminder scheduling이 모두 깨진다. Phase 4 검증에서 반드시 SvelteKit SW 생존 여부를 확인해야 한다.
- **⚠️ 로컬 drift (review-plan 감지)**: `fcm.ts`에서 `navigator.serviceWorker.register('/firebase-messaging-sw.js')` 후 `navigator.serviceWorker.ready`를 사용하도록 변경됐다. `ready`는 현재 페이지를 control하는 SW의 registration을 반환하므로 FCM SW가 아닌 SvelteKit SW를 반환할 수 있다. `getToken(messaging, { serviceWorkerRegistration: registration })`에 잘못된 SW가 전달되면 FCM 토큰이 틀린 SW에 연결된다. Phase 4 검증에서 FCM 도메인 승인 후 토큰 등록 성공 여부와 함께 확인한다.

### 재검토 보강 (2026-04-23, /review-plan)

- 🟡 **SW race 범위 확대 필요**: 초안은 `registerRemindersToServiceWorker()`만 `activated` 대기를 추가하지만, 같은 파일에 `navigator.serviceWorker.ready`를 직접 호출하는 경로가 여러 개 있다. review 결과 본 plan은 공통 helper를 두고 모든 SW 메시지/조회 경로에 재사용하는 방향으로 보강한다.
- 🟡 **count 기반 reactive sync는 설계 결함**: `activeReminderCount`는 알림 개수가 같을 때 시각/제목/URL 변경을 감지하지 못한다. SW에 전달되는 실제 payload를 기준으로 `activeReminderSyncKey`를 계산해 전체 재등록을 트리거하도록 TODO를 교체한다.
- 🟡 **`controllerchange` 등록 타이밍 주의**: `onMount` 끝부분에서 listener를 붙이면 `handleUpdateCheck()` 이후 reload 직후 새 SW의 `clients.claim()` 이벤트를 놓칠 수 있다. listener는 `onMount` 진입 직후 등록하고, 메모 로드 전 발생한 이벤트는 pending flag로 흡수한다.
- 🟡 **archive 참조 반영**: `docs/archive/2026-02-02_PWA_NOTIFICATION_DEBUG_REPORT.md`는 이미 "retry 타이머"보다 "activated 대기"가 더 적절한 후보라고 정리했다. 본 plan은 재시도 루프를 새로 발명하지 않고 `activated` 대기 + early `controllerchange` hook + fingerprint 재등록으로 방향을 고정한다.
- 🟢 **로컬 drift 없음**: 기준커밋 `31ee2fb` 이후 현재 레포 변경은 `TODO.md`와 본 계획서 2개 문서뿐이다. 구현 대상 코드(`fcm.ts`, `notifications.svelte.ts`, `+layout.svelte`)에는 로컬 drift가 없어 재검토 실패 사유는 없다.
- 🟢 **연관 active plan 충돌 없음**: `realign-fcm-to-wservice-crossnoti`는 완료 상태이고, 본 plan은 그 산출물인 `MANUAL_TASKS.md` 2026-04-23 섹션에 체크박스를 추가하는 수준으로만 접촉한다. 별도 active plan 본문 수정은 하지 않는다.

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 메타 슬롯과 owner 경계를 유지한다** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-23_fix-sw-update-alarm-lost.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 빈 값으로 유지한다. 값 채우기/재개 판단은 `/implement` owner가 수행한다.
   - [ ] worktree 생성 또는 재개 절차는 현재 plan 구현 범위에서 제외하고, `/implement` 또는 plan-runner owner flow가 담당한다.
   - [ ] 구현 시작 전 현재 cwd가 `memo-alarm` worktree인지 확인하는 owner step을 유지하고, root(main)의 기존 dirty/untracked 파일은 본 plan 수정 범위에서 제외한다.

### Phase 1: FCM 도메인 미승인 에러 처리 개선

1. - [ ] **`registerFCMToken()`에서 Firebase Installations 도메인 미승인 신호를 정규화한다**
   - [ ] `src/lib/fcm.ts`: `catch (error)` 블록에서 `FirebaseError`의 `code`, `message`, `customData?.serverResponse`를 각각 읽는 로컬 변수를 추가한다.
   - [ ] `src/lib/fcm.ts`: `installations/request-failed` + `INVALID_ARGUMENT`/`authorized domains`/`memo.woory.day` 패턴이 함께 보이면 `console.error('[FCM] Domain not authorized in Firebase Console — add memo.woory.day to Authentication > Authorized Domains for wservice-cross-noti', error)`를 출력한다.
   - [ ] `src/lib/fcm.ts`: 도메인 미승인 분기와 일반 실패 분기를 나누더라도 반환값은 계속 `null`로 유지해 기존 실패 처리 계약을 깨지 않는다.

2. - [ ] **`MANUAL_TASKS.md`의 기존 2026-04-23 섹션에 Firebase 도메인 승인 작업을 합친다**
   - [ ] `MANUAL_TASKS.md`: 기존 `## 2026-04-23: Cloudflare 환경변수 업데이트 (wservice-cross-noti 전환)` 섹션 바로 아래에 "Firebase Console 도메인 승인" 소제목을 추가한다.
   - [ ] `MANUAL_TASKS.md`: `memo.woory.day`를 `Authentication > Authorized domains`에 추가하는 체크박스를 1개 추가한다.
   - [ ] `MANUAL_TASKS.md`: 이 작업이 Cloudflare env 교체와는 별개의 선행 수동 조치라는 메모를 한 줄 추가한다.

### Phase 2: SW "activating" race 공통 방어

3. - [ ] **`notifications.svelte.ts`에 activated SW 확보 helper를 추가한다**
   - [ ] `src/lib/stores/notifications.svelte.ts`: 모듈 최상단(`createNotificationStore()` 바깥)에 `async function awaitActivatedServiceWorker(): Promise<ServiceWorker | null>` helper를 정의한다 — `navigator.serviceWorker.ready`로 registration을 얻은 뒤 `active`를 반환하는 module-level 유틸리티다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: helper에서 `registration.active`가 없으면 `null`을 반환하고, 기존 caller가 동일하게 early return 할 수 있게 계약을 고정한다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: helper에서 `active.state === 'activating'`이면 `statechange` once listener로 `activated`가 될 때까지 대기하고, 이미 `activated`면 즉시 반환한다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: `statechange` 대기에 8초 timeout을 추가한다 — timeout 초과 시 `null`을 반환해 무한 pending을 방지한다. SW activation이 실패하거나 SW가 terminated된 경우 caller는 early return하도록 한다.

4. - [ ] **모든 SW 메시지/조회 경로가 공통 helper를 재사용하도록 교체한다**
   - [ ] `src/lib/stores/notifications.svelte.ts`: `registerRemindersToServiceWorker()`가 직접 `navigator.serviceWorker.ready`를 호출하지 말고 공통 helper 반환값을 사용해 `postMessage` 하도록 바꾼다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: `updateReminderInServiceWorker()`와 `removeReminderFromServiceWorker()`도 동일 helper를 사용하도록 바꾼다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: `getServiceWorkerScheduleStatus()`와 `cleanup()`의 `ready` 호출도 같은 helper 또는 동일한 activated guard를 재사용하게 맞춘다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: 이번 race 보강은 SW에 `postMessage`/상태 조회를 보내는 경로에만 적용하고, `showNotification()`의 `registration.showNotification()` 경로는 범위 밖으로 유지한다.

### Phase 3: layout 기반 전체 재등록 보강

5. - [ ] **SW 전체 재등록 기준이 되는 reminder fingerprint를 노출한다**
   - [ ] `src/lib/stores/notifications.svelte.ts`: `activeReminderMemos`를 순회해 `memoId`, `reminderId`, `time`, `type`, `days`, `date`, `title`, `body`, `url`, `autoOpen`을 직렬화한 `activeReminderSyncKey` derived 값을 추가한다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: `days` 배열은 정렬 후 직렬화해 순서 차이만으로 false positive가 나지 않게 한다.
   - [ ] `src/lib/stores/notifications.svelte.ts`: `createNotificationStore` 반환 객체에 `get activeReminderSyncKey()` getter를 추가해 `+layout.svelte`가 직접 구독할 수 있게 한다.

6. - [ ] **`+layout.svelte`에 SW sync state와 공통 trigger 함수를 추가한다**
   - [ ] `src/routes/+layout.svelte`: `onDestroy` import를 추가한다.
   - [ ] `src/routes/+layout.svelte`: 컴포넌트 top-level에 `lastReminderSyncKey`, `pendingControllerResync` 같은 state를 추가해 초기 load 전후를 구분한다.
   - [ ] `src/routes/+layout.svelte`: `syncRemindersToSw(reason)` helper를 추가해 `browser`, `memosStore.initialized`, `memosStore.loading`를 확인한 뒤 `notificationStore.registerRemindersToServiceWorker()`를 호출하고 마지막 sync key를 갱신한다.

7. - [ ] **`controllerchange` 리스너를 awaited init보다 먼저 등록하고 해제한다**
   - [ ] `src/routes/+layout.svelte`: `onMount` 진입 직후 `navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)`를 등록한다.
   - [ ] `src/routes/+layout.svelte`: `handleControllerChange`는 메모 로드 전이면 `pendingControllerResync = true`만 기록하고, 로드 후면 `syncRemindersToSw('controllerchange')`를 호출하게 만든다.
   - [ ] `src/routes/+layout.svelte`: `onDestroy`에서 같은 handler를 `removeEventListener`로 해제한다.

8. - [ ] **초기 메모 로드 완료 직후 1회 전체 재등록을 보장한다**
   - [ ] `src/routes/+layout.svelte`: `await memosStore.init()` 직후 기존 직접 호출 대신 `syncRemindersToSw('initial-load')`를 호출한다.
   - [ ] `src/routes/+layout.svelte`: auth callback skip 경로에서는 `memosStore.init()`이 실행되지 않으므로 initial sync도 건너뛰게 guard를 유지한다.
   - [ ] `src/routes/+layout.svelte`: 메모 로드 전 발생해 누적된 `pendingControllerResync`가 있으면 initial sync 직후 소모되도록 처리한다.

9. - [ ] **reminder fingerprint 변화 시 전체 재등록한다**
   - [ ] `src/routes/+layout.svelte`: `$effect`에서 `notificationStore.activeReminderSyncKey`를 읽는 reactive path를 추가한다.
   - [ ] `src/routes/+layout.svelte`: `memosStore.initialized && !memosStore.loading && syncKey !== lastReminderSyncKey`면 `syncRemindersToSw('reminder-change')`를 호출하도록 만든다.
   - [ ] `src/routes/+layout.svelte`: `syncKey === ''`로 바뀌는 경우에도 SW에 빈 배열이 다시 등록돼 기존 scheduled reminders가 제거되도록 empty-key 전환을 별도 허용한다.

### Phase 4: 수동 검증 (앱 업데이트 + same-count 변경)

10. - [ ] **앱 업데이트 버튼 경로에서 SW 재등록이 회복되는지 확인한다**
   - [ ] 브라우저 DevTools > Application > Service Workers 의 "Update" 또는 설정 페이지의 앱 업데이트 버튼(`handleUpdateCheck`)을 사용해 SW를 교체한다.
   - [ ] 콘솔에서 `[Notification] 📤 Registering N reminders to SW` 로그가 `N > 0`으로 다시 출력되는지 확인한다 (활성 알림 메모가 있을 때).
   - [ ] 콘솔에서 `[Notification] ✅ SW ready, state: activated` 로그가 보이고, settings devMode의 SW schedule status에 reminders 개수가 0이 아닌 값으로 표시되는지 확인한다.

11. - [ ] **알림 개수는 같고 payload만 바뀌는 케이스를 수동 검증한다**
   - [ ] 기존 활성 알림 1개의 시간을 바꾸고, 개수 변화 없이 `activeReminderSyncKey` 기반 재등록이 일어나는지 콘솔에서 확인한다.
   - [ ] 제목/본문/URL만 바꾸고 알림 개수는 유지한 뒤 SW에 새 payload가 반영되는지 확인한다.
   - [ ] 마지막 활성 알림을 비활성화해 `syncKey === ''`가 되는 경우 SW schedule status가 0개로 비워지는지 확인한다.

12. - [ ] **Firebase 도메인 승인 후 FCM 토큰 회복을 확인한다**
   - [ ] Firebase Console > Authentication > Authorized Domains에 `memo.woory.day`를 추가한 뒤 앱을 재로드한다.
   - [ ] 콘솔에서 `INVALID_ARGUMENT` 또는 Installations 400 에러가 더 이상 발생하지 않는지 확인한다.
   - [ ] 토큰 등록 성공 후 settings devMode의 활성 토큰 수 또는 project marker가 정상 상태로 회복되는지 확인한다.
   - [ ] DevTools > Application > Service Workers에서 SvelteKit SW(`/service-worker.js`)와 FCM SW(`/firebase-messaging-sw.js`) 각각의 상태를 확인한다 — SvelteKit SW가 activated & running 상태여야 하고 FCM SW가 이를 교체하지 않았는지 검증한다.

### Phase R: 재발 경로 분석 (fix: plan 필수)

13. - [ ] **SW/FCM 재발 경로를 전수 열거한다**
   - [ ] `src/lib/stores/notifications.svelte.ts`의 `navigator.serviceWorker.ready`/`postMessage` 호출 경로, `src/routes/+layout.svelte`의 초기 등록 경로, `src/routes/settings/+page.svelte`의 수동 등록/업데이트 경로를 목록화한다.
   - [ ] 각 경로별로 `activated helper`, `controllerchange early hook`, `activeReminderSyncKey`, `manual Firebase domain approval` 중 어떤 방어가 적용되는지 표로 정리한다.
   - [ ] `docs/archive/2026-02-02_PWA_NOTIFICATION_DEBUG_REPORT.md`의 retry/timeout 후보와 비교해, 이번 plan이 `activated` 대기 + early event hook을 채택하는 이유를 한 줄 근거로 남긴다.

14. - [ ] **미방어 경로가 발견되면 본 plan 범위 안에서 즉시 흡수한다**
   - [ ] helper가 적용되지 않은 `navigator.serviceWorker.ready` + `postMessage` 경로가 남아 있으면 Phase 2 하위 항목으로 되돌려 추가한다.
   - [ ] `activeReminderSyncKey`에 빠진 payload 필드가 발견되면 Phase 3 직렬화 항목에 즉시 추가한다.
   - [ ] 구현 전 최종 검토 시 `방어 경로 N/N` 결과를 기술적 고려사항 또는 검증 메모에 기록하고, "근본 수정" 표현은 사용하지 않는다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

15. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] `npm run check` (타입 체크)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:`)

> Python 백엔드 변경이 아니므로 expand-todo의 T1~T5 강제 테스트 블록은 적용 대상이 아니다. 본 plan은 브라우저/DevTools 수동 검증을 Phase 4로 유지한다.

## Phase 요약

- Phase 0: Worktree 준비 — 1개 상위 작업 / 3개 원자 작업
- Phase 1: FCM 도메인 미승인 에러 처리 개선 — 2개 상위 작업 / 6개 원자 작업
- Phase 2: SW "activating" race 공통 방어 — 2개 상위 작업 / 8개 원자 작업
- Phase 3: layout 기반 전체 재등록 보강 — 5개 상위 작업 / 15개 원자 작업
- Phase 4: 수동 검증 (앱 업데이트 + same-count 변경) — 3개 상위 작업 / 10개 원자 작업
- Phase R: 재발 경로 분석 — 2개 상위 작업 / 6개 원자 작업
- Phase Z: Post-Merge Cleanup — 1개 상위 작업 / 6개 원자 작업

총 16개 상위 작업 / 54개 원자 작업

---

*상태: 검토완료 | 진행률: 0/16 (0%)*
