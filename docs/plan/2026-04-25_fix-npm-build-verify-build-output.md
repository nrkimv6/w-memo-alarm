# npm run build exit-0 silent failure 방어 — post-build 산출물 검증 추가

> 작성일시: 2026-04-25 14:00
> 기준커밋: b29b63d
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/43 (0%)
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
- 프로덕션 환경에서 동일 에러 재현 여부를 먼저 확인하고, placeholder/fallback이 런타임 동작을 바꾸지 않는지 검증한다.
- 검증 스크립트는 Windows 로컬 watcher 재현뿐 아니라 Linux CI에서도 동일하게 `_worker.js` 누락을 실패로 승격해야 한다.
- repo 내부 스킬/워크플로우 중 일부가 SvelteKit 산출물을 여전히 `build/`로 가정하므로, memo-alarm 전용 성공 기준을 `.svelte-kit/cloudflare/_worker.js`로 맞추는 문서 보정이 함께 필요하다.
- archive 참조: `docs/archive/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md` — 전신 fix에서 Windows-only EBUSY를 pre-clean으로 완화했지만 silent failure 문제는 미처리됨

---

## TODO

### Phase 0: Worktree 준비

> 작업 수: 4개

1. - [ ] **worktree 생성 또는 재개**
   - [ ] `impl/fix-npm-build-verify-build-output` 브랜치로 worktree 생성 또는 기존 동일 owner worktree 재개
   - [ ] plan 헤더 `> branch:` / `> worktree:` / `> worktree-owner:` 기록
   - [ ] worktree cwd 고정

### Phase 1: 수동 검증 (VS Code 재시작)

> 작업 수: 8개

2. - [ ] **VS Code watcher 상태 baseline 확인**
   - [ ] VS Code 완전 종료 후 재시작
   - [ ] `.vscode/settings.json`에서 `files.watcherExclude["**/.svelte-kit/**"] = true` 유지 여부 확인
   - [ ] watcherExclude 적용 결과를 plan 실행 메모에 기록 (효과 있음/없음)

3. - [ ] **재빌드 수동 검증**
   - [ ] 프로젝트 루트에서 `npm run build` 1회 실행 → exit code 0 + `.svelte-kit/cloudflare/_worker.js` 존재 확인
   - [ ] 같은 세션에서 `npm run build` 2회차 실행 → exit code 0 + 산출물 재생성 확인
   - [ ] silent failure 재현 여부(`exit 0`인데 `_worker.js` 없음)를 plan 본문에 기록

### Phase 2: post-build 검증 스크립트 추가

> 작업 수: 14개

4. - [ ] **`scripts/verify-build-output.mjs`의 대상 경로와 실패 helper를 작성**
   - [ ] `scripts/verify-build-output.mjs`: `fileURLToPath(import.meta.url)` + `resolve(__dirname, '..', '.svelte-kit', 'cloudflare', '_worker.js')`로 target path 계산
   - [ ] `scripts/verify-build-output.mjs`: 실패 메시지를 stderr로 남기고 `process.exit(1)` 하는 helper 추가

5. - [ ] **산출물 누락/빈 파일 실패 분기를 구현**
   - [ ] `scripts/verify-build-output.mjs`: `access(target, constants.F_OK)` 실패 시 "`_worker.js` missing" 오류와 exit 1 반환
   - [ ] `scripts/verify-build-output.mjs`: `stat(target).size === 0`이면 empty artifact 오류와 exit 1 반환
   - [ ] `scripts/verify-build-output.mjs`: 성공 시 검증한 path와 size를 로그로 남기고 exit 0 유지

6. - [ ] **`package.json` build 체인에 verify 단계를 연결**
   - [ ] `package.json`: `build`를 `"node scripts/clean-svelte-kit-cloudflare.mjs && vite build && node scripts/verify-build-output.mjs"`로 수정
   - [ ] `package.json`: `check` / `preview` / dependency 버전은 건드리지 않고 build 스크립트만 보정

7. - [ ] **verify 스크립트의 성공/실패 경로를 실행으로 검증**
   - [ ] `.svelte-kit/cloudflare/_worker.js`가 없는 상태에서 `node scripts/verify-build-output.mjs` 단독 실행 → exit 1 확인
   - [ ] `npm run build` 실행 후 동일 verify 스크립트가 exit 0을 반환하는지 확인
   - [ ] silent failure가 재현되면 `npm run build` 전체 종료코드가 1로 승격되는지 기록하고, 재현되지 않으면 단독 실패 검증 결과로 대체 근거를 남긴다

### Phase R: 재발 경로 분석 (fix: plan 필수)

> 작업 수: 9개

8. - [ ] **빌드 성공 판단 경로를 전수 검색한다**
   - [ ] `.agents/skills`, `.agents/agents`, `.claude/skills`, `.claude/agents`, `.agent/workflows`에서 `npm run build`, `vite build`, `build/`, `_worker.js`를 검색
   - [ ] 검색 결과를 `경로 | 실행 owner | 현재 성공판정 | 보정 필요 여부` 표로 정리

9. - [ ] **memo-alarm 산출물 경로를 오판하는 문서 경로를 고정한다**
   - [ ] `.agents/skills/webapp-testing/SKILL.md`, `.claude/skills/webapp-testing/SKILL.md`, `.agent/workflows/webapp-testing.md`를 memo-alarm의 `_worker.js` 기준으로 수정 대상으로 표시
   - [ ] `.agents/skills/deploy/SKILL.md`, `.agent/workflows/deploy.md`를 memo-alarm output `.svelte-kit/cloudflare` 기준으로 수정 대상으로 표시

10. - [ ] **post-merge build owner 경로까지 방어 범위를 확장한다**
   - [ ] `.agents/skills/merge-test/SKILL.md`, `.claude/skills/merge-test/SKILL.md`에 `npm run build` 후 verify requirement 추가 필요 여부를 판정한다
   - [ ] `.agents/agents/auto-impl-post-merge.md`, `.claude/agents/auto-impl-post-merge.md`에 build 성공 기준을 exit code + 산출물 검증으로 명시할 필요 여부를 판정한다

### Phase T: 테스트

> T1~T5 해당 없음: SvelteKit 프론트엔드 + 빌드 환경 수정이며 `rg --files -g "tests/**" -g "!**/node_modules/**"` 결과 0건이다. 자동 검증은 Phase 1 수동 재현, Phase 2 verify 스크립트 실행, `npm run build` 종료코드/산출물 확인으로 커버한다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

> 작업 수: 8개

11. - [ ] **main merge 후 산출물을 다시 검증한다** — `/merge-test` owner
   - [ ] main merge
   - [ ] main에서 `npm run build` 2회 연속 실행 후 매회 exit code 0 + `.svelte-kit/cloudflare/_worker.js` 존재 확인
   - [ ] 결과를 archive/DONE 요약에 기록

12. - [ ] **worktree 메타와 브랜치를 정리한다** — `/merge-test` owner
   - [ ] impl worktree remove
   - [ ] impl branch remove
   - [ ] plan 헤더의 `> branch:` / `> worktree:` / `> worktree-owner:` 메타 제거

---

*상태: 검토완료 | 진행률: 0/43 (0%)*
