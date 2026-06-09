# nrkimv6 Public Repo GCP Free-Tier 적용 로드맵 — TODO 11

> 계획서: monitor-page plans (D:\work\project\tools\monitor-page\.worktrees\plans\docs\plan\2026-06-08_public_gcp_free_tier_roadmap.md)
> 대상 프로젝트: w-memo-alarm
> 실행순서: 11
> 선행조건: 없음
> branch:
> worktree:
> worktree-owner:
> 테스트명령: Svelte 변경 시 npm check, live 검증은 merge 이후
> 진행률: 7/7 (100%)
> 요약: existing public Svelte repo인 `w-memo-alarm`의 FCM/Supabase secret boundary를 정리한다.

## TODO

### Phase 1: Config Boundary

1. - [x] **public config 확인** — client bundle 유입 검사
   - [x] `src/lib/config.ts`: public config와 secret 후보를 분리한다
   - [x] `static/firebase-messaging-sw.js`: FCM public config와 server credential이 섞이지 않았는지 확인한다

2. - [x] **Secret Manager 적용 기준 작성** — 즉시 이전 아님
   - [x] `README.md`: Cloudflare/Firebase/GCP secret 위치 중 source-of-truth 후보를 기록한다
   - [x] `docs/plan`: Secret Manager는 server-side worker/API가 생길 때만 적용한다고 명시한다
   - [x] `docs/plan`: Secret Manager 적용 시에도 옵션 플래그(`ENABLE_SECRET_MANAGER`, 기본값 `false`)로 gate하고 기본 disable로 둔다고 명시한다 (활성 버전 6개 초과 시 과금)

### 검증 기준 (RIGHT-BICEP TC)

- **R**ight: `src/lib/config.ts`에서 public config와 secret 후보가 정확히 분리된다.
- **B**oundary: client bundle에 secret이 0건 포함된다.
- **I**nverse: `static/firebase-messaging-sw.js`에 FCM public config와 server credential이 혼입되지 않음을 역검증한다.
- **C**ross-check: README의 source-of-truth 후보와 실제 secret 위치(Cloudflare/Firebase/GCP)를 교차 확인한다.
- **E**rror: secret이 client bundle에 유입되면 표시/차단한다.
- **P**erformance/cost: `ENABLE_SECRET_MANAGER=false` 기본값, server-side worker/API 부재 시 미적용 → 과금 0.

---

*진행률: 7/7 (100%)*
