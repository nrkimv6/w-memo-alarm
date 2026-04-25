# fix: waitForFCMActivation 타임아웃·redundant 처리 추가 — SW 미활성 행업 방지

> 작성일시: 2026-04-25 16:00
> 기준커밋: 74c4a78
> 대상 프로젝트: memo-alarm
> 상태: 보류
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/16 (0%)
> 출처: /reflect에서 자동 생성
> 보류사유: 가상 시나리오 방어 — 실제 행업/타임아웃 보고 0건. 회귀 아님(기존 `navigator.serviceWorker.ready`도 무타임아웃). `'redundant'` 발생 가능성 거의 없음(고유 scope 단독 등록). 실제 이슈 발생 시 활성화하거나 다음 fcm.ts 변경 시 끼워서 처리. 활성화 트리거: SW activation 행업 사용자 보고, 또는 `awaitActivatedServiceWorker()` vs `waitForFCMActivation()` 패턴 통일 의사결정.
> 요약: `waitForFCMActivation()`에 타임아웃과 `'redundant'` 상태 처리가 없어, FCM SW 설치가 실패하거나 지연될 경우 `registerFCMToken()`이 무한 대기 상태에 빠질 수 있다. 또한 `registration.active`가 `'activating'` 상태이고 `installing/waiting`이 null인 경우 즉시 리턴하여 활성화 전 SW로 `getToken()`이 진행되는 엣지 케이스가 있다. 기존 `awaitActivatedServiceWorker()` 패턴(8초 타임아웃 + `redundant` 처리)과 통일한다.

---

## 개요

`src/lib/fcm.ts:101-114`에 추가된 `waitForFCMActivation()`은 FCM SW가 `activated` 상태가 될 때까지 대기하지만:

1. **타임아웃 없음**: SW 설치 실패(`'redundant'` 상태) 또는 무기한 지연 시 Promise가 resolve되지 않아 `registerFCMToken()`이 행업된다.
2. **`'redundant'` 상태 미처리**: `sw.state === 'redundant'`가 되면 `statechange` 이벤트가 발생해도 `'activated'` 조건을 통과하지 못하고 이벤트 리스너만 남는다.
3. **`'activating'` + null 엣지 케이스**: `registration.active?.state !== 'activated'`이면서 `installing/waiting`이 null이면 즉시 리턴해 활성화 미완료 SW로 `getToken()`이 진행된다.

비교 대상: `src/lib/stores/notifications.svelte.ts:35-60`의 `awaitActivatedServiceWorker()`:
- 8초 타임아웃 → `null` 반환
- `'redundant'` 상태 → 즉시 `null` 반환
- 타임아웃/redundant 시 `registerFCMToken()`이 에러 경로로 자연 처리됨

## 기술적 고려사항

- `waitForFCMActivation()`이 타임아웃 시 `throw new Error('FCM SW activation timeout')`로 상위를 reject하거나, 반환값을 `Promise<boolean>`으로 변경해 호출부에서 조기 종료 경로를 제공해야 한다.
- `registration.active` 가 `'activating'` 상태이고 `installing/waiting` 이 null인 경우, `sw`를 `registration.installing ?? registration.waiting ?? registration.active`로 폴백하면 `'activating'` → `'activated'` 전환을 추적할 수 있다.
- `awaitActivatedServiceWorker()`의 8초 타임아웃을 동일하게 적용한다. (FCM SW는 fetch 핸들러가 없어 상대적으로 단순하므로 8초면 충분)
- 타임아웃/redundant 경로에서 `resolve(void)` 대신 `reject(new Error('FCM SW activation timeout/redundant'))`를 사용하면, 외부 `registerFCMToken()`의 try/catch가 잡아 `null`을 반환하는 더 명확한 실패 경로가 생긴다. `resolve(void)` 방식은 이후 `getToken()`이 silently fail 할 수 있으므로 `reject` 방식을 우선 검토한다.
- 프로덕션 환경에서 동일 에러 재현 여부를 먼저 확인하고, placeholder/fallback이 런타임 동작을 바꾸지 않는지 검증한다.

---

## TODO

### Phase 1: `waitForFCMActivation` 수정

1. - [ ] **타임아웃 + redundant + activating 엣지 케이스를 처리한다** — `src/lib/fcm.ts`
   - [ ] `src/lib/fcm.ts:101-114`: `waitForFCMActivation(registration)` 함수 본체를 아래 계약으로 교체한다.
     - `registration.active?.state === 'activated'` → 즉시 return ✓ (기존 유지)
     - `sw = registration.installing ?? registration.waiting ?? registration.active` — activating 상태 active도 추적
     - `sw`가 null → 즉시 return (기존 유지)
     - 8초 타임아웃: `setTimeout(() => { sw.removeEventListener(...); resolve(); }, 8000)` — timeout 시 resolve(void)로 처리하고 호출부의 `getToken()` 실패에 맡긴다
     - `sw.state === 'redundant'` → `clearTimeout`/이벤트 제거 후 즉시 resolve(void) (행업 방지)
     - `sw.state === 'activated'` → `clearTimeout`/이벤트 제거 후 resolve(void) (기존 성공 경로)
   - [ ] `src/lib/fcm.ts`: 타임아웃 또는 redundant 경로에서 `console.warn('[FCM] SW activation timeout or redundant — proceeding with getToken')` 로그 추가

### Phase 2: 수동 검증

2. - [ ] **브라우저에서 행업 방지 동작을 확인한다** — 수동
   - [ ] DevFcmStatusSection에서 FCM 토큰 등록 후 정상 완료 여부 확인 (타임아웃 없이 정상 등록)
   - [ ] 브라우저 콘솔에서 `'[FCM] SW activation timeout'` 경고가 정상 케이스에서 나타나지 않는지 확인

### Phase R: 재발 경로 분석 (fix: plan 필수)

3. - [ ] **SW 활성화 대기 경로를 전수 열거한다**
   - [ ] `rg -n "serviceWorker\.ready|statechange|activated" src` 결과에서 `awaitActivatedServiceWorker()`와 `waitForFCMActivation()` 2가지 외 추가 경로가 없는지 확인한다.
   - [ ] 두 helper의 타임아웃 값(8초)이 동일한지 검증한다.
   - [ ] 모든 경로에 대해 `방어 완료` 또는 `범위 제외` 근거를 표로 남긴다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거

---

*상태: 보류 | 진행률: 0/16 (0%)*
