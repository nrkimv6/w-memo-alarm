# 2026-04-24 auth/callback 토큰 위생 강화 (URL hash 제거)

> 작성일시: 2026-04-24 14:59
> 기준커밋: f10fed1
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/37 (0%)
> 요약: `/auth/callback`에서 Google OAuth 토큰이 URL hash에 남아 있어 사용자 공유/스크린샷/히스토리 재진입 시 노출 위험이 있다. 토큰 파싱 직후 hash를 제거해 주소창을 정리하고, `signInWithIdToken()` 직전 진단 로그의 Supabase origin은 Supabase client가 쓰는 runtime public env 기준으로 일치시킨다.

---

## 이 plan의 범위와 다른 plan과의 관계

- 이 plan은 `src/routes/auth/callback/+page.svelte` 1개 파일에서만 동작을 보강한다. Google/Kakao 세션 교환 구조, `auth-worker` redirect payload, service worker 캐시 정책은 수정 범위에 포함하지 않는다.
- 연관 active plan:
  - `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md` — fetch 실패 원인 버킷을 특정하는 triage 전용 문서다. 본 plan은 triage와 독립적으로 남아 있는 URL hash 위생과 runtime env 로그 정합만 다룬다.
- 연관 archive:
  - `docs/archive/2026-04-24_fix-google-login-regression.md` — callback 안전 로그와 `/auth/callback` 캐시 예외를 이미 반영했다. 본 plan은 그 후속으로 남은 hash 제거와 env source 정합만 추가한다.
  - `docs/archive/2026-02-05_fix-memo-todo-bugs.md` — `signInWithIdToken()` 직후 Supabase 추가 호출 race를 다룬 이력이다. 이번 plan은 hash 제거와 로그 origin 계산만 다루며, 새로운 Supabase auth 호출이나 흐름 재배치는 금지한다.

## 개요

### 현재 기준선

- `src/routes/auth/callback/+page.svelte`는 `parseQueryParams()`와 `parseHashFragment()`를 각각 읽고 `const tokens = { ...hashTokens, ...queryMetadata }`로 합친 뒤, provider 분기 전에 진단 로그를 남긴다.
- `returnTo`, `provider`, `appId`, `error`는 query string에 있고, OAuth 토큰(`access_token`, `id_token`, `refresh_token`, `supabase_*_token`)은 hash fragment에 있다.
- 현재 구현은 토큰 원문을 로그에 남기지 않지만, `window.location.hash` 자체는 그대로 남아 주소창 복사/스크린샷/히스토리 재진입 시 노출될 수 있다.

### 목표

- 토큰 값을 메모리에 복사한 직후 주소창 hash를 제거해 브라우저 노출면을 줄인다.
- callback 진단 로그의 `supabaseOrigin`이 `src/lib/services/supabase.ts`와 동일한 runtime public env source를 보도록 맞춘다.

## 기술적 고려사항

- `src/routes/auth/callback/+page.svelte`는 `onMount()` 내부에서만 토큰을 읽으므로 `window.history.replaceState()`는 browser-only 분기 안에서 안전하게 호출할 수 있다.
- `src/routes/+page.svelte`에 이미 `window.history.replaceState({}, '', cleanUrl)` 패턴이 있어, query 유지형 URL 정리는 현재 코드베이스 관례와 충돌하지 않는다.
- `src/lib/services/supabase.ts`는 이미 `import { env } from '$env/dynamic/public'`와 `env.PUBLIC_SUPABASE_URL`을 사용한다. callback 로그만 `import.meta.env.PUBLIC_SUPABASE_URL`을 읽고 있어 source가 어긋난다.
- `git diff --name-only f10fed1..main -- src/routes/auth/callback/+page.svelte src/lib/services/supabase.ts package.json src/routes/+page.svelte` 결과는 `0-hit`이다. 기준커밋 이후 main drift가 이번 수정 대상 파일에 직접 쌓이지 않았다.
- hash 제거는 `tokens` 복사 이후에만 수행해야 한다. 그렇지 않으면 `parseHashFragment()`가 읽은 값을 잃고 세션 교환이 실패할 수 있다.

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정한다** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-24_harden-auth-callback-token-hygiene.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `docs/plan/2026-04-24_harden-auth-callback-token-hygiene.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `docs/plan/2026-04-24_harden-auth-callback-token-hygiene.md`: worktree 생성 또는 재개 판단은 `/implement` 또는 plan-runner owner flow가 담당한다고 적는다

### Phase 1: 현재 동작과 범위 고정

1. - [ ] **callback의 토큰 파싱 순서와 hash 제거 삽입 지점을 코드 기준으로 고정한다** — 잘못된 선행 제거 방지
   - [ ] `src/routes/auth/callback/+page.svelte`: `parseQueryParams()`와 `parseHashFragment()`를 각각 읽은 뒤 `const tokens = { ...hashTokens, ...queryMetadata }`로 합치는 현재 순서를 기준선으로 적는다
   - [ ] `src/routes/auth/callback/+page.svelte`: `returnTo`, `provider`, `appId`, `error`는 query string에 있고 OAuth 토큰은 hash에 있다는 점을 적어, hash 제거 후에도 query가 유지되어야 함을 명시한다
   - [ ] `src/routes/auth/callback/+page.svelte`: hash 제거는 `tokens` 메모리 복사 직후, `tokens?.error` 검사와 `provider` 분기보다 앞에 둬야 오류 경로에서도 한 번은 실행된다고 적는다

2. - [ ] **active plan / archive / main drift 경계를 문서에 고정한다** — 중복 수정 방지
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: triage는 원인 버킷 판별 전용이며, 본 plan은 hash 위생과 env 로그 정합만 다룬다고 현재 plan에 적는다
   - [ ] `docs/archive/2026-04-24_fix-google-login-regression.md`: callback 안전 로그와 `/auth/callback` 캐시 예외는 이미 반영됐고, 본 plan은 그 위에 남은 hash 제거만 더한다고 적는다
   - [ ] `git diff --name-only f10fed1..main -- src/routes/auth/callback/+page.svelte src/lib/services/supabase.ts package.json src/routes/+page.svelte`: `0-hit` 근거를 기술적 고려사항에 남겨 main drift와 무관함을 고정한다

### Phase 2: URL hash 제거 (토큰 위생)

3. - [ ] **토큰 메모리 복사 직후 주소창 hash를 제거한다** — 주소창/히스토리 노출 최소화
   - [ ] `src/routes/auth/callback/+page.svelte`: `const tokens = { ...hashTokens, ...queryMetadata }` 직후 hash 제거 여부를 판단하는 guard를 둔다
   - [ ] `src/routes/auth/callback/+page.svelte`: guard 통과 시 `window.history.replaceState({}, '', window.location.pathname + window.location.search)` 또는 동등한 same-origin 호출로 hash를 제거한다
   - [ ] `src/routes/auth/callback/+page.svelte`: `window.location.pathname + window.location.search`를 사용해 `returnTo` 등 query string은 유지하고 `#...`만 제거한다고 완료 기준을 적는다

4. - [ ] **hash 제거가 오류 경로와 provider 분기 모두에 안전하게 적용되도록 배치한다** — 동작 회귀 방지
   - [ ] `src/routes/auth/callback/+page.svelte`: hash 제거 코드는 `tokens?.error` throw 이전에 실행해 에러 화면으로 가도 토큰 hash가 남지 않게 한다
   - [ ] `src/routes/auth/callback/+page.svelte`: `!tokens?.provider` 기존 세션 fallback, Kakao `setSession()`, Google `signInWithIdToken()` 분기에는 추가 Supabase 호출 없이 현재 흐름을 그대로 유지한다
   - [ ] `src/routes/auth/callback/+page.svelte`: hash가 비어 있거나 browser가 아닌 경우 `replaceState`를 호출하지 않는다는 guard를 적어 불필요한 URL 변경을 막는다

### Phase 3: 진단 로그 env 정합

5. - [ ] **callback 로그의 Supabase origin source를 client와 맞춘다** — runtime drift 진단 정합성 확보
   - [ ] `src/routes/auth/callback/+page.svelte`: `$env/dynamic/public`의 `env`를 import해 `supabaseOrigin` 계산 소스를 `env.PUBLIC_SUPABASE_URL`로 교체한다
   - [ ] `src/routes/auth/callback/+page.svelte`: `src/lib/services/supabase.ts`가 쓰는 `env.PUBLIC_SUPABASE_URL`과 동일 source를 본다고 문서에 적어 진단 로그와 실제 client target을 일치시킨다

6. - [ ] **env 파싱 실패를 비치명으로 유지한다** — 진단 로그가 본 흐름을 깨지 않게 한다
   - [ ] `src/routes/auth/callback/+page.svelte`: `new URL(env.PUBLIC_SUPABASE_URL)` 파싱은 try/catch로 감싸고 실패 시 `supabaseOrigin: null`을 로그한다
   - [ ] `src/routes/auth/callback/+page.svelte`: `supabase.auth.signInWithIdToken()` 호출 인자, 토큰 비노출 로그 규칙, 사용자 메시지(`네트워크 또는 세션 교환 실패`)는 그대로 유지한다고 적는다

### Phase 4: 정적 검증과 회귀 차단

7. - [ ] **정적 검증으로 타입/번들 회귀를 차단한다**
   - [ ] 프로젝트 루트: `npm run check`를 실행해 `$env/dynamic/public` import와 `history.replaceState` 추가 후 타입 오류가 없는지 확인한다
   - [ ] 프로젝트 루트: `npm run check` 결과에서 `src/routes/auth/callback/+page.svelte` 관련 새 SSR/browser guard 오류가 없는지 확인한다

8. - [ ] **수동 확인 기준을 문서에 고정한다** — 구현 후 검수 포인트 명확화
   - [ ] 프로젝트 루트: `npm run build`를 실행해 callback 페이지 번들이 정상 생성되는지 확인한다
   - [ ] Chrome에서 `/auth/callback` 진입 직후 주소창에 `#access_token=...&id_token=...`가 남지 않는다고 검증 항목에 적는다
   - [ ] DevTools Console에 토큰 원문과 `window.location.hash` 원문이 남지 않는다고 검증 항목에 적는다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `docs/plan/2026-04-24_harden-auth-callback-token-hygiene.md`: `main merge 시도`, `T4/T5`, `worktree remove`, `branch remove`는 `/merge-test` owner step으로 남긴다
   - [ ] `docs/plan/2026-04-24_harden-auth-callback-token-hygiene.md`: root dirty stash/apply 필요 시 owner가 수행한다고 적는다
   - [ ] `docs/plan/2026-04-24_harden-auth-callback-token-hygiene.md`: header meta(`> branch:`, `> worktree:`, `> worktree-owner:`) 제거는 merge 후 정리 단계에서만 수행한다고 적는다

---

## 검증

- [ ] `src/routes/auth/callback/+page.svelte`에서 토큰 파싱 직후 주소창 hash가 제거되고 query string은 유지된다
- [ ] `signInWithIdToken()` 직전 로그의 `supabaseOrigin`이 `src/lib/services/supabase.ts`와 동일한 runtime public env source를 기준으로 계산된다
- [ ] `npm run check`가 통과한다
- [ ] `npm run build`가 통과한다
- [ ] Console 로그에 토큰 원문과 `window.location.hash` 원문이 남지 않는다

## 작업 수 요약

- Phase 0: Worktree 준비 (4개 체크박스)
- Phase 1: 현재 동작과 범위 고정 (8개 체크박스)
- Phase 2: URL hash 제거 (8개 체크박스)
- Phase 3: 진단 로그 env 정합 (6개 체크박스)
- Phase 4: 정적 검증과 회귀 차단 (7개 체크박스)
- Phase Z: Post-Merge Cleanup (4개 체크박스)
- 총 37개 체크박스

*상태: 검토완료 | 진행률: 0/37 (0%)*
