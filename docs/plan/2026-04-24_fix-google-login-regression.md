# 2026-04-24 Google 로그인 갑작스런 실패 회귀 조사 및 최소 수정

> 작성일시: 2026-04-24 13:25
> 기준커밋: 5a01690
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/28 (0%)
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
- 이번 범위는 Google 로그인 회귀 조사와 최소 수정이다. `auth-worker`가 Google용 Supabase 세션을 직접 발급하는 구조 변경은 후속안으로만 남긴다.

---

## TODO

### Phase 0: Worktree 준비

0. ☐ **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - ☐ `docs/plan/2026-04-24_fix-google-login-regression.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - ☐ `docs/plan/2026-04-24_fix-google-login-regression.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 본다

### Phase 1: 회귀 기준선 고정

1. ☐ **현재 로그인 경로와 운영 drift 후보를 코드 기준으로 고정한다** — 회귀 원인 후보를 문서화
   - ☐ `src/routes/auth/callback/+page.svelte`: Google은 `signInWithIdToken()`, Kakao는 `setSession()` 경로임을 기준선으로 명시한다
   - ☐ `../auth-worker/src/providers/google.ts`: callback이 여전히 `id_token`과 `access_token`을 redirect payload로 내리는지 확인 기준으로 적는다
   - ☐ `src/lib/services/supabase.ts`: Supabase 대상이 `PUBLIC_SUPABASE_URL` 런타임 값에 의존한다는 점을 drift 후보로 고정한다

2. ☐ **서비스워커와 캐시 관여 범위를 고정한다** — stale callback 번들 가능성 판단 기준
   - ☐ `src/service-worker.ts`: 현재 fetch 핸들러가 같은 origin `GET`을 광범위하게 캐시하고 `/api`만 예외 처리한다는 점을 명시한다
   - ☐ `static/firebase-messaging-sw.js`: 별도 루트 스코프 SW가 동시에 존재해 로그인 회귀 진단을 혼탁하게 만들 수 있음을 적는다
   - ☐ `docs/plan/2026-04-24_fix-google-login-regression.md`: `/auth/callback` 문서와 navigation document는 캐시 대상에서 제외하는 방향을 최소 수정안으로 고정한다

### Phase 2: callback 진단 로그 최소 강화

3. ☐ **callback 페이지에 토큰 비노출 진단 로그를 추가한다** — 실패 타입을 네트워크/세션/토큰 부재로 분리
   - ☐ `src/routes/auth/callback/+page.svelte`: 기존 `Query metadata present/none` 로그를 유지하되 토큰 원문 대신 `hasGoogleTokens`, `hasSupabaseTokens`, `provider`, `returnTo`, `navigator.onLine`만 남긴다
   - ☐ `src/routes/auth/callback/+page.svelte`: `supabase.auth.signInWithIdToken()` 호출 직전 Supabase origin과 현재 pathname/search만 기록하고 hash 토큰 값은 기록하지 않는다
   - ☐ `src/routes/auth/callback/+page.svelte`: catch에서 `err.name`, `err.message`, `navigator.onLine`을 함께 로그로 남겨 `Failed to fetch`와 세션 생성 실패를 구분한다

4. ☐ **기존 로그인 계약은 유지한 채 회귀 포인트만 가시화한다** — 동작 변경 최소화
   - ☐ `src/routes/auth/callback/+page.svelte`: `setSession()` 우선, Google `signInWithIdToken()` fallback 구조는 유지한다
   - ☐ `src/routes/auth/callback/+page.svelte`: `returnTo === '/login' ? '/' : returnTo` 정규화는 그대로 유지해 기존 복귀 동선을 깨지 않는다
   - ☐ `src/routes/auth/callback/+page.svelte`: 사용자 노출 에러 문구는 토큰/CORS 전문용어 대신 `네트워크 또는 세션 교환 실패` 수준으로만 보강한다

### Phase 3: SW 캐시 범위 축소

5. ☐ **앱 Service Worker가 로그인/문서 요청을 캐시하지 않도록 제한한다** — 재배포 직후 stale callback 방지
   - ☐ `src/service-worker.ts`: `event.request.mode === 'navigate'` 또는 document 요청은 즉시 bypass하도록 분기한다
   - ☐ `src/service-worker.ts`: `/auth`, 특히 `/auth/callback` 경로는 같은 origin이어도 캐시하지 않도록 예외 처리한다
   - ☐ `src/service-worker.ts`: 나머지 캐시는 정적 자산 중심으로 유지하고 push/notification/schedule 로직은 건드리지 않는다

### Phase 4: 검증 및 회귀 방지

6. ☐ **정적 검증으로 빌드 회귀를 차단한다**
   - ☐ 프로젝트 루트: `npm run check`로 callback 로그 변경과 SW fetch 분기 변경 후 타입 오류가 없는지 확인한다
   - ☐ 프로젝트 루트: `npm run build`로 SvelteKit SW 번들과 callback 페이지가 정상 빌드되는지 확인한다

7. ☐ **수동 재현 시나리오를 고정한다** — 운영 원인 특정용 smoke test
   - ☐ Chrome DevTools Network: `/auth/callback` 문서가 최신 번들로 로드되는지, SW on/off 각각에서 비교 확인한다
   - ☐ Chrome DevTools Network: `signInWithIdToken()` 호출의 실제 URL, 상태코드, 실패 타입(`blocked`, `cancelled`, `net::ERR_*`, CORS)을 기록한다
   - ☐ 브라우저 콘솔: callback 로그에 토큰 원문이 남지 않으면서도 `provider`, `hasGoogleTokens`, `hasSupabaseTokens`, `navigator.onLine`이 보이는지 확인한다
   - ☐ 회귀 확인: Kakao 로그인, 기존 `returnTo=/settings` 복귀, SW 활성 상태 재배포 후 callback 최신화가 유지되는지 확인한다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. ☐ **post-merge 정리 확인** — `/merge-test` owner
   - ☐ `docs/plan/2026-04-24_fix-google-login-regression.md`: `main merge 시도`, `worktree remove`, `branch remove`는 `/merge-test` owner step으로 남긴다
   - ☐ `docs/plan/2026-04-24_fix-google-login-regression.md`: header meta(`> branch:`, `> worktree:`, `> worktree-owner:`) 제거는 merge 후 정리 단계에서만 수행한다

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

*상태: 초안 | 진행률: 0/28 (0%)*
