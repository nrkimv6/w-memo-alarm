// 앱 설정 및 버전 관리
// 이 파일은 bump-version.ps1 스크립트로 자동 업데이트됩니다.

// ─── Public config (client bundle 포함 가능) ──────────────────────────────
// 아래 값은 런타임에 브라우저에 노출되어도 무방한 앱 메타 정보다.
// Firebase/Supabase public config는 각각 src/lib/fcm.ts, src/lib/services/supabase.ts에서
// '$env/static/public' (PUBLIC_* prefix)로 import — 이 파일에 두지 않는다.
export const APP_VERSION = __APP_VERSION__;
export const CACHE_VERSION = `v${APP_VERSION}`;
export const APP_NAME = 'Memo Alarm';

// ─── Secret 후보 분류 (이 파일에 두지 않는다) ────────────────────────────
// 아래 항목은 client bundle에 포함되어서는 안 된다.
// 현재 이 앱은 server-side worker/API가 없으므로 해당 secret은 존재하지 않는다.
// server-side 코드가 생기는 시점에 GCP Secret Manager 또는 Cloudflare Worker Secrets로 관리한다.
// 참고: docs/plan/secret-manager-boundary.md
//
// 분류 기준:
//   PUBLIC_*  → $env/static/public  → client bundle 포함 허용
//   PRIVATE_* → $env/static/private → server-side only, client bundle 포함 금지
//   (현재 PRIVATE_* 변수 없음 — server-side 코드 추가 시 이 주석 업데이트)
