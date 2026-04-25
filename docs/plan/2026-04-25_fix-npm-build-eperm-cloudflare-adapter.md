# npm run build EPERM — Cloudflare adapter .svelte-kit 권한 오류 수정

> 작성일시: 2026-04-25 12:00
> 기준커밋: 0fa7020
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/13 (0%)
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

---

## TODO

### Phase 1: 원인 파악

1. [ ] **EPERM 발생 원인과 재현 조건을 코드/환경 기준으로 확인** — 수정 방향 결정
   - [ ] `package.json`: `@sveltejs/adapter-cloudflare` 현재 버전 확인 및 최신 버전 changelog 검토
   - [ ] `vite.config.ts` 또는 `svelte.config.js`: adapter 옵션에 `dest` 설정 가능 여부 확인
   - [ ] 첫 빌드(`.svelte-kit` 없음)와 재빌드(`.svelte-kit\cloudflare` 있음) 결과를 비교해 재현 조건 확정
   - [ ] `docs/plan/2026-04-25_fix-npm-build-eperm-cloudflare-adapter.md`: 원인 분석 결과와 선택 방안을 기록한다

### Phase 2: 수정 구현

2. [ ] **선택 방안 적용 — build 성공 및 exit code 0 달성** — 개발 마찰 제거
   - [ ] `svelte.config.js` 또는 `vite.config.ts`: adapter-cloudflare 설정 또는 pre-build clean 스크립트 추가
   - [ ] `package.json`: `"build"` 스크립트에 pre-clean 단계 추가 (필요 시)
   - [ ] `npm run build` exit code 0 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] npm run build exit code 0 최종 확인
   - [ ] worktree remove, branch remove, header meta 제거

---

*상태: 초안 | 진행률: 0/13 (0%)*
