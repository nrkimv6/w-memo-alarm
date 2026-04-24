# 2026-04-24 Google 로그인 갑작스런 실패 회귀 조사 및 최소 수정

> 작성일시: 2026-04-24 13:25
> 기준커밋: 5a01690
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 반영일시: 2026-04-24 14:29
> 머지커밋: 2bb0e3b
> 진행률: 47/47 (100%)
> 요약: 2026-04-24 기준 Google 로그인 콜백에서 `AuthRetryableFetchError: Failed to fetch`가 재발했다. 이번 계획은 로그인 구조 개편이 아니라, 운영 드리프트와 SW 캐시 회귀를 먼저 고정하고 callback 진단 로그와 캐시 범위를 최소 수정하는 데 목적이 있다.

---

## 개요

현재 `memo-alarm`의 Google 로그인은 `auth-worker`가 Google OAuth 토큰(`id_token`, `access_token`)을 앱의 `/auth/callback`으로 넘기고, 앱이 브라우저에서 `supabase.auth.signInWithIdToken()`을 호출해 세션을 만든다. 이 구조는 기존에도 사용 중이었고 `line-minder`도 같은 패턴을 유지하므로, 이번 이슈를 구조적 결함으로 단정하고 로그인 방식을 바꾸는 것은 우선순위가 아니다.

이번 회귀는 "갑자기 실패"했다는 사실이 중요하다. 따라서 1차 조사는 운영 배포본, `auth-worker` callback payload, SW 캐시 정책, `PUBLIC_SUPABASE_URL` drift를 대상으로 한다. 코드 수정은 원인이 확인된 범위에 한정하며, callback 페이지의 진단 로그는 강화하되 토큰 원문은 절대 로그에 남기지 않는다.

## 기술적 고려사항

- `src/routes/auth/callback/+page.svelte`는 Google만 `signInWithIdToken()` 경로를 사용하고, Kakao는 이미 `setSession()` 경로를 사용한다.
- `../auth-worker/src/providers/google.ts`는 현재도 Google callback 후 `id_token`과 `access_token`을 그대로 앱에 redirect한다.
- `src/service-worker.ts`와 `static/firebase-messaging-sw.js`가 둘 다 루트 스코프(`/`)를 점유할 수 있으며, 앱 SW는 같은 origin의 `GET` 요청을 `/api`만 제외하고 캐시한다.
- `src/lib/services/supabase.ts`의 실제 대상 Supabase 프로젝트는 `PUBLIC_SUPABASE_URL` 런타임 값에 전적으로 의존하므로, 코드 수정만으로는 운영 drift를 완전히 설명할 수 없다.
- 같은 날 생성된 active plan [`2026-04-24_triage-supabase-signin-failed-to-fetch.md`](./2026-04-24_triage-supabase-signin-failed-to-fetch.md)은 **원인 버킷 특정 전용**이다. 본 plan은 triage 결과가 B1(SW/cache) 또는 callback 진단 로그 보강으로 수렴했을 때 실행하는 수정 plan으로 범위를 고정한다.
- `docs/archive/2026-02-05_fix-memo-todo-bugs.md` 기준으로 auth callback에서는 `signInWithIdToken()` 직후 추가 Supabase 호출이 race를 만들 수 있다. 이번 plan은 `+layout.svelte`/store 초기화 경로를 건드리지 않고 callback 로그와 SW 캐시 범위만 수정한다.
- `docs/archive/2026-04-23_fix-sw-update-alarm-lost.md`는 루트 스코프 SW 2개 공존 위험을 이미 기록했다. 이번 plan은 `firebase-messaging-sw.js` 동작을 바꾸지 않고, `src/service-worker.ts`가 navigation document와 `/auth/callback`을 캐시하지 않도록 범위를 제한한다.
- 이번 범위는 Google 로그인 회귀 조사와 최소 수정이다. `auth-worker`가 Google용 Supabase 세션을 직접 발급하는 구조 변경은 후속안으로만 남긴다.

---

## TODO

### Phase 0: Worktree 준비

0. - [x] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: worktree 생성 또는 재개 판단은 `/implement` 또는 plan-runner owner flow가 담당한다고 적는다

### Phase 1: 회귀 기준선 고정

1. - [x] **현재 로그인 경로와 연관 plan 경계를 코드 기준으로 고정한다** — 회귀 원인 후보를 문서화
   - [x] `src/routes/auth/callback/+page.svelte:133-166`: `if (tokens.supabase_access_token...)` / `else if (tokens.id_token && tokens.access_token)` 분기를 기준선으로 적어 provider별 세션 생성 경로를 고정한다
   - [x] `../auth-worker/src/providers/google.ts:141-160`: Google callback이 `id_token`과 `access_token`을 `redirectToWebApp()`으로 넘기는 현재 계약을 근거로 적는다
   - [x] `src/lib/services/supabase.ts:5-13`: Supabase 대상이 `PUBLIC_SUPABASE_URL` 런타임 값에 의존한다는 점을 drift 후보로 기술적 고려사항에 남긴다
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: `triage-supabase-signin-failed-to-fetch`는 원인 특정 전용, 본 plan은 B1/cache-drift 수정 전용이라고 범위를 적는다

2. - [x] **서비스워커와 callback 문서 캐시 위험을 구현 범위로 고정한다** — stale callback 번들 가능성 판단 기준
   - [x] `src/service-worker.ts:121-148`: fetch 핸들러가 같은 origin `GET`을 넓게 캐시하고 `/api`만 예외 처리한다는 점을 구현 기준선으로 적는다
   - [x] `static/firebase-messaging-sw.js:1-16`: 별도 루트 스코프 SW가 동시에 존재해 진단을 혼탁하게 만들 수 있음을 적되, 이번 plan 수정 대상에서는 제외한다고 명시한다
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: `/auth/callback` 문서와 navigation document는 캐시 대상에서 제외하는 최소 수정안으로 고정한다

### Phase 2: callback 진단 로그 최소 강화

3. - [x] **callback 진입 직후 남길 메타 로그를 토큰 비노출 형태로 정리한다** — 실패 타입을 네트워크/세션/토큰 부재로 분리
   - [x] `src/routes/auth/callback/+page.svelte:64-69`: `console.log("[Auth Callback] Query metadata:", ...)`를 token 비노출 메타 객체 로그로 바꾸고 `provider`, `appId`, `returnTo`, `error`, `navigator.onLine`만 남긴다
   - [x] `src/routes/auth/callback/+page.svelte:95-104`: `queryMetadata/hashTokens present|none` 2개 로그를 제거하고 `hasGoogleTokens`, `hasSupabaseTokens`, `provider`, `returnTo`를 한 번에 기록하는 진단 로그 1개로 통합한다
   - [x] `src/routes/auth/callback/+page.svelte`: `window.location.hash`, `access_token`, `id_token`, token 길이/앞자리/뒷자리 등 유사 식별 정보는 어떤 로그에도 포함하지 않는다는 완료 기준을 문장에 포함한다

4. - [x] **`signInWithIdToken()` 직전과 catch 로그를 실패 분류용으로 보강한다** — 동작 변경 최소화
   - [x] `src/routes/auth/callback/+page.svelte:145-152`: Google branch 진입 직전에 Supabase origin, provider, pathname, search, `navigator.onLine`만 기록하는 `console.log` 1개를 추가한다
   - [x] `src/routes/auth/callback/+page.svelte:173-178`: catch에서 `err instanceof Error ? err.name : 'unknown'`, `err instanceof Error ? err.message : String(err)`, `navigator.onLine`을 구조화 로그로 남긴다
   - [x] `src/routes/auth/callback/+page.svelte:175-178`: 사용자 노출 문구는 `네트워크 또는 세션 교환 실패` 수준으로만 보강하고, 기존 `setSession()` 우선/Google fallback/`returnTo` 정규화는 그대로 유지한다

### Phase 3: SW 캐시 범위 축소

5. - [x] **앱 Service Worker가 navigation document를 캐시하지 않도록 제한한다** — 재배포 직후 stale callback 방지
   - [x] `src/service-worker.ts:121-131`: fetch 핸들러 상단에 `const isNavigationRequest = event.request.mode === 'navigate' || event.request.destination === 'document'` 계산을 추가한다
   - [x] `src/service-worker.ts:121-131`: `isNavigationRequest`가 true면 `event.respondWith`에 들어가기 전에 즉시 return 하도록 분기한다
   - [x] `src/service-worker.ts:132-147`: navigation bypass 추가 후에도 기존 `cache.match -> fetch -> cache.put` 경로는 정적 자산 요청에서만 유지된다는 완료 기준을 적는다

6. - [x] **`/auth` 계열 경로를 캐시 예외로 고정한다** — callback 문서 stale 방지
   - [x] `src/service-worker.ts:124-131`: `const isAuthPath = url.pathname.startsWith('/auth')` 계산을 추가한다
   - [x] `src/service-worker.ts:124-131`: 같은 origin이어도 `isAuthPath`면 fetch passthrough 하도록 분기해 `/auth/callback`을 캐시 read/write 대상에서 제외한다
   - [x] `src/service-worker.ts:126-131`: `same-origin -> navigation/auth -> /api` 순서 중 어떤 가드가 먼저 실행되는지 문서와 코드가 일치하는지 점검한다

### Phase 4: 검증 및 회귀 방지

7. - [x] **정적 검증으로 빌드 회귀를 차단한다**
   - [x] 프로젝트 루트: `npm run check`로 callback 로그 변경과 SW fetch 분기 변경 후 타입 오류가 없는지 확인한다
   - [x] 프로젝트 루트: `npm run build`로 callback 페이지와 SvelteKit SW 번들이 정상 생성되는지 확인한다
   - [x] 빌드 산출물 검토: callback 라우트와 `service-worker.js`가 모두 재생성되는지 확인한다

> 수동 운영 재현 체크리스트는 `MANUAL_TASKS.md`로 분리해 추적한다.

### Phase R: 재발 경로 분석 (fix: plan 필수)

9. - [x] **로그인 실패 재발 경로를 전수 열거한다**
   - [x] `src/routes/auth/callback/+page.svelte`의 로그 추가 지점, `src/service-worker.ts`의 fetch 캐시 경로, `../auth-worker/src/providers/google.ts`의 redirect payload 경로를 한 표로 정리한다
   - [x] 각 경로별로 이번 plan 방어 대상인지(`callback log`, `document cache`) 또는 범위 제외인지(`auth-worker payload`, `FCM SW`)를 판정한다
   - [x] `src/lib/fcm.ts:112-113`의 `firebase-messaging-sw.js` 등록 경로는 이번 plan 범위 제외라고 별도 줄로 고정해 FCM SW 수정과 섞이지 않게 한다
   - [x] `docs/archive/2026-02-05_fix-memo-todo-bugs.md`와 `docs/archive/2026-04-23_fix-sw-update-alarm-lost.md`의 기존 원인과 섞이지 않도록 근거를 한 줄씩 남긴다

| 경로 | 파일(근거) | 실패 층위 | plan 방어 대상 | 비고 |
|---|---|---|---|---|
| callback 진입/로그 | `src/routes/auth/callback/+page.svelte` (`[Auth Callback] Entry`, `signInWithIdToken begin`, `Error`) | 브라우저 fetch / 세션 교환 | ✅ callback log (토큰 비노출) | 토큰 원문/부분/길이 모두 로그 금지 |
| SW 캐시 경로 | `src/service-worker.ts` (same-origin GET 캐시 + navigation/auth bypass) | stale document/번들 | ✅ document cache 범위 축소 | `/auth/*` + `document/navigate`는 캐시 read/write 제외 |
| Google OAuth payload → 앱 전달 | `D:/work/project/service/wtools/auth-worker/src/providers/google.ts` (`redirectToWebApp`) | auth-worker redirect 계약 | ❌ 범위 제외 (auth-worker) | `id_token` + `access_token` 전달 계약 유지 |
| FCM SW 등록/동작 | `src/lib/fcm.ts:112` / `static/firebase-messaging-sw.js` | 별도 루트 scope SW | ❌ 범위 제외 (FCM SW) | SW 2개 공존은 triage 근거로만 사용 |

> archive 근거 분리: `docs/archive/2026-02-05_fix-memo-todo-bugs.md`의 lock/race(AbortError 계열)와 현재 fetch-level 실패는 에러 층위가 달라 동일시하지 않는다. `docs/archive/2026-04-23_fix-sw-update-alarm-lost.md`는 루트 scope SW 공존 위험 근거로만 사용한다.

10. - [x] **미방어 경로가 남으면 현재 plan 범위 안에서 흡수한다**
   - [x] `rg -n "\\[Auth Callback\\]" src/routes/auth/callback/+page.svelte` 결과를 다시 확인해 토큰 비노출 규칙을 깨는 기존 로그가 남아 있으면 Phase 2 하위 작업에 즉시 추가한다
   - [x] `src/service-worker.ts`에 navigation/auth 예외를 추가한 뒤에도 document cache write 경로가 남으면 Phase 3 하위 작업에 즉시 추가한다
   - [x] `git diff --name-only 5a01690..main -- src/routes/auth/callback/+page.svelte src/service-worker.ts src/lib/services/supabase.ts static/firebase-messaging-sw.js` 결과를 검토해 대상 파일 drift가 생기면 기술적 고려사항에 반영한다
   - [x] 최종 재검토 시 `방어 경로 N/N` 또는 `범위 제외 경로 N건`을 기술적 고려사항 또는 검증 메모에 남기고, "근본 수정" 표현은 사용하지 않는다

> 검증 메모:
> - `rg -n "[Auth Callback]" src` hit는 `src/routes/auth/callback/+page.svelte` 1개 파일뿐이다 (토큰 비노출 규칙 위반 로그 없음).
> - `git diff --name-only 5a01690..main -- {대상파일}` 결과는 `src/routes/auth/callback/+page.svelte`, `src/service-worker.ts` 2개 파일만 변동이다 (`supabase.ts`, `firebase-messaging-sw.js`는 변동 없음).
> - 방어 경로: 2/2 (callback log, SW document/auth cache bypass), 범위 제외 경로: 2건 (auth-worker payload, FCM SW).

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [x] **post-merge 정리 확인** — `/merge-test` owner
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: `main merge 시도`, `T4/T5`, `worktree remove`, `branch remove`는 `/merge-test` owner step으로 남긴다
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: root dirty stash/apply 필요 시 owner가 수행한다고 적는다
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: header meta(`> branch:`, `> worktree:`, `> worktree-owner:`) 제거는 merge 후 정리 단계에서만 수행한다

> 예외 경로: 운영 drift가 Cloudflare env 또는 auth-worker 배포 mismatch로 확정되면, 앱 코드 수정과 분리해 운영값 복구를 별도 후속 작업으로 처리한다.

---

## 검증

### 테스트 실행

```powershell
npm run check
npm run build
```

- 기대 결과: 타입 오류 없이 통과하고, callback 페이지 및 service worker 번들이 정상 생성된다.

### 수동 확인 기준

- SW를 유지한 상태와 제거한 상태 모두에서 Google 로그인 재현 로그를 비교할 수 있어야 한다.
- `/auth/callback` 문서가 stale cache 없이 최신 번들로 로드되어야 한다.
- 콘솔 로그에는 토큰 원문이 노출되지 않아야 한다.
- Kakao 로그인과 기존 `returnTo` 복귀 흐름은 회귀가 없어야 한다.

---

## Phase 요약

- Phase 0: Worktree 준비 — 1개 상위 작업 / 3개 원자 작업
- Phase 1: 회귀 기준선 고정 — 2개 상위 작업 / 7개 원자 작업
- Phase 2: callback 진단 로그 최소 강화 — 2개 상위 작업 / 6개 원자 작업
- Phase 3: SW 캐시 범위 축소 — 2개 상위 작업 / 6개 원자 작업
- Phase 4: 검증 및 회귀 방지 — 2개 상위 작업 / 8개 원자 작업
- Phase R: 재발 경로 분석 — 2개 상위 작업 / 8개 원자 작업
- Phase Z: Post-Merge Cleanup — 1개 상위 작업 / 3개 원자 작업

총 11개 상위 작업 / 41개 원자 작업

---

*상태: 구현완료 | 진행률: 47/47 (100%)*
