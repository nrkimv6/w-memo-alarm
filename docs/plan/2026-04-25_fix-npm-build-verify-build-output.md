# npm run build exit-0 silent failure 방어 — post-build 산출물 검증 추가

> 작성일시: 2026-04-25 14:00
> 기준커밋: b29b63d
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/31 (0%)
> 출처: /reflect에서 자동 생성
> 요약: `npm run build`가 adapter EPERM으로 실패해도 vite/rollup이 exit code 0을 반환하는 silent failure 문제가 발견됐다. `.svelte-kit/cloudflare/_worker.js`가 생성되지 않은 상태(배포 불가)인데도 CI/에이전트가 성공으로 오판한다. post-build 산출물 존재 검증 스크립트를 추가해 실제 빌드 실패를 exit 1로 명시화한다.

---

## 개요

`@sveltejs/adapter-cloudflare`의 adapt() 단계에서 `.svelte-kit/cloudflare`를 `rimraf` 삭제 시 EPERM/EBUSY가 발생한다.
이 오류는 adapter 내부에서 throw되지만 vite/rollup의 `closeBundle` hook 오류 처리 방식으로 인해 `npm run build`가 **exit code 0으로 종료**된다.

결과적으로:
- `.svelte-kit/cloudflare/` 비어있음 (산출물 없음)
- Wrangler 배포 시 `_worker.js` 미존재로 배포 실패
- CI/에이전트는 exit 0을 성공으로 판단 → **silent failure로 배포 파이프라인 통과**

재현 조건: VS Code File Watcher가 `.svelte-kit/cloudflare`를 점유한 상태에서 재빌드.

## 기술적 고려사항

- vite/rollup의 `closeBundle` 훅 오류는 `process.exitCode`를 변경하지 않는 것으로 확인됨
- `npm run build`의 exit code 0 = "vite 컴파일 성공"이며 adapter 성공을 보장하지 않음
- Cloudflare adapter의 wrangler.toml 기준 산출물 경로: `main = ".svelte-kit/cloudflare/_worker.js"`, `directory = ".svelte-kit/cloudflare"`
- post-build 검증: `.svelte-kit/cloudflare/_worker.js` 존재 + 비어있지 않음을 확인 후 없으면 exit 1
- 프로덕션 환경에서 동일 에러 재현 여부를 먼저 확인하고, 검증 스크립트가 Linux CI에서도 정상 작동하는지 검증한다.
- archive 참조: `docs/archive/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md` — 전신 fix에서 Windows-only EBUSY를 pre-clean으로 완화했지만 silent failure 문제는 미처리됨

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 생성**
   - [ ] `impl/fix-npm-build-verify-build-output` 브랜치로 worktree 생성
   - [ ] plan 헤더 `> branch:` / `> worktree:` / `> worktree-owner:` 기록
   - [ ] worktree cwd 고정

### Phase 1: 수동 검증 (VS Code 재시작)

1. - [ ] **VS Code 재시작 후 watcherExclude 적용 여부 직접 확인**
   - [ ] VS Code 완전 종료 후 재시작
   - [ ] `npm run build` 1회 실행 → exit code 0 + `.svelte-kit/cloudflare/_worker.js` 존재 확인
   - [ ] 재빌드(`npm run build` 2회차) → exit code 0 + 산출물 재생성 확인
   - [ ] 결과를 plan 본문에 기록 (watcherExclude 효과 있음/없음)

### Phase 2: post-build 검증 스크립트 추가

2. - [ ] **`scripts/verify-build-output.mjs` 신규 작성** — 산출물 존재 검증 + 실패 시 exit 1
   - [ ] `resolve(__dirname, '..', '.svelte-kit', 'cloudflare', '_worker.js')` 경로 정의
   - [ ] `fs/promises.access`로 파일 존재 확인 — 없으면 `console.error + process.exit(1)`
   - [ ] `fs/promises.stat`으로 파일 크기 > 0 확인 — 빈 파일도 실패로 처리
   - [ ] Linux/POSIX 환경에서도 동작하는 순수 Node.js 구현 (OS 분기 없음)

3. - [ ] **`package.json` build 스크립트에 verify 단계 추가**
   - [ ] `package.json:7`: `"build"` 스크립트를 `"node scripts/clean-svelte-kit-cloudflare.mjs && vite build && node scripts/verify-build-output.mjs"`로 변경
   - [ ] `npm run build` 실행 후 exit code 0 + 산출물 존재 확인
   - [ ] adapter EPERM silent failure 케이스에서 exit 1 반환 확인

### Phase R: 재발 경로 분석 (fix: plan 필수)

4. - [ ] **빌드 성공 판단 경로 전수 열거**
   - [ ] Grep으로 `npm run build`, `exit 0`, `build.*success` 패턴을 에이전트/스킬 파일에서 검색
   - [ ] `.agents/skills/`, `.claude/agents/`, `.agent/workflows/`에서 exit code만 체크하는 경로 목록화
   - [ ] 각 경로에서 verify 스크립트 추가 여부 또는 산출물 경로 직접 확인 여부 판정

5. - [ ] **미방어 경로 보정**
   - [ ] 에이전트 파일에서 `npm run build` 성공 판정 기준에 "산출물 존재 확인" 주석/체크박스 추가 필요 경로 파악
   - [ ] 직접 수정 가능한 것은 수정, wtools 스킬 파일은 wtools 레포에서 수정
   - [ ] 모든 경로에 대해 `방어 완료` 또는 `해당 환경 미발생` 명시

### Phase T: 테스트

> T1~T5 해당 없음: SvelteKit 프론트엔드 + 빌드 환경 수정. `tests/` 디렉토리 0건. 검증은 Phase 1(수동)과 Phase 2.3(verify 스크립트 실행)으로 커버한다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

6. - [ ] **post-merge 정리** — `/merge-test` owner
   - [ ] main merge
   - [ ] main에서 `npm run build` 2회 연속 실행 + exit 0 + 산출물 존재 확인
   - [ ] worktree remove, branch remove
   - [ ] plan 헤더 메타 제거

---

*상태: 초안 | 진행률: 0/31 (0%)*
