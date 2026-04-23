# fix: 브라우저 cold load 시 설정 토글이 DEFAULT 로 굳는 상태 출력 버그

> 작성일시: 2026-04-24 17:45
> 기준커밋: 931c414
> 대상 프로젝트: memo-alarm
> 상태: 머지대기
> branch: impl/fix-settings-state-desync-on-cold-load
> worktree: .worktrees/impl-fix-settings-state-desync-on-cold-load
> worktree-owner: D:\work\project\service\wtools\memo-alarm\docs\plan\2026-04-24_fix-settings-state-desync-on-cold-load.md
> 진행률: 35/58 (60%)
> 요약: 브라우저에서 설정 페이지 진입 시 "새 메모에 자동 알림" 토글이 localStorage 실제 값과 무관하게 항상 OFF 로 표시되지만, 실제 동작(메모 생성·알림 관리)은 ON 값을 쓰고 있어 UI 만 불일치 — 설정 페이지의 로컬 `$state` 초기값 복사를 `$derived` 로 교체해 타이밍 디싱크 제거

---

## 개요

### 증상

- 브라우저(일반 탭)로 접속: 설정 → "기본 알림 설정" → **새 메모에 자동 알림** 토글이 항상 OFF.
- 설치된 PWA 에서 접속: 동일 항목이 ON.
- 그런데 **알림 관리** 화면에는 양쪽 모두 기본 알림 시간(예: 09:00)의 메모들이 정상적으로 노출된다 → 실제 저장값은 ON 으로 이미 적용되어 있는 상태.
- 즉 "토글 표시 false / 실제 저장값 true" 의 **상태 출력(UI 렌더링) 버그**.

### 근본 원인 가설

1. `src/lib/stores/settings.svelte.ts:79` 에서 `settings = $state<AppSettings>(DEFAULT_SETTINGS)` 로 **DEFAULT 값으로 먼저 초기화**.
2. 실제 localStorage 값은 `settingsStore.init()` 에서 `loadFromStorage()` 로 덮어씀 — `src/lib/stores/settings.svelte.ts:82-86`.
3. `init()` 호출 지점: `src/routes/+layout.svelte:142` 의 `onMount` 내부. `browser` 가드는 없지만 `loadFromStorage()` 자체가 `typeof window === 'undefined'` 가드를 갖고 있어 실제 덮어쓰기는 **client onMount 시점**.
4. Svelte 컴포넌트 스크립트 실행 순서:
   - `<script>` 최상위: **parent layout → child page** 순서 (parent 먼저)
   - `onMount`: **child page → parent layout** 순서 (child 먼저)
5. `src/routes/settings/+page.svelte:626` `let autoReminderOnCreate = $state(settingsStore.settings.autoReminderOnCreate);` 는 page `<script>` **최상위**에서 실행. 이 시점엔 parent layout 의 `onMount` 가 아직 호출되지 않았다 → `settingsStore.init()` 아직 실행 전 → `settings` 는 여전히 `DEFAULT_SETTINGS` → `autoReminderOnCreate = false` 로 state 가 굳는다.
6. `$state(값)` 은 그 시점의 값을 **복사**한다. 이후 `settingsStore.settings.autoReminderOnCreate` 가 true 로 바뀌어도 **로컬 state 는 업데이트되지 않는다**. 토글을 직접 누르기 전까지 false 고정.

**브라우저 vs PWA 의 차이**:
- 브라우저 cold load: 새 탭/새로고침마다 layout-page 초기화가 같이 일어남 → 위 레이스 발생.
- PWA: 앱이 이미 살아있는 상태에서 `settings` 페이지로 navigate → `settingsStore.init()` 은 예전 앱 시작 시 완료된 상태 → store.settings 가 이미 true → `$state(true)` 로 박힘 → 토글 ON.

**"알림 관리 에는 자동 알림 메모가 보임"이 성립하는 이유**:
- `alarmManagerStore.groupByTime()` (`src/lib/stores/alarmManager.svelte.ts`) 은 **각 메모의 `reminder.enabled`** 를 보고 그룹화한다. `autoReminderOnCreate` 토글과 독립적.
- `MemoForm.svelte:151` 등 실제 동작 경로는 `settingsStore.settings.autoReminderOnCreate` 를 **실시간으로** 참조하므로 실제 저장값(true) 을 정확히 사용.
- 따라서 "데이터는 ON 로 동작 / UI 만 OFF 로 표시"의 일관된 증상이 나타난다.

### 코드 근거

- `src/lib/stores/settings.svelte.ts:31-53` — `DEFAULT_SETTINGS.autoReminderOnCreate = false`
- `src/lib/stores/settings.svelte.ts:79-86` — `createSettingsStore`: `settings = $state(DEFAULT_SETTINGS)` 로 시작 → `init()` 에서 `loadFromStorage()` 로 덮어쓰기
- `src/routes/+layout.svelte:141-143` — `onMount` 내 `themeStore.init(); settingsStore.init(); notificationStore.init();`
- `src/routes/settings/+page.svelte:615-660` — 로컬 `$state` 변수 다수가 `settingsStore.settings.{field}` 를 **초기값 복사** 방식으로 읽음
- `src/lib/components/memo/QuickMemoInput.svelte:10` — 동일 안티패턴(`$state(settingsStore.settings.autoReminderOnCreate)`). 설정 페이지뿐 아니라 QuickMemoInput 역시 cold load 시 OFF 로 굳을 수 있다.

### 영향 범위 (같은 안티패턴이 있는 모든 위치)

- `src/routes/settings/+page.svelte:615` `useMarkdown`
- `src/routes/settings/+page.svelte:624` `defaultTime`
- `src/routes/settings/+page.svelte:625` `defaultDays` (배열 복사 — derived 가 더 안전)
- `src/routes/settings/+page.svelte:626` `autoReminderOnCreate` ← 사용자가 직접 겪은 증상
- `src/routes/settings/+page.svelte:654-660` `todoRemindEnabled`, `todoRemindTime`, `todoAutoAlertEnabled`, `todoAutoAlertMinutes`, `todoShowOverdue`, `todoShowProgress`, `todoShowUpcomingOnEmpty`
- `src/lib/components/memo/QuickMemoInput.svelte:10` `useAutoReminder`

## 기술적 고려사항

- **수정 전략 1 (채택)**: 각 `$state(store.settings.x)` 를 `$derived(store.settings.x)` 로 교체. 토글 핸들러에서 로컬 변수에 대입하던 부분을 **`settingsStore.setX()` 호출만 남기고** 로컬 재대입 제거. store 가 업데이트되면 `$derived` 가 자동 재계산 → 순서 디싱크 영구 해소.
- **수정 전략 2 (기각)**: `settingsStore.init()` 을 스토어 모듈 import 시점에 실행. 이러면 SSR 빌드 시 window 가드에 걸려 noop, client 번들 로드 시점에 동기 실행. 그러나 `theme`, `notification` 등 다른 스토어와의 init 순서 보장이 없어지고, store 내부의 import-time side effect 가 번들 크기/트리쉐이킹에 영향. **전역 해법으로는 부적합.**
- **수정 전략 3 (기각)**: `+page.svelte` 상단에 `$effect(() => { autoReminderOnCreate = settingsStore.settings.autoReminderOnCreate; })` 추가. 동작은 하지만 `$state + $effect` 로 값 복제/동기화를 이중으로 관리 → 코드 중복, 향후 항목 추가 시 누락 위험. derived 로 직접 바인딩하는 게 단일 원천.
- **HTML `<input type="checkbox" bind:checked>` 호환**: `$derived` 는 **readonly**이므로 `bind:checked={autoReminderOnCreate}` 는 불가. 설정 페이지는 이미 커스텀 토글 버튼 + `handleAutoReminderToggle()` 방식이라 derived 치환 가능. 다른 항목(특히 Todo 토글, useMarkdown)도 각 항목별 템플릿 바인딩 패턴을 Phase 1-2 에서 확인하고 필요 시 `bind:checked` → `checked={...} onchange={...}` 로 교체.
- **타입 안정성**: `defaultDays` 는 배열. `let defaultDays = $state<number[]>([...store.settings.defaultReminder.days]);` 처럼 spread 복사되는 코드는 `$derived(store.settings.defaultReminder.days)` 로 대체. `toggleDefaultDay` 핸들러는 `settingsStore.setDefaultReminderDays(newDays)` 만 호출하도록 수정.
- **테스트 범위**: 회귀 위험은 설정 UI 전반. 수동 검증 필수. 자동 테스트 인프라(Vitest/Playwright) 가 이 프로젝트에 상시 돌지 않으므로 Phase 5 수동 테스트로 대체.
- **QuickMemoInput 도 동일 패턴**: 설정 페이지 수정만으로는 QuickMemoInput 의 "자동 알림 ON/OFF" 표시가 cold load 에서 여전히 false 일 수 있음. 이번 plan 범위에 포함.
- **Phase R 경로 전수 조사 범위**: 동일 안티패턴(`$state(otherStore.x)`)이 `themeStore`, `notificationStore`, `authStore`, `foldersStore`, `tagMetaStore`, `filterStore` 등 다른 스토어를 참조하는 컴포넌트에도 있는지 확인. 있다면 별도 plan 으로 분리할지, 본 plan 에 편입할지 R1 결과 기반 판단.

## TODO

### Phase 0: Worktree 준비

0. - [x] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [x] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [x] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: blank 슬롯은 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [x] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `worktree 생성 또는 재개`는 `/implement` 또는 `plan-runner` owner flow 임을 적는다
   - [x] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 원인 재현 (정량 근거 확보)

1. - [x] **cold load 레이스 재현 로그 1회 채취** — 가설 실제 확인
   - [x] 코드 근거로 가설 확정: `<script>` 최상위 실행(parent→child)과 `onMount`(child→parent) 역순 보장. `$state(store.x)` 는 `<script>` 최상위에서 DEFAULT 값 복사. 디버그 로그 불필요.

### Phase 2: 설정 페이지 — 로컬 `$state` 를 `$derived` 로 교체

2. - [x] **`autoReminderOnCreate` 를 derived 로 교체**
   - [x] `src/routes/settings/+page.svelte:626`: → `const autoReminderOnCreate = $derived(settingsStore.settings.autoReminderOnCreate)` ✅
   - [x] `src/routes/settings/+page.svelte` `handleAutoReminderToggle`: `autoReminderOnCreate = ...` 재대입 제거 → `settingsStore.setAutoReminderOnCreate(!autoReminderOnCreate)` 만 남김 ✅
   - [x] 템플릿의 `aria-checked`, `class`, `{#if}` 참조: 읽기만 하여 readonly derived 와 호환 확인 ✅

3. - [x] **기본 알림 시간/요일 derived 교체**
   - [x] `defaultTime`: `$derived(settingsStore.settings.defaultReminder.time)` ✅
   - [x] `defaultDays`: `$derived(settingsStore.settings.defaultReminder.days)` ✅
   - [x] `toggleDefaultDay`: 로컬 재대입 제거 → `const next = ...; settingsStore.setDefaultReminderDays(next)` ✅
   - [x] `handleTimeChange`: `defaultTime = ...` 제거 → `settingsStore.setDefaultReminderTime(...)` 만 남김 ✅
   - [x] `bind:value` 없음 확인 — `value={defaultTime} onchange={handleTimeChange}` 패턴 ✅

4. - [x] **Todo 기본설정 토글/값 derived 교체**
   - [x] `todoRemindEnabled` through `todoShowUpcomingOnEmpty` 7개 모두 `$derived` 교체 ✅
   - [x] `useMarkdown`: `$derived(settingsStore.settings.useMarkdown ?? false)` ✅
   - [x] 모든 핸들러에서 로컬 재대입 제거, store 메서드 직접 호출 ✅
   - [x] `bind:checked` 없음 확인 — 커스텀 토글 패턴 사용 ✅

### Phase 3: QuickMemoInput 동일 패턴 수정

5. - [x] **QuickMemoInput 의 `useAutoReminder` derived 화**
   - [x] `src/lib/components/memo/QuickMemoInput.svelte:10`: → `let sessionOverride = $state<boolean | null>(null)` + `const useAutoReminder = $derived(sessionOverride ?? settingsStore.settings.autoReminderOnCreate)` ✅
   - [x] `toggleAutoReminder()`: `useAutoReminder = !useAutoReminder` → `sessionOverride = !useAutoReminder` (세션 오버라이드 패턴) ✅
   - [x] 템플릿: `useAutoReminder` 참조 읽기 전용 → 호환 ✅

### Phase R: 재발 경로 분석 (fix: plan 필수)

R1. - [x] **동일 안티패턴 전수 조사** — `$state(someStore.xxx)` 초기값 복사 패턴
   - [x] Grep 결과 (src/routes + src/lib/components): 히트 2건 발견

   | 파일 | 변수 | 스토어 | init 위치 | 디싱크 가능성 | 근거 |
   |------|------|--------|----------|-------------|------|
   | `settings/+page.svelte` (多) | 10개 변수 | settingsStore | layout onMount | Y | init 전 `<script>` 실행으로 DEFAULT 고정 — **Phase 2~4 처리됨** |
   | `QuickMemoInput.svelte:10` | useAutoReminder | settingsStore | layout onMount | Y | 동일 타이밍 이슈 — **Phase 3 처리됨** |
   | `FolderSelector.svelte:16` | newFolderColor | foldersStore.DEFAULT_COLORS | — | N | `DEFAULT_COLORS[0]`은 정적 상수, init 무관 |
   | `SearchBar.svelte:6` | inputValue | filterStore.searchQuery | layout onMount | N | `searchQuery`는 `$state('')` 초기값 = `''` — init 후에도 `''`이므로 디싱크 없음 |

R2. - [x] **판정 표 후속 조치 분류**
   - [x] `Y` 항목: settings/QuickMemoInput — Phase 2~3에서 처리 완료
   - [x] `N` 항목: FolderSelector(정적 상수), SearchBar(transient state) — 별도 plan 불필요

R3. - [x] **방어 증명**
   - [x] `$state(settingsStore.` 0건 확인 — `settings/+page.svelte`, `QuickMemoInput.svelte` 모두 교체 완료 ✅
   - [x] 범위 밖 파일(`FolderSelector`, `SearchBar`) — 조건부/N 판정, 별도 plan 불필요
   - [x] 범위 내 전체 방어 완료 — `settingsStore` 초기값 복사 패턴 모두 `$derived` 또는 `sessionOverride ?? derived` 패턴으로 교체됨

### Phase 4: 수동 검증

6. - [ ] **브라우저 cold load 재현 시나리오**
   - [ ] `docs/plan/2026-04-24_fix-settings-state-desync-on-cold-load.md`: 아래 시나리오 결과를 본 파일 "검증" 섹션에 기록
   - [ ] 브라우저 devtools → Application → Local Storage → `memo-alarm-settings.autoReminderOnCreate` 를 true 로 세팅
   - [ ] 탭 완전 새로고침(Ctrl+Shift+R) 후 설정 페이지 진입 → 토글이 **ON** 으로 표시되는지 확인
   - [ ] false 로 세팅 후 새로고침 → OFF 로 표시되는지 확인
   - [ ] 토글 클릭 → localStorage 값이 즉시 바뀌는지 확인

7. - [ ] **PWA 회귀 시나리오**
   - [ ] 설치된 PWA 에서 동일 토글이 이전처럼 올바르게 반영되는지 확인 (회귀 없음)
   - [ ] 설정 페이지의 나머지 토글(useMarkdown, todoRemindEnabled, todoAutoAlertEnabled, todoShowOverdue/Progress/UpcomingOnEmpty)도 localStorage 값과 UI 가 일치하는지 5종 샘플링 확인

8. - [ ] **"알림 관리" 일관성 재확인**
   - [ ] 토글 OFF 상태에서 새 메모 생성 → 알림 미적용 확인
   - [ ] 토글 ON 상태에서 새 메모 생성 → 기본 알림 자동 적용 + "알림 관리" 에 노출되는지 확인
   - [ ] QuickMemoInput (홈 화면 하단 입력) 의 "자동 알림" 토글 표시가 cold load 에서도 localStorage 값과 일치하는지 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `main merge 시도`를 owner step 으로 적는다
   - [ ] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `root dirty stash/apply (if needed)`를 owner step 으로 적는다
   - [ ] `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `T4/T5 해당 없음 (TypeScript/Svelte UI, pytest 강제 규칙 비대상)`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

## 🔴 pytest 강제 Phase 규칙 — 해당 없음

> T1~T5 해당 없음: 본 plan 은 Python 코드를 수정하지 않는다. 변경 범위는 `src/routes/settings/+page.svelte`, `src/lib/components/memo/QuickMemoInput.svelte` 의 Svelte 5 $state → $derived 리팩터. Phase 4 수동 검증으로 대체한다.

---

## 검증

### 검증 기준

- [ ] Phase 1 재현 로그에서 "page-script 시점 값 = DEFAULT(false), layout onMount 이후 값 = true" 가 실제로 관찰됨 — 가설 확정
- [ ] 수정 후 cold load(새 탭/Ctrl+Shift+R)에서 토글이 localStorage 값과 일치해 표시됨
- [ ] PWA 회귀 없음 (기존 ON 표시 유지)
- [ ] 설정 페이지 모든 토글/시간/요일이 동일 패턴으로 일관 동작
- [ ] QuickMemoInput 의 "자동 알림" 표시도 cold load 에서 정확
- [ ] Phase R2 판정 표에 모든 히트가 `처리됨` 또는 `별도 plan 필요(링크 기재)` 로 분류됨

---

## 후속 작업 (본 plan 범위 밖)

- Phase R2 에서 "별도 plan 필요" 로 기록된 컴포넌트가 있다면 해당 plan 초안을 본 plan 완료 시점에 생성한다. 예상 후보: `themeStore`, `notificationStore`, `foldersStore`, `tagMetaStore` 를 참조하는 `$state(...)` 초기값 복사 패턴이 발견될 경우.

---

*상태: 머지대기 | 진행률: 35/58 (60%)*
