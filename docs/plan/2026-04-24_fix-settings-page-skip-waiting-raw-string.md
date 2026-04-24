# fix: settings/+page.svelte SKIP_WAITING postMessage raw string 교체

> 작성일시: 2026-04-24
> 기준커밋: 888fc2b
> 대상 프로젝트: memo-alarm
> 상태: 머지대기
> branch: impl/fix-settings-page-skip-waiting-raw-string
> worktree: .worktrees/impl-fix-settings-page-skip-waiting-raw-string
> worktree-owner: codex
> 진행률: 15/21 (71%)
> 요약: `REGISTER/REMOVE_TODO_NOTIFICATIONS` fix와 동일 패턴 — `routes/settings/+page.svelte:144`에서 메인 스레드 발신 측이 `type: 'SKIP_WAITING'`을 raw string으로 postMessage한다. `SW_MSG.SKIP_WAITING` 상수로 교체하면 타이포 위험을 제거할 수 있다.
> 출처: /reflect에서 자동 생성

---

## 개요

`src/routes/settings/+page.svelte:144`는 SW 대기 인스턴스에 `{ type: 'SKIP_WAITING' }` 메시지를 raw string으로 postMessage한다.

```typescript
if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
```

`swMessages.ts`에는 이미 `SKIP_WAITING: 'SKIP_WAITING'` 상수가 존재한다. 이번 `REGISTER/REMOVE_TODO_NOTIFICATIONS` fix와 동일 패턴으로 메인 스레드 발신 측에서 raw string 대신 `SW_MSG.SKIP_WAITING`을 사용하면 일관성을 갖춘다.

프로젝트 전체에서 메인 스레드 → SW postMessage에 raw string을 사용하는 마지막 잔존 케이스다.

## 기술적 고려사항

- archive `2026-04-24_fix-sw-messages-register-todo-constants.md`와 동일하게 `swMessages.ts`를 SW scope에서 import하는 것은 번들 제약 때문에 피하므로, SW(`service-worker.ts`) 수신 측(`if (event.data.type === 'SKIP_WAITING')`)은 raw string 그대로 유지한다.
- 변경 대상은 **메인 스레드 발신 측**(`src/routes/settings/+page.svelte:144`)만이다. `service-worker.ts` 주석 보강은 이번 범위에 포함하지 않는다.
- 연관 active plan 검토: `docs/plan/2026-04-24_triage-supabase-signin-failed-to-fetch.md`는 `src/service-worker.ts`를 읽지만 `/auth/callback` stale triage 범위만 다루므로, 이번 `settings/+page.svelte` 발신 상수화와 직접 충돌하지 않는다.
- Main 드리프트 점검 (strict, fix: plan): 기준커밋=`888fc2b`, 검사범위=`src/routes/settings/+page.svelte`, `src/lib/constants/swMessages.ts`, `src/service-worker.ts`. `git diff --name-only 888fc2b..main -- {3개 파일}` 결과 `0-hit`.
- 로컬 드리프트 점검: 현재 워킹트리의 staged/unstaged 변경 0건이며, 입력 계획서와 겹치는 추가 로컬 수정은 없다.
- 헤더/푸터 진행률은 실제 체크박스 기준(`15/21`)으로 동기화한다.

---

## TODO

### Phase 1: SKIP_WAITING 발신 측 교체

1. - [x] **`src/lib/constants/swMessages.ts`의 `SKIP_WAITING` 상수 계약 확인**
   - [x] `SW_MSG.SKIP_WAITING` 항목이 이미 존재하고 값이 `'SKIP_WAITING'`인지 확인
   - [x] `src/service-worker.ts:499` 수신 문자열과 값이 일치하므로 SW 수신 측 수정 범위에서 제외한다고 유지

2. - [x] **`src/routes/settings/+page.svelte` 상단 import 블록에 `SW_MSG` 추가**
   - [x] 기존 `$lib/...` import 묶음에 `import { SW_MSG } from '$lib/constants/swMessages';` 추가
   - [x] import 추가 후 기존 식별자와 충돌이 없는지 확인

3. - [x] **`src/routes/settings/+page.svelte`의 `handleUpdateCheck()` 발신 타입 교체**
   - [x] `registration.waiting.postMessage({ type: 'SKIP_WAITING' })`를 `registration.waiting.postMessage({ type: SW_MSG.SKIP_WAITING })`로 교체
   - [x] `registration.waiting`, `registration.update()`, `window.location.reload()` 흐름은 그대로 유지

### Phase T1: TC 작성

> T1 해당 없음: memo-alarm은 TypeScript 프런트엔드 변경이며 `tests/` 디렉토리 부재, `e2e/` 디렉토리 부재, `package.json`에 `test`/`vitest`/`jest`/`playwright`/`cypress` 스크립트가 없다. 단순 상수 참조 교체이므로 테스트 프레임워크 도입은 범위 밖이다.

### Phase T2: TC 실행 및 수정

> T2 해당 없음: T1 미작성이므로 실행 대상 없음.

### Phase R: 재발 경로 분석 (fix: plan 필수)

4. - [x] **`SKIP_WAITING` 호출/참조 경로를 전수 확인**
   - [x] `rg -n "SKIP_WAITING" src/` 실행 후 `swMessages.ts`, `settings/+page.svelte`, `service-worker.ts` 3경로만 존재하는지 확인
   - [x] 메인 스레드 발신 raw string은 `settings/+page.svelte` 1건뿐이었다고 기록

5. - [x] **메인 스레드 → SW `postMessage` 발신부 raw string 잔존 여부 확인**
   - [x] `rg -n "postMessage\\(" src/ --glob '*.ts' --glob '*.svelte'` 결과에서 메인 스레드 발신부를 검토해 `type: '...'` raw string 잔존 0건 확인
   - [x] 전체 방어 완료 명시

### Phase T3: 재현/통합 TC

> T3 해당 없음: 설정값/상수 추출 변경이며 runtime 동작 불변. expand-todo 규칙의 "순수 설정값 변경만" 스킵 허용 조건.

### Phase T4: E2E 테스트

> T4 해당 없음: `tests/` 디렉토리 부재, `e2e/` 디렉토리 부재. Glob `tests/**/*e2e*`, `tests/**/*integration*`, `e2e/**/*` 대상 경로가 없다.

### Phase T5: HTTP 통합 테스트

> T5 해당 없음: `tests/` 디렉토리 부재로 `tests/**/*http*`, `tests/**/*api*` 대상 경로가 없고, 이번 변경은 `src/routes/settings/+page.svelte`의 SW 메시지 상수 참조 교체 1건뿐이라 HTTP 테스트 작성 범위가 아니다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

6. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] T4/T5 해당 없음 재판정
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거

## 작업 수 요약

- Phase 1: SKIP_WAITING 발신 측 교체 (3 parents / 6 children)
- Phase T1~T5: 블록쿼트만 (체크박스 0)
- Phase R: 재발 경로 전수 확인 (2 parents / 4 children)
- Phase Z: Post-Merge Cleanup (1 parent / 5 children)
- 총 6 parents / 15 children = 21 체크박스

*상태: 머지대기 | 진행률: 15/21 (71%)*
