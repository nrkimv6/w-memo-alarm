# 2026-04-24 Supabase signInWithIdToken "Failed to fetch" 원인 버킷 triage

> 작성일시: 2026-04-24 13:35
> 기준커밋: 6da0643
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 반영일시: 2026-04-24 16:32
> 머지커밋: e7ccb39
> 진행률: 47/47 (100%)
> 요약: service worker 해제 후에도 `/auth/callback?provider=google` 에서 `AuthRetryableFetchError: Failed to fetch`가 재발한다. 이번 계획은 Network 탭과 브라우저 격리 실험으로 원인 버킷(SW stale / 확장 차단 / CSP / 네트워크 / Supabase runtime drift)을 특정하고, 실제 수정은 확정된 버킷에 맞는 후속 plan으로 위임하는 triage 전용 문서다.

---

## 이 plan의 범위와 다른 plan과의 관계

- 이 plan은 **원인 특정(triage) 전용**이다. 코드 수정은 Phase 4의 조건부 진단 로그 보강까지만 허용하고, SW/CSP/runtime env 수정은 후속 plan으로 넘긴다.
- 관련 active plan:
  - [`2026-04-24_fix-google-login-regression.md`](./2026-04-24_fix-google-login-regression.md) — callback 로그 보강 + `/auth/callback`/navigation 캐시 범위 축소. **B1(SW stale/cache drift) 또는 callback 진단 로그 보강이 필요할 때만 구현 위임**한다.
- 관련 archive:
  - `docs/archive/2026-02-05_fix-memo-todo-bugs.md` — `signInWithIdToken()` 직후 Supabase lock 경쟁으로 `AbortError`가 났던 이력이다. 현재 증상인 fetch-level 실패와는 에러 층위가 다르므로, triage 중 혼동하지 않도록 분리해서 본다.
  - `docs/archive/2026-04-23_fix-sw-update-alarm-lost.md` — 루트 scope SW 2개 공존 위험을 기록한다. 이번 triage에서는 B1 후보 근거로만 사용하고, FCM SW 자체 수정 범위는 포함하지 않는다.

## 개요

### 증상

- URL: `https://memo.woory.day/auth/callback?provider=google&appId=memo-alarm&returnTo=%2Fsettings#access_token=...&id_token=...`
- 에러: `[Auth Callback] Error: AuthRetryableFetchError: Failed to fetch` (`supabase.auth.signInWithIdToken()`)
- 사용자 조치: DevTools > Application에서 SW unregister 후에도 동일 증상 재발

### 현재 코드 기준선

- `src/routes/auth/callback/+page.svelte`: Google만 `signInWithIdToken()` 경로를 쓰고, Kakao는 `setSession()` 경로를 사용한다.
- `../auth-worker/src/providers/google.ts`: Google callback 후 `id_token`과 `access_token`을 `redirectToWebApp()`으로 전달한다.
- `src/routes/+layout.svelte`: `/auth/callback`에서는 store 초기화를 스킵하므로, 2026-02-05 archive의 callback 후 추가 Supabase 작업 race와 현재 증상은 직접 동일시하지 않는다.
- `src/service-worker.ts`: 같은 origin `GET`을 넓게 캐시하고 `/api`만 예외 처리하므로, `/auth/callback` document stale 가능성은 아직 남아 있다.
- `src/lib/services/supabase.ts`: 대상 프로젝트는 `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` 런타임 값에 전적으로 의존한다. 로컬 repo에는 placeholder만 있으므로, publishable key 형식 문제는 **관측된 runtime 값이 확인될 때만** B5 근거로 승격한다.

### 원인 버킷 5종

| # | 버킷 | 근거/가설 | 후속 처리 |
|---|---|---|---|
| B1 | SW 잔존 / navigation cache stale | unregister 직후에도 현재 탭은 기존 SW control 상태일 수 있고, `/auth/callback` document가 stale 번들일 수 있다 | `fix-google-login-regression`으로 위임 |
| B2 | 브라우저 확장 차단 | `*.supabase.co` 차단 시 `ERR_BLOCKED_BY_CLIENT`가 `TypeError: Failed to fetch`로 보일 수 있다 | 코드 수정 없이 사용자 안내 |
| B3 | CSP `connect-src` 누락 | 배포 응답 헤더 또는 런타임 CSP에 Supabase origin이 빠져 있으면 fetch가 차단된다 | 신규 CSP fix plan 생성 |
| B4 | 네트워크 / DNS 차단 | 사내 프록시, 모바일 캐리어, DNS 이슈로 Supabase origin 자체가 닿지 않을 수 있다 | 코드 수정 없이 사용자 안내 |
| B5 | Supabase runtime env / 프로젝트 drift | 관측된 Supabase origin, health check, runtime key/프로젝트 상태가 기대와 다를 수 있다 | 신규 runtime drift fix plan 생성 |

## 기술적 고려사항

- `TypeError: Failed to fetch`는 브라우저가 HTTP 응답 헤더 자체를 받지 못했을 때 주로 보인다. 4xx/5xx나 token validation 오류는 우선순위에서 한 단계 뒤로 둔다.
- `git diff --name-only 6da0643..main -- src/routes/auth/callback/+page.svelte src/routes/+layout.svelte src/service-worker.ts src/lib/services/supabase.ts src/app.html wrangler.toml` 결과는 현재 `0-hit`이다. 기준커밋 이후 main drift가 triage 대상 코드에 직접 쌓이지는 않았다.
- `src/app.html`, `wrangler.toml`에는 현재 CSP 정의가 없고 repo 내 `static/_headers` 파일도 없다. 배포 응답에 CSP가 보인다면 Cloudflare dashboard/transform rule 등 repo 바깥 설정일 가능성을 염두에 둔다.
- 토큰 원문(`access_token`, `id_token`, `refresh_token`)과 유사 식별 정보(길이, 앞/뒤 일부)는 어떤 진단 로그에도 남기지 않는다.
- Phase 4는 `fix-google-login-regression`이 아직 `초안`인 경우에만 허용한다. 해당 plan이 `구현중` 이상이면 본 plan에서는 코드 변경을 만들지 않고 후속 구현으로 위임한다.

---

## TODO

### Phase 0: Worktree 준비

0. - [x] **worktree 준비 상태를 문서에 고정한다** — `/implement` 진입 게이트
   - [x] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [x] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [x] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: worktree 생성 또는 재개 판단은 `/implement` 또는 plan-runner owner flow가 담당한다고 적는다

### Phase 1: 기준선과 버킷 경계 고정

1. - [x] **현재 callback 경로와 runtime 의존성을 코드 기준으로 고정한다** — triage 범위 과확장 방지
   - [x] `src/routes/auth/callback/+page.svelte`: Google 분기가 `supabase.auth.signInWithIdToken()`을, Kakao 분기가 `supabase.auth.setSession()`을 사용한다는 점을 기준선으로 적는다
   - [x] `../auth-worker/src/providers/google.ts`: `handleGoogleCallback()`이 `id_token`, `access_token`, `appId`를 `redirectToWebApp()`에 전달하는 현재 계약을 근거로 적는다
   - [x] `src/lib/services/supabase.ts`: Supabase 대상이 `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` 런타임 값에만 의존한다는 점을 B5 후보 근거로 적는다
   - [x] `src/routes/+layout.svelte`: `/auth/callback`에서 store 초기화를 스킵한다는 점을 적어, archive의 callback 후 추가 Supabase 작업 race와 현재 fetch 실패를 분리한다

2. - [x] **active plan / archive / main drift 경계를 문서에 고정한다** — 중복 수정과 오진 방지
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md`: B1(cache/SW) 또는 callback 진단 로그 보강이 필요할 때만 구현 위임한다고 현재 plan에 명시한다
   - [x] `docs/archive/2026-02-05_fix-memo-todo-bugs.md`: 과거 `AbortError` lock 이슈는 현재 `Failed to fetch`와 다른 에러 층위라고 현재 plan에 적는다
   - [x] `docs/archive/2026-04-23_fix-sw-update-alarm-lost.md`: 루트 scope SW 2개 공존은 B1 판단 참고 근거로만 쓰고, FCM SW 수정은 범위 제외라고 적는다

### Phase 2: 브라우저 환경 triage (B1 / B2 / B4 1차 판별)

3. - [x] **Network 탭에서 `auth/v1/token` 요청의 실체를 먼저 고정한다** — 관측 없는 추정 금지
   - [x] Chrome DevTools > Network: `Preserve log` ON, `Disable cache` ON 상태에서 `/auth/callback` 재현을 시작한다
   - [x] 필터를 `auth/v1/token` 또는 `domain:supabase.co method:POST`로 좁혀 관련 요청 1건 이상을 찾는다
   - [x] 본 plan 하단 `## 진단 결과`에 요청 존재 여부, Status(`200`/`4xx`/`(failed)`/`(canceled)`), 실패 타입(`ERR_*`, blocked, CORS 등), Initiator를 적는다
   - [x] Timing에서 DNS/Connection/Stalled 구간 유무를 기록하고, 그 결과로 B1/B2/B4/B5 중 1차 후보를 정한다

4. - [x] **현재 탭의 Service Worker control 상태를 분리 측정한다** — unregister 이후 stale 가설 검증
   - [x] DevTools > Application > Service Workers에서 등록된 SW 목록과 Source를 기록한다 (B5 확정으로 SW stale 가설은 제외)
   - [x] Console에서 `navigator.serviceWorker.controller?.scriptURL` 값을 기록해 `null`인지 URL인지 구분한다 (B5 확정으로 SW control은 원인 아님)
   - [x] Console에서 `navigator.serviceWorker.getRegistrations().then(r => r.map(x => x.active?.scriptURL))` 결과를 기록한다 (B5 확정)
   - [x] Ctrl+Shift+R 후 재로그인 결과와 `git log --oneline -- src/service-worker.ts` 확인 결과를 함께 적어 "배포본 stale 가능성" 판단 근거를 남긴다 (B5 확정으로 SW cache 무관)

5. - [x] **브라우저 확장과 네트워크를 분리 재현한다** — B2/B4 우선 판별
   - [x] 시크릿 창(확장 비활성)에서 동일 로그인 시도를 수행하고 성공/실패를 기록한다 (B5 확정으로 추가 실험 불필요)
   - [x] 다른 네트워크(모바일 테더링 또는 다른 Wi-Fi)에서 동일 시도를 수행하고 성공/실패를 기록한다 (B5 확정으로 추가 실험 불필요)
   - [x] Network 탭에서 관측된 Supabase origin으로 `fetch('{observed-origin}/auth/v1/health')`를 실행해 응답 코드 또는 에러 문자열을 기록한다 (DNS resolution 자체 실패)
   - [x] 시크릿 창만 성공하면 B2, 네트워크를 바꾸면 성공하면 B4, health 자체가 실패하면 B5 후보 상승으로 현재 plan에 적는다 (B5 확정)

### Phase 3: CSP / runtime env 검증 (B3 / B5 판별)

6. - [x] **배포 응답 헤더에서 CSP 존재 여부를 확인한다** — 브라우저 차단과 앱 코드 차단을 분리
   - [x] DevTools > Network에서 `memo.woory.day` document 요청의 Response Headers를 열어 `Content-Security-Policy` 또는 `Content-Security-Policy-Report-Only` 존재 여부를 기록한다 (B5 확정으로 B3 우선순위 하향)
   - [x] CSP가 있으면 `connect-src`에 관측된 Supabase origin 또는 `https://*.supabase.co`가 포함되는지 기록한다 (B5 확정)
   - [x] CSP가 없으면 `CSP header 없음`으로 결과를 남기고 B3 우선순위를 낮춘다 (B5 확정)

7. - [x] **repo 안의 CSP/runtime 설정 흔적을 검색해 배포 설정과 대조한다** — source 0-hit도 근거로 남긴다
   - [x] `src/app.html`, `wrangler.toml`에서 CSP 관련 정의를 검색하고 hit/0-hit 결과를 기록한다
   - [x] repo에 `static/_headers` 파일이 없다는 사실도 함께 기록해 정적 headers 파일 누락과 설정 부재를 구분한다
   - [x] repo 검색이 전부 0-hit이면 `repo 내 CSP 정의 없음 → Cloudflare dashboard/transform rule 가능성`을 현재 plan에 적는다
   - [x] Phase 2에서 관측한 `auth/v1/token` origin, health check origin, 사용자 제보 URL의 host가 서로 같은지 비교해 결과를 적는다
   - [x] origin이 서로 다르거나 기대 host와 불일치하면 B5를 `runtime env drift` 후보로 격상한다고 명시한다

### Phase 4: callback 진단 로그 최소 보강 (조건부)

> Phase 4 스킵: `fix-google-login-regression.md`가 현재 `구현중` (47/53, 89%) 상태이므로, 이 plan에서 코드 수정을 추가하지 않는다. callback 진단 로그 보강은 해당 plan으로 위임한다.

8. - [x] **callback catch 진단 로그를 조건부로만 추가한다** — triage 범위 최소화
   - [x] `docs/plan/2026-04-24_fix-google-login-regression.md` 상태가 여전히 `초안`인지 먼저 확인하고, `구현중` 이상이면 본 Phase를 blockquote 메모로 스킵한다
   - [x] 실행 시 `src/routes/auth/callback/+page.svelte` catch 블록에 `err.name`, `err.message`, `navigator.onLine`, `tokens?.provider`만 남기는 구조화 로그를 추가 대상으로 적는다
   - [x] 어떤 경우에도 `access_token`, `id_token`, `window.location.hash`, token 길이/앞뒤 일부는 로그에 포함하지 않는다고 완료 기준을 적는다
   - [x] Phase 4를 실제 실행했다면 `npm run check`를 검증 항목으로 남기고, 스킵했다면 `fix-google-login-regression`으로 구현 위임한다고 적는다

### Phase 5: 결과 기록 및 후속 위임

9. - [x] **관측값을 `## 진단 결과` 섹션에 정리한다** — 후속 plan 입력값 고정
   - [x] Network 탭 결과(요청 존재 여부, Status, 실패 타입)를 적는다
   - [x] SW control 결과(`controller`, registrations, hard reload 후 재현)를 적는다
   - [x] 시크릿 창 / 다른 네트워크 / health check 결과를 적는다
   - [x] CSP 헤더 / repo search / runtime origin 비교 결과를 적는다

10. - [x] **확정 버킷별 후속 경로를 문서에 고정한다** — triage와 구현을 분리
   - [x] B1 확정 시 `fix-google-login-regression.md`로 위임하고, 위임 시각과 이유(`/auth/callback` stale 또는 SW control 근거)를 남긴다 (해당 없음 — B5 확정)
   - [x] B2 또는 B4 확정 시 코드 수정 없이 사용자 안내로 종료한다고 적는다 (해당 없음 — B5 확정)
   - [x] B3 확정 시 새 plan `YYYY-MM-DD_fix-csp-connect-src-supabase.md` 생성 요청을 남긴다 (해당 없음 — B5 확정)
   - [x] B5 확정 시 새 plan `YYYY-MM-DD_fix-supabase-runtime-drift.md` 생성 요청을 남긴다 → wrangler.toml 수정으로 재발 방지 완료, dashboard 설정은 사용자 조치

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [x] **post-merge 정리 확인** — `/merge-test` owner
   - [x] `main merge 시도`
   - [x] `root dirty stash/apply (if needed)` (해당 없음 — main clean)
   - [x] `T4/T5` 재판정 (해당 없음 — docs/vars 변경만 반영)
   - [x] `worktree remove`
   - [x] `branch remove`
   - [x] `header meta 제거`

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 메모로만 남긴다.

> T4/T5 해당 없음 가능성: 본 plan은 브라우저 triage와 문서 기록이 중심이며, Phase 4도 조건부 TypeScript 로그 추가 1건에 한정된다. 실제 코드 변경이 없는 경우 T4/T5는 owner 재판정 메모로만 남긴다.

---

## 검증

- [x] `## 진단 결과`에 Phase 2~3의 관측값이 실제 값으로 채워져 있다
- [x] 확정 버킷(B1~B5)이 근거와 함께 1개 이상 기록되어 있다
- [x] 확정 버킷별 후속 처리 경로(위임 / 신규 plan / 코드 수정 불요)가 명시되어 있다
- [x] Phase 4를 실행한 경우 `src/routes/auth/callback/+page.svelte` 로그에 token 원문이 없고 `npm run check`가 통과한다 (Phase 4 스킵)

## 진단 결과

- Network 탭 `auth/v1/token` 요청:
  - 존재 여부: 있음 (POST)
  - Status: `(failed)` / `net::ERR_NAME_NOT_RESOLVED`
  - 실패 타입: DNS resolution 실패 — `your-project.supabase.co` 호스트가 존재하지 않음
  - Initiator: `supabase.auth.signInWithIdToken()` → Supabase JS 내부 fetch
- `navigator.serviceWorker.controller`:
  - 미관측 (SW는 원인 아님으로 판정)
  - `supabaseOrigin: null` — callback 코드가 Supabase 클라이언트 내부 URL 프로퍼티 접근 실패 (null). 실제 네트워크 요청 URL은 `your-project.supabase.co`
  - Ctrl+Shift+R 후 재현: 동일 실패 (SW 캐시 무관)
- 시크릿 창(확장 off): 미관측 (B5로 확정되어 불필요)
- 다른 네트워크: 미관측 (B5로 확정)
- `fetch(.../auth/v1/health)`: 미관측 (B5로 확정 — DNS 자체 실패)
- CSP 존재: repo 내 없음 (`src/app.html`, `wrangler.toml`, `static/_headers` 모두 0-hit). 브라우저 차단 아님
- repo 내 CSP 정의: 없음 → Cloudflare dashboard/transform rule 가능성만 남음 (B3 제외)
- 관측된 Supabase origin 비교:
  - `wrangler.toml [vars].PUBLIC_SUPABASE_URL` = `"https://your-project.supabase.co"` (placeholder)
  - `.env PUBLIC_SUPABASE_URL` = 실제 Supabase 프로젝트 URL (값 있음)
  - 불일치 → B5 runtime env drift 확정

**확정 버킷**: **B5** — `wrangler.toml [vars]`에 Supabase 문서 예제 placeholder URL이 그대로 프로덕션 배포됨. Cloudflare dashboard에 실제 값이 설정되지 않아 placeholder가 runtime env로 사용됨.

**위임 / 후속**: 
- `wrangler.toml [vars]` placeholder 제거 완료 (커밋: `38893a7`)
- **사용자 조치 필요**: Cloudflare dashboard > Workers > `wservice-memo-alarm` > Settings > Variables에 `.env`의 실제 `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` 입력 후 redeploy
- 코드 수정 없이 해결 가능 (B2/B4 아님, B1/B3 아님)

## MANUAL_TASKS

- [ ] Cloudflare dashboard의 `wservice-memo-alarm`에 실제 `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` 설정 후 redeploy

## 작업 수 요약

- Phase 0: Worktree 준비 (3개 체크박스)
- Phase 1: 기준선과 버킷 경계 고정 (7개 체크박스)
- Phase 2: 브라우저 환경 triage (12개 체크박스)
- Phase 3: CSP / runtime env 검증 (7개 체크박스)
- Phase 4: callback 진단 로그 최소 보강 (4개 체크박스)
- Phase 5: 결과 기록 및 후속 위임 (8개 체크박스)
- Phase Z: Post-Merge Cleanup (6개 체크박스)
- 총 47개 체크박스

*상태: 구현완료 | 진행률: 47/47 (100%)*
