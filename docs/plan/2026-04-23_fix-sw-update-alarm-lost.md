# SW 업데이트 후 알림 소실 수정

> 작성일시: 2026-04-23 15:30
> 기준커밋: 31ee2fb
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/16 (0%)
> 요약: 앱 업데이트 버튼(SW unregister) 이후 알람 실행 불가 — SW 재등록 시 reminders 0개 등록, FCM 토큰 400 실패를 유발하는 4가지 결함 동시 수정

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
> 체크리스트: `MANUAL_TASKS.md` > "2026-04-23: Cloudflare 환경변수 업데이트" 섹션 하단에 추가

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

### RC-D 상세

앱 업데이트(SW unregister → 새 SW install → activate → `clients.claim()`) 후, 새 SW가 페이지를 control하는 순간(`controllerchange` 이벤트)에 reminders를 재전송하는 코드가 없음. `onMount`의 1회성 등록은 이미 지나간 후다.

## 기술적 고려사항

- RC-A 코드 수정: `registerFCMToken`에서 `INVALID_ARGUMENT` 에러 구분 → 구체적 경고 메시지 출력 (도메인 승인 안내)
- RC-B 수정: SW state가 "activating"이면 `statechange` 이벤트로 "activated" 대기 후 postMessage
- RC-C 수정: `+layout.svelte`에 `$effect`로 `memosStore.initialized && !memosStore.loading` 감지 → `registerRemindersToServiceWorker()` 재호출. 중복 방지를 위해 "초기 1회" 플래그 사용.
- RC-D 수정: `navigator.serviceWorker.addEventListener('controllerchange', ...)` → `registerRemindersToServiceWorker()` 호출. `onMount`에서 등록하고 `onDestroy`에서 해제.
- RC-B/D는 `notifications.svelte.ts` 내부에서 수정 (store 레벨), RC-C/D 일부는 `+layout.svelte`에서 수정 (컴포넌트 레벨)
- `$effect`는 컴포넌트 초기화 시점에만 사용 가능 → RC-C를 `+layout.svelte` 컴포넌트 안에서 처리

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-23_fix-sw-update-alarm-lost.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯 유지 (blank = 신규 초기 상태, 기존 `impl/*` 잔여와 무관)
   - [ ] worktree 생성 또는 재개는 `/implement` 또는 plan-runner owner flow가 수행
   - [ ] worktree cwd 고정 확인

### Phase 1: FCM 도메인 미승인 에러 처리 개선

1. - [ ] **`registerFCMToken`에 INVALID_ARGUMENT 에러 분기 추가** — FCM 도메인 미승인 시 명확한 경고 제공
   - [ ] `src/lib/fcm.ts`: `catch (error)` 블록에서 `error.code === 'installations/request-failed'` 또는 에러 메시지에 `INVALID_ARGUMENT` 포함 시 `console.error('[FCM] Domain not authorized in Firebase Console — add memo.woory.day to Authentication > Authorized Domains for wservice-cross-noti', error)` 출력
   - [ ] `src/lib/fcm.ts`: 위 분기에서 `return null` (기존 동작 유지, 앱 크래시 없음)

2. - [ ] **MANUAL_TASKS.md에 Firebase 도메인 승인 체크박스 추가** — 수동 조치 추적
   - [ ] `MANUAL_TASKS.md`: "2026-04-23: Firebase Console — wservice-cross-noti 도메인 승인" 섹션 추가, `memo.woory.day`를 Authentication > Authorized Domains에 추가하는 체크박스 기재

### Phase 2: SW "activating" race 수정

3. - [ ] **`registerRemindersToServiceWorker`에 SW activated 대기 로직 추가**
   - [ ] `src/lib/stores/notifications.svelte.ts`: `registerRemindersToServiceWorker` 내부, `registration.active` null 체크 이후에 `registration.active.state === 'activating'` 분기 추가
   - [ ] `src/lib/stores/notifications.svelte.ts`: activating 상태면 `await new Promise<void>(resolve => { registration.active!.addEventListener('statechange', () => { if (registration.active?.state === 'activated') resolve(); }, { once: true }); })` 로 "activated" 대기
   - [ ] `src/lib/stores/notifications.svelte.ts`: 대기 후 기존 `registration.active.postMessage(...)` 호출 (로직 변경 없음)

### Phase 3: Supabase 동기화 후 reactive 재등록

4. - [ ] **`+layout.svelte`에 memos 동기화 완료 감지 `$effect` 추가**
   - [ ] `src/routes/+layout.svelte`: `onMount` 블록 밖(컴포넌트 초기화 레벨)에 `let swRegisteredAfterSync = $state(false)` 선언
   - [ ] `src/routes/+layout.svelte`: `$effect(() => { if (memosStore.initialized && !memosStore.loading && !swRegisteredAfterSync) { swRegisteredAfterSync = true; notificationStore.registerRemindersToServiceWorker(); } })` 추가 — 초기 Supabase 동기화 완료 후 1회 재등록, 중복 방지 플래그

5. - [ ] **`activeReminderMemos` 변화 감지 reactive 재등록 추가** (수 변화 시 SW 동기화)
   - [ ] `src/routes/+layout.svelte`: `let lastReminderCount = $state(-1)` 선언
   - [ ] `src/routes/+layout.svelte`: `$effect(() => { const count = notificationStore.activeReminderCount; if (memosStore.initialized && count !== lastReminderCount && lastReminderCount !== -1) { lastReminderCount = count; notificationStore.registerRemindersToServiceWorker(); } else { lastReminderCount = count; } })` 추가
   - [ ] `src/lib/stores/notifications.svelte.ts`: `createNotificationStore` 반환 객체에 `get activeReminderCount() { return activeReminderMemos.length; }` 추가 (외부에서 구독 가능하도록)

### Phase 4: SW controllerchange 기반 자동 재등록

6. - [ ] **`controllerchange` 이벤트 리스너로 SW 교체 후 재등록 트리거**
   - [ ] `src/routes/+layout.svelte`: `onMount` 내부에 `const handleControllerChange = () => { notificationStore.registerRemindersToServiceWorker(); }; navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)` 등록
   - [ ] `src/routes/+layout.svelte`: `onDestroy` 추가 (없으면 신규 import) + `navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange)` 등록 — 메모리 누수 방지

### Phase 5: 수동 검증 (앱 업데이트 시나리오)

7. - [ ] **SW 교체 후 reminders 재등록 확인**
   - [ ] 브라우저 DevTools > Application > Service Workers 에서 "Update" 클릭 (또는 앱 업데이트 버튼)
   - [ ] 콘솔에서 `[Notification] 📤 Registering N reminders to SW` 로그가 `N > 0`으로 출력되는지 확인 (알람 설정된 메모가 있을 때)
   - [ ] `[Notification] ✅ SW ready, state: activated` (activating이 아닌 activated)로 변경됐는지 확인

8. - [ ] **FCM 토큰 등록 성공 확인** (Firebase Console 도메인 승인 후)
   - [ ] Firebase Console > Authentication > Authorized Domains에 `memo.woory.day` 추가된 상태에서 앱 재로드
   - [ ] 콘솔에서 `INVALID_ARGUMENT` 에러 미발생, FCM 토큰 등록 성공 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] `npm run check` (타입 체크)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:`)

> T4/T5 해당 없음: Python 백엔드 변경 없음. Svelte/TypeScript + Service Worker 수정만 포함. 수동 검증(Phase 5)으로 대체.

---

*상태: 초안 | 진행률: 0/16 (0%)*
