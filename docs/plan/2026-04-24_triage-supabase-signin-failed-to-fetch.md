# Supabase signInWithIdToken "Failed to fetch" 원인 버킷 triage

> 작성일시: 2026-04-24 13:35
> 기준커밋: 6da0643
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/17 (0%)
> 요약: service worker 해제 후에도 `/auth/callback?provider=google` 에서 `AuthRetryableFetchError: Failed to fetch`가 재발 — Network 탭 기반 1차 triage로 원인 버킷(SW 잔존 / CSP / 확장 차단 / 네트워크 / key·프로젝트)을 특정하고, 실제 수정은 해당 버킷에 맞는 plan 으로 위임

---

## 이 plan 의 범위와 다른 plan 과의 관계

- **이 plan = 원인 특정(triage) 전용**. 코드 수정은 최소한(진단 로그 추가 수준)까지만 포함하고, **실제 수정은 다른 plan 으로 넘긴다**.
- 관련 기존 plan:
  - [`2026-04-24_fix-google-login-regression.md`](./2026-04-24_fix-google-login-regression.md) — callback 진단 로그 강화 + SW 캐시 범위 축소(`/auth/callback`, navigate mode bypass) 수정안. **원인이 SW/캐시/drift 버킷으로 확정되면 이 plan 으로 구현 위임**.
  - 원인이 `sb_publishable_*` key 호환성, Supabase 프로젝트 drift, CSP header 로 판명되면 **본 triage 에서 새 후속 plan 을 생성**한다.
- 병렬 실행 가능: 본 triage 는 브라우저 환경 조사 중심이라 코드 수정이 거의 없으므로, `fix-google-login-regression` 착수 전에 원인 버킷을 고정해 해당 plan 의 Phase 범위를 최소화할 수 있다.

## 개요

### 증상

- URL: `https://memo.woory.day/auth/callback?provider=google&appId=memo-alarm&returnTo=%2Fsettings#access_token=...&id_token=...`
- 에러: `[Auth Callback] Error: AuthRetryableFetchError: Failed to fetch` (at `supabase.auth.signInWithIdToken`)
- 사용자 조치: DevTools > Application 에서 SW unregister 후에도 동일 증상.
- DevTools: `#6071 activated and is running` — 최신 SW 는 정상 activate.

### "Failed to fetch" 의 의미

`TypeError: Failed to fetch` 는 **HTTP 응답 헤더 자체를 받지 못한 네트워크 레벨 실패** 시 브라우저가 내는 표준 메시지다. 4xx/5xx 응답이 돌아오는 경우(예: id_token 검증 실패, nonce 오류)는 `AuthApiError`로 분기되므로 **이 증상의 원인 후보에서 제외**된다.

### 원인 버킷 5종

| # | 버킷 | 근거/가설 | 위임 plan |
|---|---|---|---|
| B1 | SW 잔존 / navigate 캐시 stale | unregister ≠ 현재 탭 uncontrol. 구버전 callback JS 가 구 Supabase client 설정으로 요청해 실패 가능 | `fix-google-login-regression` |
| B2 | 브라우저 확장 차단 | uBlock / Privacy Badger 등이 `*.supabase.co` 차단 시 `ERR_BLOCKED_BY_CLIENT` → `TypeError: Failed to fetch` | 코드 수정 불요 (사용자 안내) |
| B3 | CSP `connect-src` 누락 | Cloudflare Worker / `_headers` / meta CSP 에 `https://*.supabase.co` 빠짐 | 신규 plan (Phase 5에서 생성) |
| B4 | 네트워크/DNS | 사내 프록시·모바일 캐리어 DNS 차단 | 코드 수정 불요 (사용자 안내) |
| B5 | Supabase 프로젝트 drift / key 형식 | `.env` 가 `PUBLIC_SUPABASE_ANON_KEY=sb_publishable_*` 신형식. 프로젝트 paused/삭제 시 health 200 안 옴 | 신규 plan (Phase 5에서 생성) |

> 참고: 현재 `src/service-worker.ts` L127-128 은 `url.origin !== location.origin` 에서 early return 하므로 **최신 SW 는 Supabase 요청을 intercept 하지 않는다**. B1 은 "구버전 SW 잔존" 또는 "navigate document 캐시 stale" 시나리오에 한정.

### 진단 산출물

Phase 1~3 완료 시점에 plan 하단 `## 진단 결과` 섹션에 다음을 기록한다:

- Network 탭: `POST {supabase}/auth/v1/token` 요청 **존재 여부**, **실패 타입**(`(failed)`, `(canceled)`, `ERR_BLOCKED_BY_CLIENT`, `ERR_NAME_NOT_RESOLVED`, CORS 등)
- `navigator.serviceWorker.controller` 의 script URL (null / URL)
- 시크릿 창(확장 off) / 다른 네트워크에서의 재현 여부
- `fetch(...auth/v1/health)` 응답 코드
- CSP `connect-src` 에 supabase.co 포함 여부

## 기술적 고려사항

- **unregister ≠ uncontrol**: 현재 탭은 등록 해제 후에도 기존 SW 가 계속 control 한다. hard reload(Ctrl+Shift+R) 또는 탭 재오픈 필요.
- **토큰 원문 로깅 금지**: Phase 2 에서 callback 에 진단 로그를 추가할 때 `access_token`/`id_token` 원문을 Console 에 남기면 안 된다. `hasGoogleTokens`, `navigator.onLine`, `err.name`/`err.message` 만 기록.
- **코드 수정은 "진단 로그" 한정**: 본 plan 에서 `src/routes/auth/callback/+page.svelte` catch 블록에 `err.name` + `navigator.onLine` 만 보강한다. 그 이상의 SW/CSP/key 수정은 위임 plan 에서.
- **기존 plan 과 중복 방지**: `fix-google-login-regression` Phase 2 에도 진단 로그 강화가 포함되어 있다. 본 triage 에서 추가하는 로그는 **그 plan 이 아직 착수되지 않은 경우에만** 적용하고, 착수된 상태면 본 plan 의 Phase 2 는 스킵한다.

---

## TODO

### Phase 0: Worktree 준비

0. [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다

### Phase 1: Network 탭 기반 1차 triage (원인 버킷 특정)

1. [ ] **Network 탭에서 `auth/v1/token` 요청의 실제 상태 확인**
   - [ ] Chrome DevTools > Network 탭 open, `Preserve log` 체크 ON, `Disable cache` 체크 ON
   - [ ] 필터: `method:POST domain:supabase.co` 로 좁힌 뒤 `/auth/callback` 재접속
   - [ ] 결과 기록: 요청 **존재 여부**, Status(숫자/`(failed)`/`(canceled)`), Initiator, Timing의 `Stalled/DNS/Connection` 구간 유무 → 본 plan 하단 `## 진단 결과`에 적는다
   - [ ] 결과를 위 "원인 버킷 5종" 표와 대조해 **1차 후보 버킷(B1~B5)** 확정

2. [ ] **Service Worker 실제 제어 여부 확인 (B1 판별)**
   - [ ] DevTools > Application > Service Workers: 등록 SW 목록과 Source 필드 스크린샷 기록
   - [ ] Console: `navigator.serviceWorker.controller?.scriptURL` 출력값 기록 — null 이면 현재 탭 uncontrolled, URL 이면 적힌 script 가 여전히 intercept
   - [ ] 명령: `navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.active?.scriptURL))` → 결과 기록
   - [ ] Ctrl+Shift+R 후 재로그인 시도 결과 기록 (성공/실패)
   - [ ] `git log --oneline src/service-worker.ts` 에서 cross-origin guard 추가 커밋 확인 — 배포본이 해당 커밋 이후인지 판정

### Phase 2: 환경 격리 재현 (B2/B4 판별)

3. [ ] **브라우저 확장 격리 재현**
   - [ ] 시크릿 창(확장 비활성) 에서 로그인 재시도 → 결과 기록
   - [ ] 성공하면 B2(확장 차단) 로 확정 → 사용자에게 원인/우회 안내만 하고 코드 수정 없이 triage 종료

4. [ ] **네트워크 격리 재현**
   - [ ] 다른 네트워크(모바일 테더링 / 다른 Wi-Fi) 에서 재시도 → 결과 기록
   - [ ] Console: `await fetch('https://qxiuqztinabmdhclxsuz.supabase.co/auth/v1/health').then(r=>r.status).catch(e=>e.message)` 실행 후 값 기록
   - [ ] health 가 200 이면 Supabase 측 활성. 실패면 B5 후보 상승.

### Phase 3: CSP / 배포 헤더 점검 (B3 판별)

5. [ ] **현재 배포본 CSP 헤더 확인**
   - [ ] DevTools > Network 에서 `memo.woory.day` document 요청의 Response Headers 기록 — `Content-Security-Policy` 또는 `Content-Security-Policy-Report-Only` 존재 여부
   - [ ] 있으면 `connect-src` 항목에 `https://qxiuqztinabmdhclxsuz.supabase.co` 또는 `https://*.supabase.co` 포함 여부 기록

6. [ ] **소스에서 CSP 정의 위치 Grep**
   - [ ] `src/app.html`, `static/_headers`, `wrangler.toml`, CF Pages headers 설정에서 CSP 관련 정의 탐색
   - [ ] 발견 위치 + `connect-src` 값 기록

### Phase 4: callback 진단 로그 최소 보강 (충돌 회피 조건부)

> 조건: `fix-google-login-regression.md` 상태가 아직 `초안` 이고 구현 미착수일 때만 실행. 해당 plan 이 `구현중`/`머지대기` 이상이면 본 Phase 는 **블록쿼트로 전환**하고 스킵한다.

7. [ ] **callback 에 err 타입과 onLine 상태 로그 추가** — 토큰 비노출 보장
   - [ ] `src/routes/auth/callback/+page.svelte`: catch 블록에서 `console.error('[Auth Callback] Error:', err)` 아래에 `console.error('[Auth Callback] Diag:', { name: err instanceof Error ? err.name : 'unknown', onLine: navigator.onLine, provider: tokens?.provider })` 추가
   - [ ] `src/routes/auth/callback/+page.svelte`: token 원문(`access_token`, `id_token`) 은 절대 로그에 포함하지 않음 — 리뷰로 확인
   - [ ] `npm run check` 통과 확인

### Phase 5: 결과 요약 및 위임

8. [ ] **진단 결과를 plan 에 기록**
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: 본 plan 마지막에 `## 진단 결과` 섹션 추가 — Phase 1~3 각 항목의 실측값과 확정 버킷(B1~B5 중 1개 이상) 기입

9. [ ] **확정 버킷별 후속 처리**
   - [ ] **B1 확정**: `fix-google-login-regression.md` 로 구현 위임 (본 plan 하단에 링크와 위임 일시 기록). 추가 plan 생성 불요
   - [ ] **B2 / B4 확정**: 코드 수정 없음. 사용자에게 재현 조건과 우회 안내만 제공하고 triage 종료
   - [ ] **B3 확정**: 새 plan `YYYY-MM-DD_fix-csp-connect-src-supabase.md` 생성 요청 기록 (별도 /plan 호출로 생성)
   - [ ] **B5 확정**: 새 plan `YYYY-MM-DD_fix-supabase-project-drift-or-key.md` 생성 요청 기록 (별도 /plan 호출로 생성)
   - [ ] 다수 버킷이 동시 확정되면 각각 별도 위임 기록 (AND 관계)

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: `main merge 시도`를 owner step으로 적는다
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: `root dirty stash/apply (if needed)`를 owner step으로 적는다
   - [ ] `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

> T4/T5 해당 없음: 본 plan 은 Python 백엔드 수정이 없고 Phase 4 의 프론트엔드 코드 변경도 조건부이며 로그 추가 수준이므로 pytest 강제 Phase 규칙 미적용. Phase 1~3 의 수동 Network/Console 진단과 Phase 4 의 `npm run check` 로 검증을 대체.

---

## 검증 기준

- [ ] `## 진단 결과` 섹션에 Phase 1~3 각 실측값이 기록되어 있다
- [ ] 원인 버킷(B1~B5) 이 **근거와 함께** 1개 이상 확정되어 있다
- [ ] Phase 5 에서 확정 버킷별 후속 처리 경로(위임/신규 plan/코드 불요)가 명시되어 있다
- [ ] Phase 4 를 실행한 경우 `src/routes/auth/callback/+page.svelte` 로그에 token 원문이 없고 `npm run check` 가 통과한다

---

## 진단 결과

> Phase 1~3 완료 후 아래에 기입한다. 미완료 시 공란 유지.

- Network 탭 `auth/v1/token` 요청:
  - 존재 여부:
  - Status:
  - 실패 타입:
- `navigator.serviceWorker.controller`:
  - scriptURL:
  - Ctrl+Shift+R 후 재현:
- 시크릿 창(확장 off):
- 다른 네트워크:
- `fetch(.../auth/v1/health)`:
- CSP 존재:
  - `connect-src` supabase 포함:

**확정 버킷**:

**위임/후속**:

---

*상태: 초안 | 진행률: 0/17 (0%)*
