# Postmortem: 구글 로그인 전면 실패 (2026-04-24)

> 작성일: 2026-04-24  
> 심각도: P0 — 구글 로그인 전면 불가  
> 영향 범위: memo.woory.day 구글 OAuth 로그인 전체  
> 복구 완료: 2026-04-24

---

## 요약

`npm run check` 에러를 수정하는 과정에서 `supabase.ts`의 환경 변수 읽기 방식을 `$env/static/public` → `$env/dynamic/public`으로 교체했다. 이 변경이 배포되자 `wrangler.toml [vars]`에 있던 placeholder URL(`https://your-project.supabase.co`)이 Cloudflare 런타임 env로 주입되어 Supabase auth API 호출이 DNS 실패로 전면 차단됐다.

---

## 타임라인

| 시각 | 이벤트 |
|------|--------|
| 2026-02-22 | `b5d606d`: `wrangler.toml [vars]`에 placeholder URL/key 추가 (문서화 의도) |
| 2026-04-24 10:16 | `bd2e8ca`: svelte-check 에러 수정 중 `supabase.ts` → `$env/dynamic/public` 전환 |
| 2026-04-24 (이후) | `wrangler deploy` 실행 → `[vars]` placeholder가 Cloudflare runtime env 덮어씌움 |
| 2026-04-24 | 구글 로그인 시 `POST https://your-project.supabase.co/auth/v1/token` → `ERR_NAME_NOT_RESOLVED` |
| 2026-04-24 | 사용자 신고 → triage 시작 |
| 2026-04-24 | `38893a7`: `wrangler.toml [vars]` placeholder 제거 |
| 2026-04-24 | Cloudflare dashboard에서 실제 URL/key 확인 후 `wrangler deploy` → 복구 |
| 2026-04-24 | `18fb9b2`: `$env/static/public` 롤백 |

---

## 근본 원인 분석

### 직접 원인 (Proximate Cause)

`bd2e8ca`에서 `supabase.ts`를 `$env/static/public` → `$env/dynamic/public`으로 전환하면서, Cloudflare runtime env에 잘못된 값이 있을 경우 그 값이 그대로 사용된다는 사실을 검증하지 않았다.

### 근본 원인 (Root Cause)

**워크트리 환경 아티팩트를 실제 코드 문제로 오판했다.**

워크트리에는 `node_modules`가 없어 `.svelte-kit/ambient.d.ts`가 항상 비거나 stale하다. 이로 인해 `$env/static/public`의 named export가 없다는 svelte-check 에러가 발생했다. 이 에러는 워크트리 구조적 한계에서 나온 **false positive**였으나, 계획서는 이를 "실제 코드 문제"로 분류하고 코드를 수정했다.

CLAUDE.md에 명시된 규칙:
> `npm run build`/`npm run check` 실행 금지 — 워크트리에는 `node_modules`가 없어 구조적으로 불가. `/merge-test`에서 main 머지 후 실행.

이 규칙이 있었음에도 워크트리에서 svelte-check를 실행하고, 그 결과를 코드 수정 근거로 삼았다.

### 기여 요인 (Contributing Factors)

1. **`wrangler.toml [vars]` placeholder 존재** (`b5d606d`, 2026-02-22)  
   `[vars]` 섹션은 `wrangler deploy` 시 Cloudflare dashboard 값을 덮어쓴다는 사실을 인지하지 못하고 "문서화용 template"으로 추가됐다.

2. **review-plan 체크 미비**  
   `/review-plan` 스킬이 "환경 아티팩트 기인 변경"을 감지하는 체크를 보유하지 않아, 계획서 검토 단계에서 이 패턴이 통과됐다.

3. **`$env/dynamic/public` 전환 시 프로덕션 env 검증 부재**  
   런타임 env 의존 방식으로 전환할 때 "Cloudflare runtime env에 올바른 값이 있는가"를 확인하는 단계가 없었다.

---

## 영향

- **서비스**: memo.woory.day
- **기능**: 구글 OAuth 로그인 전면 불가 (카카오 로그인은 별도 경로라 영향 없음)
- **DB 읽기/쓰기**: 기존 세션 유지 사용자는 정상 동작
- **신규 로그인**: 완전 불가

---

## 해결 방법

1. `wrangler.toml [vars]` placeholder 제거 (`38893a7`) — 이후 deploy 시 dashboard 값 보존
2. Cloudflare dashboard `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` 실제 값 확인
3. `wrangler deploy` — 올바른 값으로 배포
4. `$env/static/public` 롤백 (`18fb9b2`) — 빌드타임 검증으로 복귀

---

## 재발 방지

### 즉시 조치 (완료)

| 조치 | 커밋 |
|------|------|
| `wrangler.toml [vars]` placeholder 제거 | `38893a7` |
| `supabase.ts`, `fcm.ts` → `$env/static/public` 롤백 | `18fb9b2` |

### 프로세스 개선

| # | 개선 사항 | 상태 |
|---|----------|------|
| 1 | `/review-plan` 스킬에 "환경 오염 / 임시 해법 감지" 체크(H) 추가 | plan 작성 완료 (`2026-04-24_fix-review-plan-env-contamination-check.md`) |

### 설계 원칙 (이 사고에서 확립)

**`$env/static/public` vs `$env/dynamic/public` 선택 기준:**

| 조건 | 권장 |
|------|------|
| 값이 배포마다 바뀌지 않는 고정 상수 (Supabase URL, Firebase 프로젝트 ID 등) | `$env/static/public` |
| 빌드 없이 런타임에서 교체해야 하는 값 (A/B test 플래그 등) | `$env/dynamic/public` |

`$env/static/public`의 장점: 값 누락 시 **빌드 실패** → 즉시 발각. `$env/dynamic/public`은 런타임 침묵 실패 위험이 있다.

**워크트리 svelte-check 에러 처리 원칙:**

워크트리에서 발생한 `$env/static/public` 관련 에러는 **환경 아티팩트**로 간주하고 코드를 수정하지 않는다. svelte-check는 `/merge-test` 이후 main에서만 실행한다.

---

## 관련 커밋

```
b5d606d  (2026-02-22) fix: wrangler.toml vars 추가 — placeholder 추가 (원인 시점)
bd2e8ca  (2026-04-24) fix: clear svelte-check errors — $env/dynamic/public 전환 (장애 유발)
38893a7  (2026-04-24) fix: wrangler.toml [vars] placeholder 제거 (1차 복구)
18fb9b2  (2026-04-24) fix: revert to static/public env (근본 복구)
```
