# npm run build EPERM — Cloudflare adapter .svelte-kit 권한 오류 수정

> 작성일시: 2026-04-25 12:00
> 기준커밋: 0fa7020
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/40 (0%)
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
- `@sveltejs/adapter-cloudflare`의 `rimraf` 호출은 adapter-cloudflare의 내부 구현 — 직접 수정 없이 설정으로 우회 가능할 수 있음
- 해결 방안:
  - A: `vite.config.ts`의 `adapter-cloudflare` 옵션에서 output directory 변경 (`dest` 옵션)
  - B: `build:clean` 스크립트를 추가해 `npm run build` 전 `.svelte-kit\cloudflare` 를 Windows-safe 방식으로 삭제
  - C: `adapter-cloudflare` 버전 업그레이드 (최신 버전에서 `rm` 방식 변경 여부 확인)
- archive 참조: `docs/archive/2026-04-25_fix-safe-browsing-deceptive-site.md:115`(EPERM = "Cloudflare adapter Windows 환경 이슈 (기존 문제, 비회귀)"), `docs/archive/2026-04-25_fix-ssr-store-cycle-settings-500.md:49`(`.svelte-kit/cloudflare` 정리 단계 EPERM 간헐 발생). 본 plan은 archive에 기록된 "Windows-only 간헐 이슈" 단서를 전제로 진행한다.
- 프로덕션 환경에서 동일 에러 재현 여부를 먼저 확인하고, placeholder/fallback이 런타임 동작을 바꾸지 않는지 검증한다. — 옵션 A(`dest` 변경)는 production 빌드 산출물 경로/배포 동작에 영향을 줄 수 있으므로, Cloudflare Pages CI(Linux) 빌드에서 EPERM이 미발생이면 옵션 B/C를 우선한다.

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 생성 또는 기존 worktree 재개**
   - [ ] `impl/fix-npm-build-eperm-cloudflare-adapter` 브랜치로 worktree 생성 또는 재개
   - [ ] plan 헤더의 `> branch:` / `> worktree:` / `> worktree-owner:` 기록 (단일 경로 또는 쉼표 구분 경로 목록 모두 유효)
   - [ ] worktree cwd 고정 후 후속 단계 진행

### Phase 1: 원인 파악

1. - [ ] **adapter-cloudflare 현재 버전과 changelog 확인** — 옵션 C(업그레이드) 가능성 판단
   - [ ] `package.json:13`: `@sveltejs/adapter-cloudflare ^7.2.4` 버전 확인
   - [ ] `npm view @sveltejs/adapter-cloudflare versions` 또는 GitHub release에서 `7.2.4` 이후 minor/patch에 `rimraf`/`rmSync`/Windows 관련 수정이 있는지 검토
   - [ ] 변경 있으면 옵션 C를 1순위 후보로 본문에 기록

2. - [ ] **adapter 설정 옵션 검토** — 옵션 A(`dest` 변경) 실현 가능성 판단
   - [ ] `svelte.config.js:8`: `adapter()`가 옵션 없이 호출됨 확인
   - [ ] `node_modules/@sveltejs/adapter-cloudflare` 타입 정의에서 사용 가능한 옵션(`dest`, `routes` 등)과 기본 출력 경로 확인
   - [ ] `wrangler.toml`의 `pages_build_output_dir` / 배포 산출물 경로와 `dest` 변경 시 정합성 확인

3. - [ ] **재현 조건 확정** — 환경 의존성과 production 영향 분리
   - [ ] `.svelte-kit/cloudflare`가 없는 상태(첫 빌드)와 있는 상태(재빌드)에서 결과 비교 — 재현이 재빌드에서만 발생함을 검증
   - [ ] CI 환경(Linux, Cloudflare Pages 빌드) 또는 fresh checkout에서 동일 에러 재현 여부 확인 (가능하면 이전 deploy 로그 검토)
   - [ ] `docs/archive/2026-04-25_fix-safe-browsing-deceptive-site.md:115`, `docs/archive/2026-04-25_fix-ssr-store-cycle-settings-500.md:49`의 archive 기록과 일관성 확인 (Windows-only 간헐 이슈 가설 유지/반증)
   - [ ] 동시 점유 가능 프로세스(VS Code, Windows Defender, `wrangler dev`) 식별

4. - [ ] **선택 방안 결정 및 plan 본문에 기록** — Phase 2 입력
   - [ ] `docs/plan/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md`: 원인 분석 결과(Windows-only 여부, production CI 영향, 재현 조건)와 선택한 옵션(A/B/C 또는 조합)을 본문에 추가

### Phase 2: 수정 구현

5. - [ ] **선택 방안 적용** — Phase 1.4의 결정을 반영
   - [ ] (옵션 C 선택 시) `package.json`: `@sveltejs/adapter-cloudflare`를 EPERM 수정이 포함된 최신 버전으로 업데이트, `npm install` 후 `package-lock.json` 갱신
   - [ ] (옵션 B 선택 시) `package.json`의 `scripts.build`를 `node scripts/clean-svelte-kit.mjs && vite build` 형태로 변경하고 정리 스크립트 신규 작성 — `.svelte-kit/cloudflare` 존재 시에만 제거, file handle 잔존 대비 retry/대기 포함
   - [ ] (옵션 A 선택 시) `svelte.config.js:8`: `adapter({ dest: '...' })`로 변경하고 `wrangler.toml`의 산출물 경로를 동기 업데이트

6. - [ ] **빌드 결과 검증**
   - [ ] `npm run build` 실행 후 exit code 0 확인
   - [ ] 같은 환경에서 연속 2회 빌드해 재빌드도 EPERM 없이 통과함을 확인 (`.svelte-kit/cloudflare` 존재 상태)
   - [ ] 빌드 산출물(`build/` 또는 새 `dest`)에 SvelteKit + Cloudflare adapter 출력이 정상 생성되었는지 파일 존재 확인

### Phase R: 재발 경로 분석 (fix: plan 필수)

7. - [ ] **빌드 트리거 경로 전수 열거**
   - [ ] Grep으로 `npm run build`, `npm run preview`, `wrangler`, `vite build`, `pages deploy` 호출을 프로젝트 전체에서 검색 (스크립트, `.github/workflows`, `wrangler.toml`, docs 포함)
   - [ ] 각 경로별로 실행 환경(Windows local / Linux CI / Cloudflare Pages remote)과 EPERM 위험 여부를 표로 작성 — `경로 | 환경 | EPERM 위험 | 근거`
   - [ ] `docs/archive/2026-04-25_fix-safe-browsing-deceptive-site.md:115`, `docs/archive/2026-04-25_fix-ssr-store-cycle-settings-500.md:49`와 교차 비교해 Windows-only 단정 근거를 본문에 기록

8. - [ ] **미방어 경로 수정 또는 방어 명시**
   - [ ] 미방어 경로가 있으면 동일 정리 스크립트/옵션을 적용해 모든 경로에서 빌드가 통과하도록 한다
   - [ ] 모든 경로에 대해 "방어 완료" 또는 "해당 환경에서 미발생" 근거를 본문 표에 명시 ("근본 수정" 표현 금지, "전체 방어 완료" 명시)
   - [ ] CI(Linux)에서 미발생인 경우, 그 사실을 후속 archive 기록 근거로 본문에 적어둔다

### Phase T: 테스트

> T1~T5 해당 없음: 본 plan은 SvelteKit 프론트엔드 + 빌드 환경 수정으로 Python 백엔드 코드 변경 없음. 프로젝트 루트에 `tests/` 디렉토리 0건 (`node_modules` 외부에서 `*.test.ts/js` 0건). 회귀 검증은 Phase 2.6의 `npm run build` exit code 0 + 연속 2회 빌드 통과 + Phase R의 경로 전수 점검으로 커버한다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

9. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도 (`/merge-test`)
   - [ ] main 워킹트리에서 `npm run build` exit code 0 최종 확인
   - [ ] worktree remove, branch remove
   - [ ] plan 헤더의 `> branch:` / `> worktree:` / `> worktree-owner:` 메타 제거

---

*상태: 검토완료 | 진행률: 0/40 (0%)*
