# npm run build EPERM — Cloudflare adapter .svelte-kit 권한 오류 수정

> 작성일시: 2026-04-25 12:00
> 기준커밋: 0fa7020
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/47 (0%)
> 출처: /reflect에서 자동 생성
> 요약: `npm run build` 실행 시 `@sveltejs/adapter-cloudflare`의 `rimraf` 호출이 `.svelte-kit\cloudflare` 디렉토리를 삭제하다가 `EPERM: Permission denied` 오류로 실패한다. 컴파일은 `✓ built`로 성공하지만 adapter post-processing이 실패해 exit code 1로 종료된다. Windows 개발 환경에서 모든 빌드가 실패 상태로 보고되어 개발 마찰이 크다.

---

## 개요

`npm run build → vite build → @sveltejs/adapter-cloudflare`가 빌드 출력 단계에서 이전 `.svelte-kit\cloudflare` 디렉토리를 `rimraf`로 삭제하려다 `EPERM`으로 실패한다.

오류 스택:
```
error during build:
Error: EPERM, Permission denied: \\?\D:\work\...\memo-alarm\.svelte-kit\cloudflare
    at Object.rmSync (node:fs:1236:18)
    at Object.rimraf (filesystem.js:21:5)
    at adapt (@sveltejs/adapter-cloudflare/index.js:80:12)
```

관찰:
- 모든 `.svelte-kit` 삭제 후 재빌드 시에도 동일 오류 재발 (단, 첫 빌드는 성공)
- 컴파일 단계 `✓ 4525 modules transformed`, `✓ built in 36.85s` 는 성공
- 오류는 adapter adapt() 단계에서만 발생

## 기술적 고려사항

- Windows에서 프로세스가 `DirectoryHandle`을 유지하면 `rmSync`가 `EPERM`을 반환할 수 있음 (VS Code, Windows Defender, 빌드 후 남은 file handle)
- `node_modules/@sveltejs/adapter-cloudflare/index.js`는 `dest`를 `builder.getBuildDirectory('cloudflare')`, `wrangler.toml main`, `[assets].directory`, `pages_build_output_dir`에서 계산한 뒤 `builder.rimraf(dest)`와 `builder.rimraf(worker_dest)`를 항상 호출한다. 즉 출력 경로를 바꿔도 삭제 단계 자체는 남는다.
- `node_modules/@sveltejs/adapter-cloudflare/index.d.ts` 기준 현재 옵션 surface는 `config`, `fallback`, `routes`, `platformProxy`뿐이며 `dest` 옵션은 없다. 출력 경로 변경은 `adapter({ dest })`가 아니라 `wrangler.toml`의 `main`/`[assets].directory` 또는 Pages 설정으로만 가능하다.
- 해결 방안:
  - A: `wrangler.toml`의 `main` + `[assets].directory`를 다른 경로로 옮겨 lock이 경로 고정인지 실험
  - B: `build:clean` 스크립트를 추가해 `npm run build` 전 `.svelte-kit\cloudflare` 를 Windows-safe 방식으로 삭제
  - C: `adapter-cloudflare` 버전 업그레이드 (최신 버전에서 `rm` 방식 변경 여부 확인)
- archive 참조: `docs/archive/2026-04-25_fix-safe-browsing-deceptive-site.md:115`(EPERM = "Cloudflare adapter Windows 환경 이슈 (기존 문제, 비회귀)"), `docs/archive/2026-04-25_fix-ssr-store-cycle-settings-500.md:49`(`.svelte-kit/cloudflare` 정리 단계 EPERM 간헐 발생). 본 plan은 archive에 기록된 "Windows-only 간헐 이슈" 단서를 전제로 진행한다.
- 프로덕션 환경에서 동일 에러 재현 여부를 먼저 확인하고, placeholder/fallback이 런타임 동작을 바꾸지 않는지 검증한다. — 옵션 A(`dest` 변경)는 production 빌드 산출물 경로/배포 동작에 영향을 줄 수 있으므로, Cloudflare Pages CI(Linux) 빌드에서 EPERM이 미발생이면 옵션 B/C를 우선한다.
- 현재 repo에는 `.github/` workflow와 `scripts/` 디렉터리가 없다. 따라서 빌드 방어를 추가하면 `scripts/` 생성 여부까지 plan에 포함해야 하고, CI 근거는 repo 밖 deploy 로그 또는 수동 확인으로 보강해야 한다.

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 생성 또는 기존 worktree 재개**
   - [ ] `impl/fix-npm-build-eperm-cloudflare-adapter` 브랜치로 worktree 생성 또는 재개
   - [ ] plan 헤더의 `> branch:` / `> worktree:` / `> worktree-owner:` 기록 (단일 경로 또는 쉼표 구분 경로 목록 모두 유효)
   - [ ] worktree cwd 고정 후 후속 단계 진행

### Phase 1: 원인 파악

1. - [ ] **adapter-cloudflare의 실제 삭제 대상과 옵션 surface를 코드로 고정한다** — 옵션 판단 입력
   - [ ] `package.json:7,13`: `build`가 `vite build`, adapter version이 `^7.2.4`임을 확인한다.
   - [ ] `node_modules/@sveltejs/adapter-cloudflare/index.d.ts`: `dest` 옵션이 없고 `config/fallback/routes/platformProxy`만 제공됨을 기록한다.
   - [ ] `node_modules/@sveltejs/adapter-cloudflare/index.js`: `builder.rimraf(dest)`와 `builder.rimraf(worker_dest)` 호출, 그리고 `dest`가 `wrangler.toml main`/`[assets].directory` 또는 default `.svelte-kit/cloudflare`에서 계산됨을 정리한다.

2. - [ ] **업스트림 수정 가능성을 확인한다** — 옵션 C 타당성 검증
   - [ ] `npm view @sveltejs/adapter-cloudflare versions` 또는 official changelog에서 `7.2.4` 이후 Windows `EPERM`/`rimraf` 수정 여부를 찾는다.
   - [ ] 수정이 있으면 적용 대상 최소 버전과 peer dependency 영향(`@sveltejs/kit`, `wrangler`)을 본문에 적는다.
   - [ ] 수정이 없으면 옵션 C를 보류하고 옵션 B를 1순위 후보로 낮춘다.

3. - [ ] **재현 조건과 환경 차이를 분리한다** — local-only 여부 확정
   - [ ] `.svelte-kit/cloudflare`가 없는 첫 빌드와 존재하는 재빌드에서 결과 차이를 기록한다.
   - [ ] 로컬 점유 후보(VS Code, Windows Defender, `wrangler dev`)를 식별하고 재현 시점과 함께 메모한다.
   - [ ] Cloudflare Pages/Linux 빌드 로그 또는 fresh checkout 결과를 확인해 production에서도 재현되는지 분리한다.
   - [ ] `docs/archive/2026-04-25_fix-safe-browsing-deceptive-site.md:115`, `docs/archive/2026-04-25_fix-ssr-store-cycle-settings-500.md:49`와 일관성을 대조해 Windows-only 가설 유지/반증을 기록한다.

4. - [ ] **선택 방안을 문서에 고정한다** — Phase 2 입력
   - [ ] `docs/plan/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md`: 옵션 A를 `adapter({ dest })`가 아니라 `wrangler.toml`의 `main`/`[assets].directory` 변경 실험으로 정정한다.
   - [ ] `docs/plan/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md`: 옵션 A는 `rimraf` 경로만 옮기는 완화책임을 적고, Windows local-only이면 옵션 B/C를 우선한다고 적는다.
   - [ ] `docs/plan/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md`: 선택 근거(Windows-only 여부, CI 영향, 업스트림 fix 유무)를 요약 표로 추가한다.

### Phase 2: 수정 구현

5. - [ ] **옵션 B 경로를 구현한다** — local pre-clean 기본안
   - [ ] `scripts/clean-svelte-kit-cloudflare.mjs`: `.svelte-kit/cloudflare` 존재 여부를 확인하고, 없으면 즉시 종료하는 스크립트를 신규 작성한다.
   - [ ] `scripts/clean-svelte-kit-cloudflare.mjs`: `rm` 실패 시 `EPERM`/`EBUSY`만 retry/backoff 하도록 구현하고, 다른 오류는 그대로 throw한다.
   - [ ] `package.json`: `build` 스크립트를 clean script + `vite build` 조합으로 갱신한다.

6. - [ ] **옵션 C 또는 A가 필요할 때만 최소 범위로 적용한다**
   - [ ] `package.json` / `package-lock.json`: 업스트림 fix 확인 시에만 adapter version을 업데이트한다.
   - [ ] `wrangler.toml`: 경로 이동 실험이 필요할 때만 `main`과 `[assets].directory`를 함께 조정한다.
   - [ ] `docs/plan/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md`: 왜 옵션 B만으로 충분했는지 또는 추가 옵션이 왜 필요했는지 기록한다.

7. - [ ] **빌드 결과를 동일 조건에서 연속 검증한다**
   - [ ] `npm run build` 1회 실행 후 exit code 0과 산출물 생성 여부를 확인한다.
   - [ ] `.svelte-kit/cloudflare`가 남아 있는 상태에서 `npm run build` 2회차를 실행해 재빌드도 통과하는지 확인한다.
   - [ ] `wrangler.toml` 기준 산출물 경로(`main`, `[assets].directory`)에 `_worker.js`와 정적 자산이 생성되는지 확인한다.

### Phase R: 재발 경로 분석 (fix: plan 필수)

8. - [ ] **빌드 트리거 경로를 전수 열거한다**
   - [ ] `rg -n "npm run build|vite build|wrangler|pages deploy" package.json wrangler.toml docs .github scripts` 결과를 수집한다.
   - [ ] `.github/`, `scripts/`가 현재 repo에 없으면 `0-hit`로 기록하고 로컬 수동 실행 경로와 문서 경로를 분리한다.
   - [ ] 각 경로를 `경로 | 실행 환경 | EPERM 위험 | 근거` 표로 정리한다.

9. - [ ] **미방어 경로를 보정하거나 방어 근거를 남긴다**
   - [ ] 로컬 Windows 경로가 `package.json` 외에도 있으면 동일 clean/upgrade 정책을 반영한다.
   - [ ] Linux/Cloudflare Pages 경로가 비영향이면 그 근거를 archive와 함께 본문에 남긴다.
   - [ ] 모든 경로에 대해 `방어 완료` 또는 `해당 환경 미발생`을 명시한다.

### Phase T: 테스트

> T1~T5 해당 없음: 본 plan은 SvelteKit 프론트엔드 + 빌드 환경 수정으로 Python 백엔드 코드 변경 없음. 프로젝트 루트에 `tests/` 디렉토리 0건 (`node_modules` 외부에서 `*.test.ts/js` 0건). 회귀 검증은 Phase 2.7의 `npm run build` exit code 0 + 연속 2회 빌드 통과 + Phase R의 경로 전수 점검으로 커버한다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

9. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도 (`/merge-test`)
   - [ ] main 워킹트리에서 `npm run build` exit code 0 최종 확인
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] plan 헤더의 `> branch:` / `> worktree:` / `> worktree-owner:` 메타 제거

---

*상태: 검토완료 | 진행률: 0/47 (0%)*
