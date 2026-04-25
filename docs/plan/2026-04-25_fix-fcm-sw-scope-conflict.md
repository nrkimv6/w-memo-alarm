# FCM Service Worker scope 분리 — SvelteKit SW 충돌 해소

> 작성일시: 2026-04-25 12:00
> 기준커밋: 0fa7020
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/39 (0%)
> 출처: /reflect에서 자동 생성
> 요약: `firebase-messaging-sw.js`가 root scope(`/`)에 등록되어 SvelteKit SW(`service-worker.js`)와 scope가 겹친다. 두 SW가 동일 scope에서 경쟁하면 fetch 가로채기가 비결정적이 되고, Safe Browsing 진단에 혼탁 요인이 된다. scope 분리 또는 FCM 처리를 SvelteKit SW로 통합하여 SW가 1개만 root scope를 제어하도록 한다.

---

## 개요

`src/lib/fcm.ts:120`에서 `navigator.serviceWorker.register('/firebase-messaging-sw.js')`로 FCM SW를 root scope(`/`)에 등록한다. SvelteKit의 `service-worker.ts`도 동일하게 root scope에 등록된다.

두 SW가 root scope에서 경쟁할 때:
- 마지막 등록/활성화된 SW가 fetch를 가로챔 → 캐시 전략 비결정적
- Chrome DevTools → Application → Service Workers에 2개 표시 → Safe Browsing 크롤러 진단 혼탁
- FCM push가 SvelteKit SW로 전달되지 않을 수 있음 (FCM SW가 VAPID 기반 push 처리)

## 기술적 고려사항

- `src/lib/fcm.ts:120-121`은 `navigator.serviceWorker.register('/firebase-messaging-sw.js')` 뒤에 `navigator.serviceWorker.ready`를 사용한다. MDN 기준 `ready`는 **현재 페이지와 연결된 registration**을 반환하므로, FCM SW scope를 `/firebase-messaging/`로 좁히면 계속 root scope SvelteKit SW를 돌려줄 수 있다.
- Firebase `getToken()`은 `serviceWorkerRegistration`을 명시적으로 받을 수 있다. 따라서 scope 분리 방안 A를 택하면 `register()`가 반환한 FCM registration을 직접 넘기고, 그 registration이 `active` 상태가 될 때까지 별도 대기해야 한다.
- `static/firebase-messaging-sw.js:7-13`의 `skipWaiting()` + `clients.claim()`은 root scope(`/`)일 때 SvelteKit SW를 밀어낼 수 있지만, scope를 `/firebase-messaging/`로 제한하면 `/` 문서를 더는 control하지 못한다.
- `src/service-worker.ts:107-148,159-177,608-662`는 root scope SW의 `fetch`, `push`, `notificationclick`, reminder scheduling을 담당한다. 이번 fix는 이 계약을 깨지 않고 root scope를 SvelteKit SW 1개로 고정해야 한다.
- 기존 archive `docs/archive/2026-04-23_fix-sw-update-alarm-lost.md:80-81`, `docs/archive/2026-04-24_fix-google-login-regression.md:24-28`, `docs/archive/2026-04-25_fix-safe-browsing-deceptive-site.md:80`가 이미 동일한 root scope 충돌 위험을 기록했다. 이번 plan은 그 근거를 재사용하고 수정 범위를 `src/lib/fcm.ts` 중심으로 제한한다.
- 수동 검증에는 이미 있는 개발자 도구 UI를 재사용할 수 있다: `src/lib/components/settings/dev/DevFcmStatusSection.svelte`(토큰 등록/상태)와 `src/lib/components/settings/dev/DevWebServiceWorkerNotificationSection.svelte`(root SW 상태/테스트 알림).

---

## TODO

### Phase 1: 현황 파악 및 방안 선택

1. - [ ] **현재 SW 등록/제어 관계를 코드 기준으로 확정한다** — 분리 설계 입력
   - [ ] `src/lib/fcm.ts:103-131`: `registerFCMToken()`이 `register()` 반환값을 버리고 `navigator.serviceWorker.ready`를 사용하는 현재 흐름을 기록한다.
   - [ ] `src/service-worker.ts:107-148,159-177,608-662`: root scope SvelteKit SW가 `fetch`, `push`, `notificationclick`를 함께 처리한다는 점을 표로 정리한다.
   - [ ] `static/firebase-messaging-sw.js:7-25,82-120`: FCM SW가 `install/activate`, `onBackgroundMessage`, `notificationclick`를 가진 별도 root-scope registration임을 기록한다.

2. - [ ] **분리 방안과 acceptance를 문서에 고정한다** — A/B 선택 확정
   - [ ] `docs/plan/2026-04-25_fix-fcm-sw-scope-conflict.md`: 방안 A를 1순위로 명시한다. `firebase-messaging-sw.js`를 `/firebase-messaging/` scope로 등록하고 `getToken()`에는 그 registration을 명시적으로 전달한다.
   - [ ] `docs/plan/2026-04-25_fix-fcm-sw-scope-conflict.md`: 방안 B는 `src/service-worker.ts`에 Firebase SDK 번들링과 push 라우팅 통합이 필요해 범위가 커지므로 후속안으로만 남긴다.
   - [ ] `docs/plan/2026-04-25_fix-fcm-sw-scope-conflict.md`: 완료 기준을 "root scope를 제어하는 SW는 SvelteKit 1개, FCM push/notificationclick는 별도 registration이 담당"으로 고정한다.

### Phase 2: scope 분리 구현 (방안 A: FCM SW scope 제한)

3. - [ ] **FCM registration을 명시적으로 생성하고 활성화까지 기다린다** — `ready` 오사용 제거
   - [ ] `src/lib/fcm.ts`: `navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-messaging/' })` 반환값을 `fcmRegistration` 변수로 저장한다.
   - [ ] `src/lib/fcm.ts`: `navigator.serviceWorker.ready` 대신 `fcmRegistration.active` 또는 `installing.statechange`를 기다리는 helper를 추가해 FCM registration이 `active` 상태가 된 뒤 다음 단계로 진행한다.
   - [ ] `src/lib/fcm.ts`: `getToken(messaging, { vapidKey: PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: fcmRegistration })`로 명시 전달한다.

4. - [ ] **기존 root scope SW 계약을 유지한다** — 메모 알림/캐시 회귀 방지
   - [ ] `static/firebase-messaging-sw.js`: `onBackgroundMessage`와 `notificationclick`가 fetch 핸들러 없이도 FCM 전용 worker로 유지되도록 scope 변경 외 동작은 건드리지 않는다.
   - [ ] `src/service-worker.ts`: root scope SW의 `fetch`, `push`, `notificationclick`, reminder scheduling 경로를 수정 대상에서 제외한다고 plan 본문에 명시한다.
   - [ ] `docs/plan/2026-04-25_fix-fcm-sw-scope-conflict.md`: `clients.claim()`/`skipWaiting()`이 남더라도 root page를 더는 control하지 않는다는 검증 포인트를 추가한다.

### Phase 3: push 알림 동작 검증

5. - [ ] **개발자 UI와 브라우저 등록 정보를 함께 확인한다** — 수동 검증 경로 고정
   - [ ] `src/lib/components/settings/dev/DevFcmStatusSection.svelte` 기준으로 수동 FCM 토큰 등록 후 성공 여부와 active token 갱신을 확인한다.
   - [ ] `src/lib/components/settings/dev/DevWebServiceWorkerNotificationSection.svelte` 기준으로 root SW 테스트 알림이 계속 동작하는지 확인한다.
   - [ ] 브라우저 DevTools 또는 `navigator.serviceWorker.getRegistrations()`로 `/`는 SvelteKit SW, `/firebase-messaging/`는 FCM SW로 분리됐는지 확인한다.

6. - [ ] **FCM push 수신과 클릭 동선을 회귀 확인한다** — 사용자 체감 동작 검증
   - [ ] 포그라운드 `onMessage` 수신 시 기존 `new Notification(...)` 경로가 유지되는지 확인한다.
   - [ ] 백그라운드 FCM push 수신 시 `static/firebase-messaging-sw.js`의 병합/단일 알림 표시가 유지되는지 실기기 또는 브라우저 수동 검증한다.
   - [ ] FCM 알림 클릭 시 `/?memo=...` 또는 병합 알림 홈 진입이 기존과 동일한지 확인한다.
   - [ ] scope 변경 뒤 기존 토큰이 재사용되는지, 실패 시 재등록이 필요한지 기록한다.

### Phase R: 재발 경로 분석 (fix: plan 필수)

7. - [ ] **SW registration 참조 경로를 전수 열거한다**
   - [ ] `rg -n "firebase-messaging-sw|navigator\\.serviceWorker\\.ready|serviceWorkerRegistration" src static docs` 결과에서 FCM 전용 등록 경로와 root SW 전용 경로를 분류한다.
   - [ ] `src/routes/+layout.svelte`, `src/lib/components/settings/dev/DevFcmStatusSection.svelte`: `registerFCMToken()` 호출부는 수정 후에도 별도 변경 없이 새 registration 흐름을 타는지 확인한다.
   - [ ] `src/lib/stores/notifications.svelte`, `src/lib/components/settings/dev/DevWebServiceWorkerNotificationSection.svelte`: `navigator.serviceWorker.ready` 사용이 root SvelteKit SW 전용임을 표로 남긴다.

8. - [ ] **미방어 경로를 보정하거나 범위 제외를 명시한다**
   - [ ] FCM SW를 직접 root scope로 다시 등록하는 코드/문서가 남아 있으면 현재 plan 범위에서 제거 또는 수정 대상으로 승격한다.
   - [ ] `auth/callback`, todo notification 등 다른 root SW fix plan과 충돌이 없도록 "이번 fix는 FCM registration scope 분리만 담당" 문구를 plan 본문에 남긴다.
   - [ ] 모든 경로에 대해 `방어 완료` 또는 `범위 제외` 근거를 결과 표로 기록한다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거

---

*상태: 검토완료 | 진행률: 0/39 (0%)*
