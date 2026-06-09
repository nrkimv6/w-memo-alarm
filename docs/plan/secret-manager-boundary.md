# Secret Manager Boundary — w-memo-alarm

> 작성: 2026-06-09
> 관련 계획서: `2026-06-08_public_gcp_free_tier_roadmap_todo-11.md`

이 문서는 w-memo-alarm 프로젝트에서 어떤 secret을 어디에 보관해야 하는지 기준을 정의한다.
현재 이 앱은 server-side worker/API가 없으므로 GCP Secret Manager는 **미적용** 상태다.

---

## 1. Secret source-of-truth 분류표

| Secret 항목 | 분류 | 현재 저장 위치 (source-of-truth) | client bundle 포함 |
|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | Public config | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_SUPABASE_ANON_KEY` | Public config | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_API_KEY` | Public config (FCM Web) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_AUTH_DOMAIN` | Public config (FCM Web) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_PROJECT_ID` | Public config (FCM Web) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_STORAGE_BUCKET` | Public config (FCM Web) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public config (FCM Web) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_APP_ID` | Public config (FCM Web) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| `PUBLIC_FIREBASE_VAPID_KEY` | Public config (Web Push) | Cloudflare dashboard vars (prod) / `.dev.vars` (local) | 허용 |
| Firebase Admin SDK private key | **Server secret** | **미사용** — server-side 추가 시 GCP Secret Manager | 금지 |
| GCP service account JSON | **Server secret** | **미사용** — server-side 추가 시 GCP Secret Manager | 금지 |
| Supabase service role key | **Server secret** | **미사용** — server-side 추가 시 GCP Secret Manager 또는 Cloudflare Worker Secrets | 금지 |

### 분류 근거

- **Public config**: Firebase Web client config (`apiKey`, `appId` 등)는 브라우저 JS에 노출되어도 무방한 공개 식별자다. Firebase 접근 제어는 Firestore Security Rules와 Firebase Auth가 담당하며, 이 키만으로는 Admin 권한 없이 서버 자원에 접근할 수 없다.
- **Supabase anon key**: Row-Level Security(RLS)가 활성화된 경우 클라이언트 측 노출이 허용된다. service role key는 RLS를 우회하므로 절대 client bundle에 포함하지 않는다.
- **VAPID key**: Web Push 구독을 위한 공개 키 쌍의 public 부분. 브라우저에 노출 가능하다.

---

## 2. GCP Secret Manager 적용 기준

### 기본값: ENABLE_SECRET_MANAGER=false

Secret Manager는 현재 **비활성** 상태이며, 아래 조건이 충족될 때만 적용한다.

```
ENABLE_SECRET_MANAGER=false  (기본값, 변경 금지 — 조건 충족 전)
```

### 적용 조건 (AND)

다음 두 조건이 **모두** 충족되어야 Secret Manager를 활성화한다:

1. **server-side worker 또는 API route가 추가되는 시점**
   - Cloudflare Worker, SvelteKit server route(`+server.ts`), Supabase Edge Function 중 하나가 추가될 때
   - 해당 코드가 Firebase Admin SDK, GCP API, 또는 Supabase service role key를 직접 호출할 때

2. **Cloudflare Worker Secrets만으로 비밀 관리가 불충분한 시점**
   - 여러 서비스(Worker + Edge Function + Cloud Run 등)가 같은 secret을 공유해야 할 때
   - 자동 rotation 또는 audit log가 필요할 때

### 적용 전까지의 대안

- **Cloudflare Workers**: Cloudflare dashboard > Workers > Settings > Variables (encrypted)
  - `wrangler secret put SECRET_NAME` CLI로 추가
  - `wrangler.toml`의 `[vars]`에 실제 값을 넣지 않는다 (대시보드 값 덮어쓰기 방지)
- **Supabase Edge Functions**: Supabase dashboard > Project Settings > Edge Functions > Secrets

---

## 3. Secret Manager 과금 경고

GCP Secret Manager는 아래 한도를 초과하면 **유료**로 전환된다.

| 항목 | 무료 한도 | 초과 시 과금 |
|---|---|---|
| 활성 secret 버전(active versions) | **6개** | $0.06 / version / month |
| 접근 요청(access requests) | 10,000회/월 | $0.03 / 10,000 requests |

### ⚠️ 활성 버전 6개 초과 경고

Secret Manager를 도입할 경우 아래를 반드시 준수한다:

1. **버전 정리 자동화**: 새 버전 추가 시 이전 버전을 즉시 `DISABLED` 또는 `DESTROYED`로 전환한다.
2. **활성 버전 총합 ≤ 5 유지**: 여유 버퍼 1개를 남기고 5개 이하로 관리한다.
3. **배포 파이프라인에서 검증**: CI/CD에서 `gcloud secrets versions list --filter=state=ENABLED` 결과가 6개를 넘으면 경고 또는 실패 처리한다.
4. **테스트용 버전 생성 금지**: 로컬 개발·테스트 목적으로 Secret Manager 버전을 생성하지 않는다. 로컬은 `.dev.vars`를 사용한다.

### 무료 한도 내 운영 시나리오

이 앱의 server-side 코드가 추가되더라도 아래 전략으로 무료 한도 내에서 운영 가능하다:

- 관리 대상 secret: Firebase Admin key (1), Supabase service role key (1) → 총 활성 버전 2개
- rotation 주기: 90일 이상 (기존 버전 disable 후 새 버전 활성화 → 활성 버전 1개 증가 후 즉시 정리)
- 접근 빈도: Cloudflare Worker cold start 시 1회 → 하루 수십~수백 회 수준, 10,000회/월 이내

---

## 4. 현재 상태 요약

```
현재 server-side 코드: 없음
현재 Secret Manager 상태: 미적용 (ENABLE_SECRET_MANAGER=false)
현재 활성 버전 수: 0
다음 검토 시점: server-side worker/API 추가 PR 생성 시
```

---

## 5. 관련 파일

- `src/lib/config.ts` — public config vs secret 경계 주석
- `src/lib/fcm.ts` — Firebase public config ($env/static/public 사용)
- `src/lib/services/supabase.ts` — Supabase public config
- `static/firebase-messaging-sw.js` — SW 인라인 FCM public config (secret 없음, 주석으로 명시)
- `wrangler.toml` — Cloudflare Workers 배포 설정 ([vars] 플레이스홀더 없음)
- `.dev.vars` (gitignored) — 로컬 개발용 환경 변수
