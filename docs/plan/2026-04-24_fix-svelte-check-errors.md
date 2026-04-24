# fix: memo-alarm svelte-check 에러 수정

> 출처: /reflect에서 자동 생성
> 작성일시: 2026-04-24 14:30
> 기준커밋: 3772a31
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> 유형: fix
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/15 (0%)
> 요약: `npm run check` 실행 시 실제 21개 에러 존재 — ambient 선언, VoiceInput, Modal/EmojiPicker/Icon props, QuickMemoInput/notifications, Onboarding/TodoCard 정합성을 수정해 0 errors 확보

---

## 개요

`npm run check`를 2026-04-24에 재실행한 결과 `svelte-check found 21 errors and 57 warnings in 21 files`가 확인됐다.
이번 scope는 warnings가 아니라 **errors 21건 전부 해소**다.

> 재검토 수정 (2026-04-24)
> - Category A(`__APP_VERSION__`)와 B(Web Speech API)는 실제 에러 존재.
> - 기존 초안에 있던 `auth/callback/+page.svelte`는 현재 `npm run check` 로그에 없음 → 이번 plan 범위에서 제거.
> - `OnboardingModal.svelte`, `TodoCard.svelte` 3건은 기존 초안 누락이어서 이번 재검토에서 추가.
> - `notifications/+page.svelte`는 archive `2026-02-04_derived-pattern-fix.md`와 일치하게 "`$derived.by()` 값은 호출하지 않는다" 규칙만 보정하면 된다.

### 에러 카테고리 (7종, 총 21건)

| # | 카테고리 | 에러 수 | 대표 파일 |
|---|---------|---------|----------|
| A | 전역 ambient 선언 누락 (`__APP_VERSION__`) | 1 | `src/app.d.ts`, `src/lib/config.ts` |
| B | Web Speech API 타입 누락 | 3 | `src/lib/components/memo/VoiceInput.svelte` |
| C | Modal `size` prop 미선언 (`$$ComponentProps`) | 5 | `MemoDetailModal.svelte`, `PinLockModal.svelte`, `ScheduledRemindersModal.svelte`, `ShareModal.svelte`, `SwipeGuideModal.svelte` |
| D | EmojiPicker `emoji` prop 미존재 (`Props`) | 2 | `MemoForm.svelte`, `share/+page.svelte` |
| E | Icon `title` prop 미존재 (`IconProps`) | 4 | `MemoCard.svelte` |
| F | 기타 Svelte/TS 호출 정합성 | 3 | `QuickMemoInput.svelte`, `notifications/+page.svelte` |
| G | 선언 순서/불필요 비교 오류 | 3 | `OnboardingModal.svelte`, `TodoCard.svelte` |

## 기술적 고려사항

- `src/app.d.ts`는 현재 `export {}`가 있는 모듈 파일이므로, `declare const __APP_VERSION__`를 파일 최상위에 두면 전역으로 퍼지지 않는다. `declare global { ... }` 내부로 옮겨야 `src/lib/config.ts`에서 인식된다.
- Web Speech API는 현재 tsconfig 조합에서 생성자/이벤트 타입이 자동 제공되지 않는다. `tsconfig.json` 변경보다 `src/app.d.ts`에 최소 ambient 타입을 추가하는 편이 범위가 좁고 결정적이다.
- `VoiceInput.svelte`는 현재 `(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition`를 사용한다. ambient 타입 추가 후에는 typed constructor 변수로 바꿔 `any` 경로를 줄이는 것이 안전하다.
- `Modal.svelte`는 이미 `class`로 폭 조절이 가능하지만 호출처 5곳이 공통으로 `size="sm|md|lg"`를 넘기고 있다. props + width mapping을 `Modal.svelte`에 흡수하는 편이 중복 class 문자열보다 유지보수성이 높다.
- `QuickMemoInput.svelte`는 archive `2026-04-24_fix-settings-state-desync-on-cold-load.md`에서 `sessionOverride ?? settingsStore.settings.autoReminderOnCreate` 패턴으로 보정된 상태다. 이번 fix는 이 패턴을 되돌리지 않고 `reminder.id`만 보강해야 한다.
- `notifications/+page.svelte`는 archive `2026-02-04_derived-pattern-fix.md` 후속 잔여분이다. `$derived.by()` 자체를 다시 바꾸지 않고 호출부 괄호만 제거한다.
- active plan `docs/plan/2026-03-30_bookmark-filter-todo-card.md`도 `src/lib/components/todo/TodoCard.svelte`를 건드릴 수 있다. 이번 plan은 `todoPriority !== "none"` 제거 **한 줄 범위**로 제한하고, 카드 레이아웃/렌더링 구조는 범위 밖으로 둔다.
- 로컬 drift 확인 결과 현재 dirty 파일(`docs/archive/*.md`, `package-lock.json`, `AGENTS.md`, `docs/design-prompt-settings.md`)은 이번 plan seed와 겹치지 않는다. 중단 사유가 아니라 `영향 없음`으로 판정한다.

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `2026-04-24_fix-svelte-check-errors.md`: `> branch:`, `> worktree:`, `> worktree-owner:` blank 슬롯 유지
   - [ ] `2026-04-24_fix-svelte-check-errors.md`: worktree 생성 또는 재개는 `/implement` 또는 `plan-runner` owner flow 담당임을 유지
   - [ ] `2026-04-24_fix-svelte-check-errors.md`: worktree cwd를 `D:/work/project/service/wtools/memo-alarm`로 고정 확인

### Phase 1: ambient 선언 및 VoiceInput 타입 보정

1. - [ ] **`src/app.d.ts` 전역 선언 보정**
   - [ ] `src/app.d.ts`: `declare const __APP_VERSION__: string;`를 `declare global { ... }` 내부로 이동
   - [ ] `src/app.d.ts`: `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, `SpeechRecognitionConstructor`, `Window.SpeechRecognition`, `Window.webkitSpeechRecognition` 최소 타입 선언 추가
   - [ ] `src/lib/config.ts`, `src/lib/components/memo/VoiceInput.svelte`가 새 ambient 선언을 참조하도록 경로/이름 정합성 확인

2. - [ ] **`VoiceInput.svelte`의 SpeechRecognition 생성 경로를 typed constructor로 정리**
   - [ ] `src/lib/components/memo/VoiceInput.svelte:17-21` 읽기: 지원 여부 확인 로직에서 `window` fallback 순서 확인
   - [ ] `src/lib/components/memo/VoiceInput.svelte:26-35`: `const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition` 패턴으로 교체
   - [ ] `src/lib/components/memo/VoiceInput.svelte`: `new SpeechRecognitionCtor()`와 `onresult`/`onerror` 시그니처가 ambient 타입과 맞는지 확인

### Phase 2: 공통 컴포넌트 props 정합성 수정

3. - [ ] **Modal `size` prop 추가** — `$$ComponentProps` 에러 5건 수정
   - [ ] `src/lib/components/ui/Modal.svelte:6-20` 읽기: 현재 Props `{ open, title, children, footer, class, useHistory }` 확인
   - [ ] `src/lib/components/ui/Modal.svelte`: Props에 `size?: 'sm' | 'md' | 'lg' | 'xl'` 추가
   - [ ] `src/lib/components/ui/Modal.svelte`: `max-w-lg` 고정 class를 `size`별 width mapping으로 교체하고 미지정 기본값은 `lg` 유지
   - [ ] `MemoDetailModal.svelte`, `PinLockModal.svelte`, `ScheduledRemindersModal.svelte`, `ShareModal.svelte`, `SwipeGuideModal.svelte` 5곳의 `size=` 사용이 추가 수정 없이 통과하는지 확인

4. - [ ] **EmojiPicker 사용처를 `selected` prop으로 통일** — `Props` 에러 2건 수정
   - [ ] `src/lib/components/memo/EmojiPicker.svelte`: Props가 `{ selected, onSelect }`뿐인지 확인
   - [ ] `src/lib/components/memo/MemoForm.svelte:301`: `<EmojiPicker {emoji} ...>`를 `<EmojiPicker selected={emoji} ...>`로 교체
   - [ ] `src/routes/share/+page.svelte:230`: 동일 패턴으로 `selected={emoji}` 적용

5. - [ ] **MemoCard의 lucide icon `title` prop을 접근성 속성으로 교체** — 에러 4건 수정
   - [ ] `src/lib/components/memo/MemoCard.svelte:121,167`: `CloudOff title=`을 `aria-label=`로 교체
   - [ ] `src/lib/components/memo/MemoCard.svelte:123,169`: `RefreshCw title=`을 `aria-label=`로 교체
   - [ ] `src/lib/components/memo/MemoCard.svelte`: 버튼에 이미 남아 있는 `title=` 속성(`동기화 실패 - 탭하여 재시도`)은 icon prop 에러와 무관하므로 유지

### Phase 3: 잔여 TS/Svelte 에러 수정

6. - [ ] **QuickMemoInput 기본 reminder에 `id` 추가**
   - [ ] `src/lib/components/memo/QuickMemoInput.svelte:42-44` 읽기: `settingsStore.getDefaultReminder()` 반환값 shape 확인
   - [ ] `src/lib/components/memo/QuickMemoInput.svelte:43`: `data.reminder = { ...defaultReminder }`를 `id` 포함 객체로 보정
   - [ ] `src/lib/components/memo/QuickMemoInput.svelte`: archive의 `sessionOverride`/`useAutoReminder` 패턴은 변경하지 않음을 확인

7. - [ ] **`notifications/+page.svelte` 호출부 괄호 제거**
   - [ ] `src/routes/notifications/+page.svelte:56-74` 읽기: `visibleGrouped`, `filterMemoTitle`가 `$derived.by()` 값인지 확인
   - [ ] `src/routes/notifications/+page.svelte:151`: `{filterMemoTitle()}`를 `{filterMemoTitle}`로 교체
   - [ ] `src/routes/notifications/+page.svelte:261`: `visibleGrouped()[dateKey]`를 `visibleGrouped[dateKey]`로 교체

8. - [ ] **Onboarding step 선언 순서 오류 수정**
   - [ ] `src/lib/components/OnboardingModal.svelte:11-18` 읽기: `const step = $derived(steps[currentStep])`가 `const steps = [...]`보다 먼저 선언된 상태 확인
   - [ ] `src/lib/components/OnboardingModal.svelte`: `const steps = [...]`를 `const step = $derived(...)`보다 위로 이동
   - [ ] `src/lib/components/OnboardingModal.svelte`: 이번 scope에서는 `<svelte:component>` deprecation warning을 건드리지 않음을 명시

9. - [ ] **TodoCard의 불필요한 `"none"` 비교 제거**
   - [ ] `src/lib/types/memo.ts`: `TodoPriority`가 `'low' | 'medium' | 'high' | 'urgent'`만 포함하는지 확인
   - [ ] `src/lib/components/todo/TodoCard.svelte:171`: `todo.todoPriority !== "none"` 비교 제거
   - [ ] `docs/plan/2026-03-30_bookmark-filter-todo-card.md`와 충돌하지 않도록 이번 수정이 priority badge guard 한 줄 범위임을 유지

### Phase T1: TC 작성

> T1 해당 없음: 이번 plan은 TypeScript/Svelte 타입 정합성 수정이며 Python 테스트 강제 규칙 비대상이다. 컴파일 게이트(T2)와 Phase R 참조 전수 조사로 검증한다.

### Phase T2: TC 검증 (빌드 게이트)

10. - [ ] **`npm run check` 실행 후 0 errors 확인**
   - [ ] `memo-alarm` 디렉토리에서 `npm run check` 실행
   - [ ] warnings는 잔존 가능하더라도 errors가 0인지 확인
   - [ ] 에러 잔존 시 해당 Phase로 되돌아가 누락 파일을 보강

11. - [ ] **`npm run build` 실행 후 빌드 성공 확인**
   - [ ] `memo-alarm` 디렉토리에서 `npm run build` 실행
   - [ ] 빌드 성공과 정적 타입 정합성 유지 확인

### Phase R: 재발 경로 분석 (fix: plan 필수)

12. - [ ] **수정 대상의 모든 호출/참조 경로 열거**
   - [ ] `__APP_VERSION__`, `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` 프로젝트 전역 Grep
   - [ ] `<Modal size=`, `<EmojiPicker`, `title="로컬에 저장됨 - 동기화 대기"`, `title="동기화 중..."` Grep으로 추가 동일 패턴 확인
   - [ ] `getDefaultReminder()`, `filterMemoTitle(`, `visibleGrouped(`, `steps[currentStep]`, `todoPriority !== "none"` Grep으로 잔존 경로 확인
   - [ ] 경로별 방어 여부 표 작성: `식별자 | 파일 | 방어여부 | 근거`

13. - [ ] **미방어 경로 수정 또는 범위 제외 명시**
   - [ ] 추가 `<Modal size=` 또는 `<EmojiPicker {emoji}` 잔존 사용처가 있으면 같은 fix scope에 편입
   - [ ] `TodoCard.svelte`에서 layout/렌더링 구조 변경 요구가 발견되면 이번 scope에서 제외하고 active plan `2026-03-30_bookmark-filter-todo-card.md`와의 선행관계만 비고에 기록
   - [ ] archive `2026-02-04_derived-pattern-fix.md`, `2026-04-24_fix-settings-state-desync-on-cold-load.md`와 충돌 없이 현재 식별자 Grep 결과가 0-hit가 되면 "전체 방어 완료" 명시

> T3 해당 없음: 재현용 자동 테스트 인프라 없이 타입 선언/컴포넌트 정합성만 수정한다. `npm run check`/`npm run build`와 Phase R Grep 결과로 대체한다.

> T4 해당 없음: `tests/**/*e2e*`, `tests/**/*integration*` Glob 결과 0건 확인.

> T5 해당 없음: `tests/**/*http*`, `tests/**/*api*` Glob 결과 0건 확인.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] `npm run check` 재실행 (main 머지 후 0 errors 재확인)
   - [ ] `npm run build` 재실행 (main 머지 후 빌드 성공 재확인)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:`)

---

*상태: 검토완료 | 진행률: 0/15 (0%)*
