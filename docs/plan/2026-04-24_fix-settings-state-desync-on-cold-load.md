# fix: 브라우저 cold load 시 설정 토글이 DEFAULT 로 굳는 상태 출력 버그

> 작성일시: 2026-04-24 17:45
> 기준커밋: 931c414
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/16 (0%)
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
- **HTML `<input type="checkbox" bind:checked>` 호환**: `$derived` 는 **readonly**이므로 `bind:checked={autoReminderOnCreate}` 는 불가. 이 파일은 이미 커스텀 토글 버튼 + `handleAutoReminderToggle()` 방식이라 derived 로 치환 가능. 일부 Todo 토글은 `bind:checked` 형태일 수 있으니 각 항목별 점검 필요 (Phase 1-2 에서 확인).
- **타입 안정성**: `defaultDays` 는 배열. `let defaultDays = $state<number[]>([...store.settings.defaultReminder.days]);` 처럼 spread 복사되는 코드는 `$derived([...store.settings.defaultReminder.days])` 또는 단순 `$derived(store.settings.defaultReminder.days)` 로 대체. `toggleDefaultDay` 핸들러는 `settingsStore.setDefaultReminderDays(newDays)` 만 호출하도록 수정.
- **테스트 범위**: 회귀 위험은 설정 UI 전반. 수동 검증 필수. 자동 테스트 인프라(Vitest/Playwright) 가 이 프로젝트에 상시 돌지 않으므로 Phase 5 수동 테스트로 대체.
- **QuickMemoInput 도 동일 패턴**: 설정 페이지 수정만으로는 QuickMemoInput 의 "자동 알림 ON/OFF" 표시가 cold load 에서 여전히 false 일 수 있음. 이번 plan 범위에 포함.

## TODO

### Phase 0: Worktree 준비

0. ☐ **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: blank 슬롯은 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `worktree 생성 또는 재개`는 `/implement` 또는 `plan-runner` owner flow 임을 적는다
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 원인 재현 (정량 근거 확보)

1. ☐ **cold load 레이스 재현 로그 1회 채취** — 가설 실제 확인
   - ☐ `src/routes/settings/+page.svelte`: `<script>` 최상위에 임시 `console.log('[settings-page] store.autoReminderOnCreate =', settingsStore.settings.autoReminderOnCreate, Date.now())` 1줄 추가
   - ☐ `src/routes/+layout.svelte`: `settingsStore.init()` 직후에 임시 `console.log('[layout-onMount] after init =', settingsStore.settings.autoReminderOnCreate, Date.now())` 1줄 추가
   - ☐ 브라우저 devtools 에서 localStorage `memo-alarm-settings.autoReminderOnCreate = true` 로 세팅 → 탭 새로고침 → 콘솔 타임스탬프로 "page-top log 가 먼저, layout-onMount log 가 나중" + "page-top 시점 값이 false" 를 확인하고 캡처를 plan 에 기록
   - ☐ 재현 확인 후 디버그 `console.log` 를 **제거**(Phase 4 전에 제거)

### Phase 2: 설정 페이지 — 로컬 `$state` 를 `$derived` 로 교체

2. ☐ **`autoReminderOnCreate` 를 derived 로 교체**
   - ☐ `src/routes/settings/+page.svelte:626`: `let autoReminderOnCreate = $state(settingsStore.settings.autoReminderOnCreate);` → `const autoReminderOnCreate = $derived(settingsStore.settings.autoReminderOnCreate);`
   - ☐ `src/routes/settings/+page.svelte:648-651` `handleAutoReminderToggle`: `autoReminderOnCreate = !autoReminderOnCreate;` 제거 → `settingsStore.setAutoReminderOnCreate(!autoReminderOnCreate);` 만 남긴다
   - ☐ `src/routes/settings/+page.svelte:889,892,898`: 템플릿의 `aria-checked`, `class`, `{#if}` 참조가 readonly derived 와 호환되는지 확인 (읽기만 하면 OK)

3. ☐ **기본 알림 시간/요일 derived 교체**
   - ☐ `src/routes/settings/+page.svelte:624`: `let defaultTime = $state(...)` → `const defaultTime = $derived(settingsStore.settings.defaultReminder.time);`
   - ☐ `src/routes/settings/+page.svelte:625`: `let defaultDays = $state<number[]>(...)` → `const defaultDays = $derived(settingsStore.settings.defaultReminder.days);`
   - ☐ `src/routes/settings/+page.svelte:633-640` `toggleDefaultDay`: 로컬 `defaultDays = ...` 재대입 제거 → `const next = defaultDays.includes(day) ? defaultDays.filter(d => d !== day) : [...defaultDays, day].sort(); settingsStore.setDefaultReminderDays(next);`
   - ☐ `src/routes/settings/+page.svelte:642-646` `handleTimeChange`: `defaultTime = target.value;` 제거 → `settingsStore.setDefaultReminderTime(target.value);` 만 남긴다
   - ☐ `<input type="time" bind:value={defaultTime}>` 형태가 있는지 Grep 후 있다면 `value={defaultTime} oninput={handleTimeChange}` 로 교체(derived 는 bind 불가)

4. ☐ **Todo 기본설정 토글/값 derived 교체**
   - ☐ `src/routes/settings/+page.svelte:654`: `todoRemindEnabled` derived 화 + `handleTodoRemindToggle` 에서 로컬 재대입 제거
   - ☐ `src/routes/settings/+page.svelte:655`: `todoRemindTime` derived 화 + `handleTodoRemindTimeChange` 재대입 제거
   - ☐ `src/routes/settings/+page.svelte:656`: `todoAutoAlertEnabled` derived 화 + 토글 핸들러 재대입 제거
   - ☐ `src/routes/settings/+page.svelte:657`: `todoAutoAlertMinutes` derived 화 + minutes 변경 핸들러 재대입 제거
   - ☐ `src/routes/settings/+page.svelte:658-660`: `todoShowOverdue`, `todoShowProgress`, `todoShowUpcomingOnEmpty` 셋 모두 derived 화 + 각 핸들러 재대입 제거
   - ☐ `src/routes/settings/+page.svelte:615`: `useMarkdown` derived 화 + `handleMarkdownToggle` 에서 재대입 제거
   - ☐ `bind:checked` 로 직접 바인딩된 토글이 있으면 `checked={...}` + `onchange={...}` 패턴으로 변경

### Phase 3: QuickMemoInput 동일 패턴 수정

5. ☐ **QuickMemoInput 의 `useAutoReminder` derived 화**
   - ☐ `src/lib/components/memo/QuickMemoInput.svelte:10`: `let useAutoReminder = $state(settingsStore.settings.autoReminderOnCreate);` → derived 교체
   - ☐ `src/lib/components/memo/QuickMemoInput.svelte`: 해당 변수에 대입하는 모든 지점을 Grep → 있으면 사용 의도 확인 후 제거 또는 로컬 세션용 별도 state(예: `manualOverride`) 로 분리
   - ☐ 토글 UI 가 있으면 derived 와 호환되는 checked/onchange 패턴으로 정리

### Phase 4: 수동 검증

6. ☐ **브라우저 cold load 재현 시나리오**
   - ☐ `docs/plan/2026-04-24_fix-settings-state-desync-on-cold-load.md`: 아래 시나리오 결과를 본 파일 "검증" 섹션에 기록
   - ☐ 브라우저 devtools → Application → Local Storage → `memo-alarm-settings.autoReminderOnCreate` 를 true 로 세팅
   - ☐ 탭 완전 새로고침(Ctrl+Shift+R) 후 설정 페이지 진입 → 토글이 **ON** 으로 표시되는지 확인
   - ☐ false 로 세팅 후 새로고침 → OFF 로 표시되는지 확인
   - ☐ 토글 클릭 → localStorage 값이 즉시 바뀌는지 확인

7. ☐ **PWA 회귀 시나리오**
   - ☐ 설치된 PWA 에서 동일 토글이 이전처럼 올바르게 반영되는지 확인 (회귀 없음)

8. ☐ **"알림 관리" 일관성 재확인**
   - ☐ 토글 OFF 상태에서 새 메모 생성 → 알림 미적용 확인
   - ☐ 토글 ON 상태에서 새 메모 생성 → 기본 알림 자동 적용 + "알림 관리" 에 노출되는지 확인

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. ☐ **post-merge 정리 확인** — `/merge-test` owner
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `main merge 시도`를 owner step 으로 적는다
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `root dirty stash/apply (if needed)`를 owner step 으로 적는다
   - ☐ `2026-04-24_fix-settings-state-desync-on-cold-load.md`: `T4/T5 해당 없음 (TypeScript/Svelte UI, pytest 강제 규칙 비대상)`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

## 🔴 pytest 강제 Phase 규칙 — 해당 없음

> T1~T5 해당 없음: 본 plan 은 Python 코드를 수정하지 않는다. 변경 범위는 `src/routes/settings/+page.svelte`, `src/lib/components/memo/QuickMemoInput.svelte` 의 Svelte 5 $state → $derived 리팩터. Phase 4 수동 검증으로 대체한다.

---

## 검증

### 검증 기준

- ☐ Phase 1 재현 로그에서 "page-script 시점 값 = DEFAULT(false), layout onMount 이후 값 = true" 가 실제로 관찰됨 — 가설 확정
- ☐ 수정 후 cold load(새 탭/Ctrl+Shift+R)에서 토글이 localStorage 값과 일치해 표시됨
- ☐ PWA 회귀 없음 (기존 ON 표시 유지)
- ☐ 설정 페이지 모든 토글/시간/요일이 동일 패턴으로 일관 동작
- ☐ QuickMemoInput 의 "자동 알림" 표시도 cold load 에서 정확

---

*상태: 초안 | 진행률: 0/16 (0%)*
