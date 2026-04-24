# 2026-04-24 auth/callback 토큰 위생 강화 (URL hash 제거)

> 작성일시: 2026-04-24 14:59
> 기준커밋: f10fed1
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> 진행률: 0/7 (0%)
> 요약: `/auth/callback`에서 Google OAuth 토큰이 URL hash에 남아 있어 사용자 공유/스크린샷/히스토리 재진입 시 노출 위험이 있다. 토큰 파싱 직후 hash를 제거해 주소창을 정리하고, 진단 로그의 Supabase origin은 Supabase client가 쓰는 runtime env 기준으로 일치시킨다.

---

## 배경

- 기존 회귀 대응(archive): `docs/archive/2026-04-24_fix-google-login-regression.md`
- 연관 active plan: `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md` (원인 버킷 특정 전용, 본 plan과 독립)
- 현재 callback은 토큰 원문을 로그에 남기지 않도록 보강됐지만, **URL hash 자체는 주소창에 그대로 남는다**.

## 범위

- 포함:
  - `src/routes/auth/callback/+page.svelte`에서 토큰 파싱 직후 URL hash 제거
  - 진단 로그의 Supabase origin을 Supabase client가 실제로 쓰는 env 기준으로 맞춤
- 제외:
  - `auth-worker` redirect payload 구조 변경
  - 로그인 구조 변경(worker 세션 발급)

---

## TODO

### Phase 1: URL hash 제거 (토큰 위생)

1. - [ ] **토큰 파싱 직후 URL hash를 제거한다** — 주소창/히스토리 노출 최소화
   - [ ] `src/routes/auth/callback/+page.svelte`: `parseHashFragment()` 호출 결과를 `tokens`로 합친 직후 `history.replaceState(null, '', window.location.pathname + window.location.search)`로 hash 제거
   - [ ] `src/routes/auth/callback/+page.svelte`: hash 제거는 `tokens` 메모리 복사 이후에만 수행하고, `returnTo` 등 query 파라미터는 유지한다
   - [ ] `src/routes/auth/callback/+page.svelte`: 오류 경로에서도 hash 제거가 한 번은 실행되도록 try 블록 초반(토큰 파싱 직후)에 배치한다

### Phase 2: 진단 로그 env 정합

2. - [ ] **Supabase origin 로그를 runtime public env 기준으로 맞춘다**
   - [ ] `src/routes/auth/callback/+page.svelte`: `supabaseOrigin` 계산에 `import { env } from '$env/dynamic/public'`를 사용해 `env.PUBLIC_SUPABASE_URL` 기반 origin을 로그한다
   - [ ] `src/routes/auth/callback/+page.svelte`: env 파싱 실패 시 `supabaseOrigin: null`로 로그하고 예외를 던지지 않는다

### Phase 3: 정적 검증

3. - [ ] **정적 검증으로 회귀를 차단한다**
   - [ ] 프로젝트 루트: `npm run check` 통과
   - [ ] 프로젝트 루트: `npm run build` 통과

---

## 검증

- Chrome에서 `/auth/callback` 진입 직후 주소창에 `#access_token=...&id_token=...`가 남지 않아야 한다.
- 콘솔 로그에 토큰 원문이 없어야 한다.

---

*상태: 검토완료 | 진행률: 0/7 (0%)*
