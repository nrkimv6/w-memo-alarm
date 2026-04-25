# FCM Service Worker scope 분리 — SvelteKit SW 충돌 해소

> 작성일시: 2026-04-25 12:00
> 기준커밋: 0fa7020
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/17 (0%)
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

- `static/firebase-messaging-sw.js:47`: `self.registration.showNotification(...)` — FCM push notification 표시 담당
- `src/service-worker.ts:608`: `sw.addEventListener('notificationclick', ...)` — 알림 클릭 핸들러. FCM SW와 분리되어 있어 클릭 이벤트가 어느 SW에 도달할지 비결정적
- SvelteKit은 `src/service-worker.ts`를 `/service-worker.js` (또는 hash 버전)으로 빌드하고 scope `/`로 자동 등록함
- FCM SW는 `static/firebase-messaging-sw.js`를 그대로 제공하고 scope `/`로 등록됨
- 분리 방안 A: FCM SW에 `scope` 옵션 지정 (`/firebase-messaging/`) → FCM push만 별도 scope에서 처리
- 분리 방안 B: FCM push 처리를 SvelteKit SW 내부로 이관 → SW 1개로 통합
- 방안 B는 `importScripts()` 또는 `onpush` 이벤트 통합이 필요하며 VAPID 키 접근 방식도 변경 필요

---

## TODO

### Phase 1: 현황 파악 및 방안 선택

1. [ ] **현재 SW scope 충돌 상태를 코드 기준으로 확인** — 분리 방안 결정 근거 수집
   - [ ] `src/lib/fcm.ts:119-121`: FCM SW 등록 코드와 scope 옵션 유무 확인
   - [ ] `src/service-worker.ts`: SvelteKit SW의 push/notificationclick 핸들러 목록 확인
   - [ ] `static/firebase-messaging-sw.js`: FCM SW의 push/notificationclick 핸들러 목록 확인
   - [ ] `docs/plan/2026-04-25_fix-fcm-sw-scope-conflict.md`: 방안 A vs B 선택 근거와 결정 사항을 기록한다

### Phase 2: scope 분리 구현 (방안 A: FCM SW scope 제한)

2. [ ] **FCM SW를 `/firebase-messaging/` scope로 제한해 root scope 경쟁 제거** — 방안 A 선택 시
   - [ ] `src/lib/fcm.ts:120`: `register('/firebase-messaging-sw.js', { scope: '/firebase-messaging/' })` 옵션 추가
   - [ ] `static/firebase-messaging-sw.js`: push/notificationclick 이벤트 처리가 제한된 scope에서도 동작하는지 확인 (fetch event 없어도 push/notification은 scope 무관하게 작동함)
   - [ ] `src/service-worker.ts`: root scope SW의 push 이벤트 핸들러가 FCM push를 수신하지 못하는 상황 방지 여부 확인

### Phase 3: push 알림 동작 검증

3. [ ] **scope 분리 후 FCM push 알림이 정상 동작하는지 확인** — 회귀 방지
   - [ ] Chrome DevTools → Application → Service Workers에서 SW 1개(SvelteKit)만 root scope에 표시되는지 확인
   - [ ] FCM 토큰 재등록 필요 여부 확인 (scope 변경 시 기존 토큰 무효화 가능)
   - [ ] 실기기에서 push 알림 수신 및 클릭 동선 수동 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] worktree remove, branch remove, header meta 제거

---

*상태: 초안 | 진행률: 0/17 (0%)*
