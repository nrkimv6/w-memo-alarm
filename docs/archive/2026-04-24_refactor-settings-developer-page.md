# refactor: settings/developer/+page.svelte 분할 리팩토링

> 작성일시: 2026-04-24
> 기준커밋: 485eae8
> 대상 프로젝트: memo-alarm
> 상태: 완료
> branch: impl/refactor-settings-developer-page
> worktree: D:\work\project\service\wtools\memo-alarm\.worktrees\impl-refactor-settings-developer-page
> worktree-owner: codex
> 진행률: 13/13 (100%)
> 요약: Settings 재디자인으로 settings hub + notifications/developer 서브페이지로 분리됐지만, developer 페이지 자체가 827줄로 500줄 가이드라인을 크게 초과한다. 독립 섹션(DevInfo, DevControls, PWASection 등)을 개별 컴포넌트로 분리해 파일 크기를 500줄 이하로 줄인다.
> 출처: /reflect에서 자동 생성

---

## 개요

`src/routes/settings/developer/+page.svelte`가 827줄로 관리 임계값(500줄)을 크게 초과한다.

2026-04-24 Settings 재디자인(Hub 구조 분리) 이후 developer 서브페이지는 독립 파일이 됐지만 내부 구조 분리는 이뤄지지 않았다. 주요 섹션을 컴포넌트로 추출하면 파일 크기를 줄이고 유지보수성을 높일 수 있다.

## 분할 후보 섹션

현재 파일을 읽고 실제 섹션 경계를 확인한 뒤 추출 단위를 확정한다. 예상 컴포넌트:

- `DevInfoSection.svelte` — 버전, 빌드 정보 표시
- `DevControlsSection.svelte` — 개발용 토글, 실험적 기능
- `DevPwaSection.svelte` — PWA/SW 관련 디버그 컨트롤
- `DevNotificationTestSection.svelte` — 알림 테스트 패널

## 기술적 고려사항

- Svelte 5 runes(`$state`, `$derived`, `$effect`) 유지
- `settings-*` CSS 네임스페이스 네이밍 유지
- 기존 `dev_mode_unlocked` localStorage 로직은 page 레벨에 유지

---

## TODO

### Phase 0: 섹션 분석

1. - [x] **`src/routes/settings/developer/+page.svelte` 전체 읽기** — 섹션 경계 및 공유 state 파악
   - [x] 각 섹션의 의존 state/함수 목록 작성 (추출 가능 여부 판단)
   - [x] 추출 컴포넌트 이름과 대상 경로(`src/lib/components/settings/`) 확정

### Phase 1: 컴포넌트 추출

2. - [x] **섹션별 컴포넌트 파일 생성** (`src/lib/components/settings/dev/` 하위)
   - [x] 각 컴포넌트에 필요한 props / event 정의
   - [x] `+page.svelte`에서 추출 섹션을 컴포넌트 임포트로 교체
   - [x] 공유 state가 있으면 page 레벨에서 binding 또는 context로 전달

### Phase 2: 검증

3. - [x] **`npm run check` 통과 확인**
4. - [x] **`+page.svelte` 줄 수 500줄 이하 확인**

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [x] **post-merge 정리** — `/merge-test` owner
   - [x] main merge
   - [x] build 확인 (`npm run build`)
   - [x] worktree/branch 정리

## 작업 수 요약

- Phase 0: 분석 (3개 체크박스)
- Phase 1: 추출 (4개 체크박스)
- Phase 2: 검증 (2개 체크박스)
- Phase Z: 정리 (4개 체크박스)
- 총 13개 체크박스

*상태: 완료 | 진행률: 13/13 (100%)*
