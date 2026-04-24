# 기본알림 설정 의미 분리 및 UI 정리

> 작성일시: 2026-04-24 19:31
> 기준커밋: bfc7ff3
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/5 (0%)
> 요약: `새 메모에 자동 알림`과 `기본알림을 사용하는 기존 메모의 추종`은 서로 다른 수명주기를 가진다. 이번 계획은 두 개념의 분리를 유지하면서 설정 UI를 재구성해 혼선을 줄이고, 빠른 입력 경로의 `isDefault` 처리 불일치를 함께 정리하는 데 목적이 있다.

---

## 개요

현재 메모 앱의 기본알림 구조는 데이터 모델상으로는 이미 두 개의 의미를 분리하고 있다.

- `autoReminderOnCreate`는 새 메모 생성 시 기본알림을 자동 부여할지 결정한다.
- `reminder.isDefault`는 특정 메모의 알림이 전역 기본알림 설정을 계속 추종하는지 나타낸다.

이 구조 덕분에 사용자는 앞으로 생성할 메모에는 기본알림을 붙이지 않으면서도, 이미 기본알림을 사용 중인 메모들의 시간/요일은 계속 일괄 관리할 수 있다. 다만 설정 화면이 `autoReminderOnCreate`가 켜져 있을 때만 기본 시간/요일 편집 UI를 노출하고 있어, 실제 동작보다 더 강하게 두 개념이 묶여 보인다.

또한 빠른 메모 입력 경로는 기본알림을 붙일 때 `isDefault: true`를 명시하지 않아 일반 메모 생성 경로와 의미가 어긋날 수 있다. 이번 수정은 데이터 모델을 단순화하기보다, UI 설명과 생성 경로 일관성을 맞추는 방향으로 진행한다.

## 기술적 고려사항

- `src/lib/stores/settings.svelte.ts`의 기본알림 변경 함수들은 이미 `isDefault === true` 메모를 일괄 갱신한다. 설정 UI 노출 조건만 바꾸더라도 기존 데이터 모델은 유지 가능하다.
- `src/routes/settings/+page.svelte`는 현재 `autoReminderOnCreate`가 켜진 경우에만 기본알림 시간/요일 편집 섹션과 영향 안내 문구를 렌더링한다. 이 조건이 혼선의 주 원인이다.
- `src/lib/stores/memos.svelte.ts`와 `src/lib/components/memo/MemoForm.svelte`는 새 메모 생성 시 `isDefault: true`를 부여하지만, `src/lib/components/memo/QuickMemoInput.svelte`는 동일한 의미를 보장하지 않는다.
- `src/lib/components/memo/ReminderSettings.svelte`는 메모 편집에서 기본알림과 추가알림을 명시적으로 구분하고 있으므로, 설정 화면도 같은 개념 모델을 따라가는 편이 일관적이다.
- `src/lib/utils/reminderHelpers.ts`, `src/lib/utils/capacitor.ts`, `src/lib/stores/notifications.svelte.ts`도 `isDefault`를 분류 기준으로 사용하므로, 이번 수정이 알림 이력이나 기본/추가 분류를 흔들지 않도록 회귀 체크가 필요하다.
- 이번 작업은 알림 스케줄링 엔진 변경보다 UI, 문구, 생성 경로 정합성 보정이 핵심이므로 수동 시나리오 검증 범위를 명확히 적어야 한다.

---

## TODO

### Phase 0: Worktree 준비

0. ☐ **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 설정 의미 재정의

1. ☐ **기본알림 설정의 용도를 UI 기준으로 재정의** — 토글과 전역 기본값의 책임을 분리
   - ☐ `src/routes/settings/+page.svelte`: `새 메모에 자동 알림` 라벨/힌트를 `새 메모 생성 시 기본알림 자동 적용` 의미로 더 명확하게 바꾼다
   - ☐ `src/routes/settings/+page.svelte`: 기본 시간, 반복 요일, 영향 안내 문구는 `autoReminderOnCreate`와 무관하게 항상 보이도록 섹션 구조를 재배치한다
   - ☐ `src/routes/settings/+page.svelte`: `defaultReminderMemoCount` 기반 안내를 항상 노출하거나 `0개` 상태에 맞는 보조 문구로 분기해, 기존 기본알림 메모가 여전히 전역 설정을 따른다는 점을 드러낸다

### Phase 2: 생성 경로 일관성 보정

2. ☐ **모든 메모 생성 경로가 동일한 기본알림 의미를 갖도록 정리** — `isDefault` 누락 제거
   - ☐ `src/lib/components/memo/QuickMemoInput.svelte`: 자동알림 적용 시 `isDefault: true`와 반복 타입을 명시해 일반 생성 경로와 동일한 의미를 보장한다
   - ☐ `src/lib/stores/memos.svelte.ts`: `add()` 내부 자동알림 적용 로직과 중복 의미가 어긋나지 않는지 점검하고, 필요 시 빠른 입력이 store 경로와 같은 계약을 따르도록 정리한다
   - ☐ `src/lib/components/memo/MemoForm.svelte`: 새 메모 초기화 시 붙는 기본알림 구조가 빠른 입력과 동일한 계약을 유지하는지 확인한다

### Phase 3: 사용자 설명 및 노출 정리

3. ☐ **화면 간 설명 문구를 통일** — 사용자가 “앞으로 적용”과 “기존 메모 추종”을 구분할 수 있게 한다
   - ☐ `src/routes/settings/+page.svelte`: 기본알림 변경 영향 문구를 “기본알림을 사용하는 기존 메모” 관점으로 다시 쓴다
   - ☐ `src/lib/components/memo/ReminderCard.svelte`: 기본알림 카드의 `설정에서 수정 가능` 문구가 설정 페이지의 새 설명과 충돌하지 않는지 점검하고 필요 시 보완한다
   - ☐ `src/lib/components/memo/MemoCard.svelte`: 목록의 `기본` 뱃지가 유지될 때 사용자가 전역 추종 개념을 이해할 수 있는지 확인하고, 변경 필요 여부를 구현 단계에서 판단한다

### Phase 4: 회귀 및 수동 검증

4. ☐ **기본알림 시나리오 회귀 검증** — 구조 분리 유지 여부를 확인
   - ☐ 수동 시나리오: `새 메모 생성 시 기본알림 자동 적용`을 끈 상태에서도 기존 `isDefault: true` 메모의 시간/요일이 설정 변경을 따라가는지 검증한다
   - ☐ 수동 시나리오: 토글을 끈 상태에서 새 메모는 알림 없이 생성되고, 메모 편집에서 `기본 알림 추가`를 선택하면 전역 기본값이 붙는지 확인한다
   - ☐ 수동 시나리오: 빠른 메모 입력으로 생성한 메모가 이후 기본알림 시간 변경 시 동일하게 추종하는지 확인한다
   - ☐ `src/lib/utils/reminderHelpers.ts`, `src/lib/utils/capacitor.ts`, `src/lib/stores/notifications.svelte.ts`: 기본/추가 알림 분류와 알림 이력 기록이 `isDefault` 기준으로 기존과 동일하게 유지되는지 회귀 확인한다
   - ☐ 검증 명령: `npm run check` 또는 프로젝트 표준 정적 검사를 실행해 Svelte/TypeScript 오류가 없는지 확인한다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. ☐ **post-merge 정리 확인** — `/merge-test` owner
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `main merge 시도`를 owner step으로 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `root dirty stash/apply (if needed)`를 owner step으로 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

*상태: 초안 | 진행률: 0/5 (0%)*
