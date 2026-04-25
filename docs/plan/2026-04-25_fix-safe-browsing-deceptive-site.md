# Safe Browsing 사기성 페이지 판정 대응 계획

> 작성일시: 2026-04-25 00:32
> 기준커밋: ac67bf9
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/35 (0%)
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

0. [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 감지 범위 확정

1. [ ] **Safe Browsing이 볼 수 있는 의심 경로를 우선순위화** — Search Console 예시 URL 부재 대응
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `/`, `/auth/callback`, `/share`, 알림 클릭 진입을 우선 조사 대상으로 고정하고 이유를 기록한다
   - [ ] `src/routes/auth/callback/+page.svelte`: hash/query token 파싱, `returnTo`, `window.location.href` 흐름을 읽고 외부 리디렉트 가능성을 정리한다
   - [ ] `src/routes/share/+page.svelte`, `src/lib/utils/shareReceiver.ts`: 공유 URL/텍스트가 어떤 UI로 노출되는지와 클릭 가능한지 여부를 조사한다
   - [ ] `src/lib/stores/auth.svelte.ts`, `src/routes/+layout.svelte`: 로그인 시작점과 로그인 후 초기화 중 자동 외부 이동이 있는지 경로를 추적한다

### Phase 2: 로그인 리디렉트 surface 차단

2. [ ] **콜백과 로그인 시작점의 open redirect 여지를 제거** — 피싱 판정 최우선 후보 방어
   - [ ] `src/routes/auth/callback/+page.svelte`: `sanitizeReturnTo()`가 이미 로컬 수정에 존재한다. `new URL(returnTo, origin).origin !== origin` 체크, `/login` 강등, 파싱 실패 → `/` fallback을 코드로 검증하고, 부족한 경우에만 보완한다 (기본값 검증 후 커밋)
   - [ ] `src/routes/auth/callback/+page.svelte`: 잘못된 `returnTo`가 들어와도 토큰/민감정보를 로그에 남기지 않고 최소 진단 정보만 남기도록 정리한다
   - [ ] `src/lib/stores/auth.svelte.ts`: 로그인 시작 시 전달하는 `returnTo`를 승인된 앱 내부 경로로 제한하고 query/hash 재전달 여부를 검토한다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: repo 밖 `auth.woory.day`가 동일 규칙을 적용했는지 확인할 인수인계 체크리스트를 추가한다

### Phase 3: 공유/외부 URL 진입점 정리

3. [ ] **사용자 입력 URL과 외부 열기 흐름을 명시적으로 통제** — social engineering 오인 방지
   - [ ] `src/lib/utils/shareReceiver.ts`: `parseSharedDataFromParams()`에서 `url = params.get('url')` 대입 전 스킴 검증을 추가해 `http`/`https` 외(`javascript:`, `data:`, `file:`)는 `undefined`로 대체한다. `extractUrlFromText()`는 이미 `https?://` 정규식만 추출하므로 변경 불필요
   - [ ] `src/routes/share/+page.svelte`: 공유받은 URL은 신뢰 배지처럼 보이지 않게 단순 텍스트로 표시하고, 저장 전 검증 실패를 사용자에게 드러내도록 정리한다
   - [ ] `src/lib/utils/url.ts`(신규): `isSafeOpenUrl(url: string): boolean` 함수를 추가해 `https?://` 스킴만 허용한다. `src/lib/stores/notifications.svelte.ts:483`과 `src/lib/components/memo/TodayReminders.svelte:35`의 `window.open(memo.url, '_blank')` 직전에 호출해 `false` 시 차단한다
   - [ ] `src/service-worker.ts:634`: `externalUrl` 판별식 `data.url.startsWith('http')`은 이미 `http://`/`https://`를 통과시킨다. Phase 3.3의 `isSafeOpenUrl` 기준과 명시적으로 일치시키고, 비-TLS `http://` 허용 여부를 주석으로 명기한다

### Phase 4: SW/검증/재검토 준비

4. [ ] **재검토 요청에 필요한 증빙과 잔여 리스크를 정리** — 수정 후 Search Console 대응까지 한 흐름으로 묶기
   - [ ] `static/firebase-messaging-sw.js`, `src/lib/fcm.ts`: 루트 scope FCM SW 등록이 SvelteKit SW와 충돌해 진단을 혼탁하게 만드는지 점검하고 분리 계획을 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: URL Inspection Live Test, Chrome interstitial 재현, Search Console Security Issues 스크린샷 확보 절차를 단계별로 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: Google 재검토 요청 초안에 포함할 요약 문장, 수정 파일 목록, “false positive인지 실제 redirect 위험인지” 판정 기준을 정리한다
   - [ ] `TODO.md`: 이 계획서를 Pending backlog에 연결하고 이후 `/implement`, `/done`이 진행률을 갱신할 기준 링크를 남긴다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `main merge 시도`를 owner step으로 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `root dirty stash/apply (if needed)`를 owner step으로 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다
   - [ ] `docs/plan/2026-04-25_fix-safe-browsing-deceptive-site.md`: Search Console 재검토 제출 후 결과 회수와 archive 전 상태 업데이트를 owner 후속 작업으로 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

## 작업 수 요약

- Phase 0: Worktree 준비 (5개 체크박스)
- Phase 1: 감지 범위 확정 (5개 체크박스)
- Phase 2: 로그인 리디렉트 surface 차단 (5개 체크박스)
- Phase 3: 공유/외부 URL 진입점 정리 (5개 체크박스)
- Phase 4: SW/검증/재검토 준비 (5개 체크박스)
- Phase Z: Post-Merge Cleanup (5개 체크박스)
- 검증: 5개 체크박스
- 총 35개 체크박스

## 검증

- [ ] `sanitizeReturnTo()`가 외부 origin URL, `/login`, 프로토콜 상대 URL(`//evil.com`)을 모두 `/`로 강등한다 (코드 검증)
- [ ] `/share?url=javascript:alert(1)` 진입 시 해당 URL이 `undefined`로 처리되어 메모에 저장되지 않는다 (브라우저 확인)
- [ ] `isSafeOpenUrl('javascript:...')` → `false`, `isSafeOpenUrl('https://example.com')` → `true` (단위 검증)
- [ ] `npm run check`가 타입 오류 없이 통과한다
- [ ] `npm run build`가 빌드 오류 없이 통과한다

---

*상태: 초안 | 진행률: 0/35 (0%)*
