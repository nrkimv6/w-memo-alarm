# memo-alarm - 완료된 작업

> 이전 기록: [DONE-2026-03.md](archive/DONE-2026-03.md) | [DONE-2026-04-early.md](archive/DONE-2026-04-early.md) | [DONE-2026-04-late.md](archive/DONE-2026-04-late.md)

- [x] 2026-04-25: Safe Browsing 사기성 페이지 판정 대응 — sanitizeReturnTo + isSafeOpenUrl 전역 guard + shareReceiver 스킴 검증, 9개 window.open 경로 방어 완료 — [archive](archive/2026-04-25_fix-safe-browsing-deceptive-site.md)
- [x] 2026-04-25: 배포 후 `/settings` 500 및 `favicon.ico` 연쇄 오류 수정 — SSR store 순환 초기화 제거 + `/favicon.ico` → `/favicon.png` 리다이렉트 추가 — [archive](archive/2026-04-25_fix-ssr-store-cycle-settings-500.md)
- [x] 2026-04-24: auth/callback 토큰 위생 강화 — URL hash 제거 + Supabase origin 로그 env source 정합 — [archive](archive/2026-04-24_harden-auth-callback-token-hygiene.md)
- [x] 2026-04-24: Supabase signInWithIdToken `Failed to fetch` triage — `wrangler.toml [vars]` placeholder로 인한 runtime env drift(B5) 확정, placeholder 제거 — [archive](archive/2026-04-24_triage-supabase-signin-failed-to-fetch.md)
- [x] 2026-04-24: settings SW 메시지 상수화 — `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` → `SW_MSG.SKIP_WAITING` 교체 — [archive](archive/2026-04-24_fix-settings-page-skip-waiting-raw-string.md)
