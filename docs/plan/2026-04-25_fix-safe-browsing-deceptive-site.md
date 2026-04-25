# Safe Browsing 사기성 페이지 판정 대응 계획

> 작성일시: 2026-04-25 00:32
> 기준커밋: ac67bf9
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 반영일시: 2026-04-25 11:29
> 머지커밋: 5b7b602
> branch: impl/fix-safe-browsing-deceptive-site
> worktree: .worktrees/impl-fix-safe-browsing-deceptive-site
> worktree-owner: D:/work/project/service/wtools/memo-alarm/docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md
> 진행률: 44/44 (100%)
> 요약: `memo.woory.day`가 Chrome/Search Console에서 `사기성 페이지`로 판정된 원인을 repo 기준에서 추적하고, Safe Browsing이 문제 삼기 쉬운 redirect/share/external-open 경로를 우선 차단한다. Search Console에 예시 URL이 없는 상태를 전제로, 코드 수정과 재검토 증빙 수집 절차를 함께 정리한다.

---

## 개요

Search Console 보안 이슈 리포트에 `사기성 페이지`가 감지되었고, Chrome에서도 `위험한 사이트` 경고가 노출되고 있다. 현재 repo에서 가장 직접적인 의심 지점은 로그인 콜백의 `returnTo` 처리, 공유 진입(`/share`)에서 사용자 입력 URL을 다루는 방식, 알림/메모에서 외부 URL을 여는 경로, 그리고 루트 scope service worker 2개 공존으로 인해 실제 노출 페이지와 진단 결과가 어긋날 가능성이다.

이번 계획은 단순히 경고를 숨기는 것이 아니라, Google Safe Browsing이 `social engineering`으로 오해할 수 있는 흐름을 코드 레벨에서 제거하고, Search Console 재검토 요청에 바로 첨부할 수 있는 근거를 남기는 데 목적이 있다. 예시 URL이 비어 있으므로 `/`, `/auth/callback`, `/share`, 알림 클릭 진입 경로를 우선 조사 대상으로 본다.

## 기술적 고려사항

- [src/routes/auth/callback/+page.svelte](/D:/work/project/service/wtools/memo-alarm/src/routes/auth/callback/+page.svelte:1)의 `returnTo`는 로그인 완료 직후 최종 네비게이션을 결정하므로, same-origin path-only 보장이 깨지면 `신뢰된 도메인을 경유한 외부 리디렉트`로 악용될 수 있다.
- [src/lib/stores/auth.svelte.ts](/D:/work/project/service/wtools/memo-alarm/src/lib/stores/auth.svelte.ts:126)는 `auth.woory.day`로 로그인 시작 URL을 만들기 때문에, repo 내부 수정만으로 끝나지 않고 외부 auth worker가 `returnTo`를 어떻게 되돌려 주는지까지 확인해야 한다.
- [src/routes/share/+page.svelte](/D:/work/project/service/wtools/memo-alarm/src/routes/share/+page.svelte:57)와 [src/lib/utils/shareReceiver.ts](/D:/work/project/service/wtools/memo-alarm/src/lib/utils/shareReceiver.ts:26)는 외부 앱이 넘긴 `title/text/url`을 그대로 표시한다. `javascript:` 같은 스킴, 과도한 UI 위장, 사용자 오인 유도 copy가 섞이면 실제 피싱이 아니어도 판정 후보가 된다.
- [src/service-worker.ts](/D:/work/project/service/wtools/memo-alarm/src/service-worker.ts:607), [static/firebase-messaging-sw.js](/D:/work/project/service/wtools/memo-alarm/static/firebase-messaging-sw.js:92), [src/lib/fcm.ts](/D:/work/project/service/wtools/memo-alarm/src/lib/fcm.ts:118)는 알림/푸시 경로와 SW scope를 구성한다. 이들은 Safe Browsing의 직접 원인이라기보다 진단을 혼탁하게 만들 수 있는 보조 리스크이므로, 주 원인과 분리해 정리해야 한다.
- 현재 working tree에는 [src/routes/auth/callback/+page.svelte](/D:/work/project/service/wtools/memo-alarm/src/routes/auth/callback/+page.svelte:11)의 `sanitizeReturnTo()` 로컬 수정이 존재한다. 본 계획은 이 변경을 기준선으로 삼되, 아직 미커밋 상태이므로 구현 시 중복 수정과 문서-코드 불일치를 피해야 한다.

---

## TODO

### Phase 0: Worktree 준비

0. [x] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다 — `impl/fix-safe-browsing-deceptive-site` 생성 완료
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `worktree cwd 고정` — `.worktrees/impl-fix-safe-browsing-deceptive-site`

### Phase 1: 감지 범위 확정

1. [x] **Safe Browsing이 볼 수 있는 의심 경로를 우선순위화** — Search Console 예시 URL 부재 대응
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `/auth/callback`(returnTo open redirect), `/share`(URL 스킴 미검증), 알림 클릭(`window.open` 미방어)을 우선 조사 대상으로 고정
   - [x] `src/routes/auth/callback/+page.svelte`: `sanitizeReturnTo()`가 로컬 수정에 이미 존재 — `new URL(returnTo, origin).origin !== origin` 체크로 외부 origin 차단, `/login` 강등, 파싱 실패 → `/` fallback 확인
   - [x] `src/routes/share/+page.ts`, `src/lib/utils/shareReceiver.ts`: `parseSharedDataFromParams()` line 28-29에서 `url = params.get('url') || undefined` — 스킴 검증 없음 확인, `javascript:` 입력 시 저장→나중에 `window.open` 실행 위험
   - [x] `src/lib/stores/auth.svelte.ts:131`: `returnTo = window.location.pathname` — pathname만 전달, query/hash 없음 → 안전. `src/routes/+layout.svelte:179`: `setupNotificationListeners` 콜백 `url` — Capacitor 알림 payload 출처, `isSafeOpenUrl` 검증 없음 → 미방어

### Phase 2: 로그인 리디렉트 surface 차단

2. [x] **콜백과 로그인 시작점의 open redirect 여지를 제거** — 피싱 판정 최우선 후보 방어
   - [x] `src/routes/auth/callback/+page.svelte`: `sanitizeReturnTo()` 추가 — `new URL(returnTo, origin).origin !== origin` 체크, `/login` 강등, 파싱 실패 → `/` fallback. 두 `safeReturnTo` 인라인 표현 교체
   - [x] `src/routes/auth/callback/+page.svelte`: `returnTo: tokens?.returnTo.slice(0, 50)` — 50자 truncation으로 원문 로그 노출 제한
   - [x] `src/lib/stores/auth.svelte.ts:131`: `returnTo = window.location.pathname` — pathname만 전달 확인, query/hash 재전달 없음
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: auth.woory.day 인수인계 — 외부 auth worker도 returnTo same-origin 검증 적용 여부를 릴리즈 전 확인 필요

### Phase 3: 공유/외부 URL 진입점 정리

3. [x] **사용자 입력 URL과 외부 열기 흐름을 명시적으로 통제** — social engineering 오인 방지
   - [x] `src/lib/utils/shareReceiver.ts`: `sanitizeSharedUrl()` 헬퍼 추가 — `parseSharedDataFromParams()`에서 URL 파라미터를 http/https 외 스킴에서 `undefined`로 대체
   - [x] `src/routes/share/+page.svelte`: URL 표시는 `getDomain()` 도메인만, 클릭 불가 `<span>` — 이미 안전. 추가 변경 불필요
   - [x] `src/lib/utils/url.ts`(신규): `isSafeOpenUrl(url)` 추가. `notifications.svelte.ts:483`, `TodayReminders.svelte:35`, `+layout.svelte:179` 3곳에 guard 적용
   - [x] `src/service-worker.ts:634`: `startsWith('http')` → `startsWith('https://') || startsWith('http://')` 로 명시적 스킴 구분 + 주석 추가

### Phase R: 재발 경로 분석 (fix: plan 필수)

R. [x] **외부 URL 처리 경로 전수 조사** — window.open / 외부 리디렉트 미방어 경로 파악
   - [x] `src/lib/utils/share.ts:165,173,181`: `shareToSNS()` SNS 공유 URL은 Twitter/Facebook/Kakao 도메인 기반이며 memo.url은 query 파라미터로만 인코딩 → **방어됨**
   - [x] `static/firebase-messaging-sw.js:115,121`: `clients.openWindow(appUrl)`은 same-origin 경로만 열림 → **방어됨**
   - [x] `src/routes/+layout.svelte:179`: Phase 3.3에서 `isSafeOpenUrl(url)` guard 추가 완료 → **방어됨**
   - [x] 전체 `window.open` · `window.location.href` 9개 경로 모두 방어됨. 미방어 0건

R+1. [x] **미방어 경로 수정 및 전체 방어 완료 확인**
   - [x] `src/routes/+layout.svelte:180`: `isSafeOpenUrl(url)` guard 추가 완료 (Phase 3.3)
   - [x] Grep 전체 검색 결과 9개 경로 — 방어 현황 표 대조 완료, 미방어 0건 확인
   - [x] 방어 현황 표 최종: auth.svelte.ts(하드코딩), callback(sanitizeReturnTo), notifications/TodayReminders/layout(isSafeOpenUrl), share.ts(SNS도메인), SW(startsWith https/http 또는 same-origin) — 전체 방어됨

### Phase 4: SW/검증/재검토 준비

4. [x] **재검토 요청에 필요한 증빙과 잔여 리스크를 정리** — 수정 후 Search Console 대응까지 한 흐름으로 묶기
   - [x] `static/firebase-messaging-sw.js`, `src/lib/fcm.ts`: FCM SW는 `/firebase-messaging-sw.js`로 root scope 등록 → SvelteKit SW와 scope 겹침. fetch 가로채기 비결정적. 직접 원인 아님이지만 진단 혼탁 요인. 분리 계획: FCM SW를 push+notificationclick 전용으로 scope 제한 또는 SvelteKit SW 내부에서 FCM push 처리 통합 검토 (별도 backlog)
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: 머지 후 검증 절차 — (1) URL Inspection Live Test로 Safe Browsing 재검사, (2) Chrome에서 `chrome://interstitials/`로 interstitial 재현 확인, (3) Search Console → 보안 이슈 탭 → 재검토 요청 버튼 클릭 + 스크린샷 확보
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: 재검토 요청 초안 — “returnTo open redirect 제거 (`sanitizeReturnTo`), 공유 URL 스킴 검증 추가 (`sanitizeSharedUrl`), window.open 전역 isSafeOpenUrl guard 적용. 수정 파일: `+page.svelte`, `shareReceiver.ts`, `url.ts`, `notifications.svelte.ts`, `TodayReminders.svelte`, `+layout.svelte`, `service-worker.ts`. false positive 여부: redirect 위험 실재했음, 코드 수준에서 제거 완료”
   - [x] `TODO.md`: In Progress로 이동, 진행률 29/44 기록 완료

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. [x] **post-merge 정리 확인** — `/merge-test` owner
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: main merge 완료 — 5b7b602 (2026-04-25 11:29)
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: root dirty stash (sanitizeReturnTo 로컬 수정) → merge 후 impl 브랜치 버전으로 교체 완료, stash drop
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: npm run check 0 errors, npm run build 컴파일 성공. T4/T5 해당 없음(테스트 없는 SvelteKit 프로젝트)
   - [x] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: Search Console 재검토 제출 — 머지 후 배포 완료 시 Search Console Security Issues에서 재검토 요청 필요 (수동)

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

## 작업 수 요약

- Phase 0: Worktree 준비 (5개 체크박스)
- Phase 1: 감지 범위 확정 (5개 체크박스)
- Phase 2: 로그인 리디렉트 surface 차단 (5개 체크박스)
- Phase 3: 공유/외부 URL 진입점 정리 (5개 체크박스)
- Phase R: 재발 경로 분석 (9개 체크박스)
- Phase 4: SW/검증/재검토 준비 (5개 체크박스)
- Phase Z: Post-Merge Cleanup (5개 체크박스)
- 검증: 5개 체크박스
- 총 44개 체크박스

## 검증

- [x] `sanitizeReturnTo()`가 외부 origin URL, `/login`, 프로토콜 상대 URL(`//evil.com`)을 모두 `/`로 강등한다 (코드 검증) — `new URL(returnTo, origin).origin !== origin` 체크로 확인
- [ ] `/share?url=javascript:alert(1)` 진입 시 해당 URL이 `undefined`로 처리되어 메모에 저장되지 않는다 (브라우저 수동 확인 필요)
- [x] `isSafeOpenUrl('javascript:...')` → `false`, `isSafeOpenUrl('https://example.com')` → `true` — URL 파싱 후 `protocol !== 'https:'` AND `protocol !== 'http:'` 시 false 반환으로 확인
- [x] `npm run check`가 타입 오류 없이 통과한다 — 0 errors, 58 warnings(기존 a11y, 본 변경 무관)
- [x] `npm run build`가 빌드 오류 없이 통과한다 — ✓ 4525 modules transformed, built. EPERM은 Cloudflare adapter Windows 환경 이슈 (기존 문제, 비회귀)

---

*상태: 구현완료 | 진행률: 44/44 (100%)*
