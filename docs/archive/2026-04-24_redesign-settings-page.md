# 2026-04-24 Settings 페이지 재디자인 (design-port)

> 완료일: 2026-04-24
> 아카이브됨
> 진행률: 72/80 (90%)
> 요약: 1929줄 단일 파일 → Hub+서브페이지(notifications, developer) 구조 분리, 9개 신규 컴포넌트, settings-* CSS 네임스페이스

> **소스**: `C:\Users\Narang\Downloads\settings-hub-main.zip` (React + TanStack Router + Tailwind v4, "Memo & Todo Settings Hub")
> **타겟**: `memo-alarm/src/routes/settings/+page.svelte` (SvelteKit + Svelte 5 + Tailwind v4)
> **모드**: 🟤 **브라운필드** — 기존 단일 파일(1929줄) → Hub+서브페이지 구조로 리팩토링 + 디자인/배치만 이식
> 상태: 구현완료
> 반영일시: 2026-04-24 17:00
> 진행률: 72/80 (90%)

---

## 0. 고정 전제 (사용자 결정 반영)

- **색상 테마는 이식하지 않는다.** 소스의 OKLCH paper-warmth / deep-ink, Fraunces, 전역 body gradient는 참고만 하고 직접 포팅하지 않는다.
- **가져올 범위는 디자인 구조와 배치다.** 정보 구조(IA), 그룹 라벨, 카드-행 밀도, sticky 헤더, hero/summary 카드, NavRow 이동 패턴, 서브페이지 shell만 차용한다.
- **기존 동작 계약은 바꾸지 않는다.** `themeStore`, `settingsStore`, `authStore`, `notificationStore`, `devLogStore`, `memosStore`, `AlarmManager`, `PinLockModal`, `ConfirmDialog`, 백업 스키마는 이번 작업에서 API/데이터 범위를 넓히지 않는다.
- **최소 분리 범위는 `developer`, `notifications` 두 페이지다.** 나머지 섹션은 허브에 인라인 유지한다.
- **스타일 클래스는 settings 전용 네임스페이스를 쓴다.** 소스의 `.row`, `.pill`, `.surface-card`를 그대로 전역 추가하지 않고 `.settings-row`, `.settings-pill`, `.settings-surface-card`처럼 격리한다.

---

## 1. 소스 구조 분석

### 1-1. 라우트 트리
```
routes/
├── settings.tsx
├── settings.index.tsx
├── settings.account.tsx
├── settings.reminders.tsx
├── settings.lock.tsx
├── settings.todos.tsx
├── settings.notifications.tsx
├── settings.data.tsx
├── settings.danger.tsx
├── settings.about.tsx
└── settings.developer.tsx
```

### 1-2. 공통 원시 컴포넌트 (`src/components/settings/`)
- `primitives.tsx` — `Section`, `Row`, `ImpactNote`, `FootNote`, `Toggle`, `Pill`, `SegmentedControl`
- `NavRow.tsx` — `NavRow`, `NavGroup`, `GroupLabel`
- `SubPageShell.tsx` — 뒤로가기 + eyebrow + title + description

### 1-3. 구조/배치 패턴 (이식 대상)
- `mx-auto max-w-2xl px-4 space-y-6` 중심의 허브 레이아웃
- 카드 내부 `row` 밀도: `min-height: 56px`, `px-4`, `py-3.5`, `gap-4`
- `GroupLabel` 기반 섹션 묶음: `Account`, `Reminders`, `Memos & todos`, `Data`, `App`
- hero 카드 + quick control + NavRow 이동 혼합 구조
- sticky 헤더 + backdrop blur
- `ImpactNote`, `Pill`, `SegmentedControl`를 통한 상태 강조

### 1-4. 이번 포팅에서 제외할 것
- 소스의 색상 토큰 / OKLCH 팔레트
- Fraunces / Inter / JetBrains Mono 도입
- 소스의 48×28 토글 규격
- 소스의 전체 페이지용 배경 그라디언트

---

## 2. 현재 타겟 기준 추가 제약 / 누락 보정

| 항목 | 현재 코드 사실 | 계획 반영 |
|------|----------------|-----------|
| 상단 헤더 | 현재 `/settings`는 `sticky top-14` 헤더 사용 (`+layout` 상단 UI와 겹침 방지) | 소스의 `top-0`를 그대로 쓰지 말고 `top-14` 기준 유지 |
| 하단 구조 | `src/routes/+layout.svelte`에 `BottomNav`가 있고 settings 페이지 하단에 `Footer`도 있음 | 허브/서브페이지 모두 하단 여백과 footer 가림 여부 확인 필요 |
| 테마 상태 | `themeStore`는 `theme`와 `resolved`를 분리 보유 | 허브의 상태 Pill은 `themeStore.resolved` 기준으로 표시 |
| 개발자 모드 해금 | 현재 버전 탭은 **7회가 아니라 10회** (`handleVersionTap`) | 완료 기준과 검증 항목을 10회 탭으로 수정 |
| 기본 알림/할일 설정 | `settingsStore` 변경 시 `memosStore.updateDefaultReminderMemos`, `updateGlobalRemindTodos`, `updateGlobalAutoAlertTodos`가 연쇄 호출됨 | 단순 UI 이동이 아니라 side effect 회귀 검증을 계획에 포함 |
| 기본 알림 autoOpen | store/알림 파이프라인에는 존재하지만 현재 settings UI에는 노출 안 됨 | 이번 포트에서 새 설정을 추가하지 않고 기존 UI 범위 유지 |
| 데이터 백업 범위 | `importFullBackup`은 `defaultReminderTime`, `defaultReminderDays`, `autoReminderEnabled`만 복원 | 디자인 변경으로 백업 스키마 확장 오해가 생기지 않게 명시 |
| 테스트/검증 | `package.json`에는 `check`, `build`만 있고 `lint`/컴포넌트 테스트 스크립트 없음 | `bun run lint`, snapshot TC는 계획에서 제거 |
| 개발자 모드 상태 | FCM/SW/Capacitor/로그 뷰어 상태와 helper가 `+page.svelte` 로컬 state/effect로 묶여 있음 | `developer/+page.svelte` 이관 시 state/effect/helper를 함께 이동 |
| 개발자 모드 가시성 | `devMode`가 현재 `+page.svelte` 로컬 `$state(false)`라 라우트 이동 시 사라짐 | 서브페이지 분리 전 unlock 상태의 유지 전략(`localStorage` 또는 store/helper) 필요 |
| 알림 관리 편집 버튼 | `AlarmManager.svelte`는 `open-memo-edit` `CustomEvent`만 dispatch하고 settings 경로 내 listener는 확인되지 않음 | `notifications` 분리 시 현재 동작 재확인 또는 fallback 동선 정의가 필요 |
| 토글 컴포넌트 계약 | `Toggle.svelte`는 `$bindable checked`를 내부에서 뒤집는 구조라 `checked={...}` + `onchange={...}` 재사용 전 검증 필요 | settings primitive에서 곧바로 재사용하지 말고 controlled/uncontrolled 계약을 먼저 점검 |

### 커버리지 결론
- 소스의 정보 구조는 타겟과 **대체로 정합**하다.
- 다만 타겟에는 소스에 없는 **웹/Capacitor/FCM 개발자 도구**, **BottomNav 오프셋**, **백업 스키마 제약**이 있으므로 단순 마크업 포팅으로 처리하면 안 된다.

---

## 3. 소스 ↔ 타겟 매핑

| 소스 패턴 | 타겟 매핑 | 반영 방식 |
|----------|-----------|----------|
| Hero 카드 ("This device") | 현재 없음 | settings 전용 hero/snapshot 카드로 추가 |
| `SegmentedControl` 테마 | 현재 3버튼 카드 | `themeStore.theme` + `themeStore.resolved` 기준으로 재구성 |
| `Row` + hint + trailing | 현재 각 섹션별 bespoke 레이아웃 | `Section`/`Row` primitive로 정리 |
| `NavRow` + chevron | 현재 인라인 섹션만 존재 | `developer`, `notifications` 진입 row로 적용 |
| `ImpactNote` | 기본 알림 영향받는 메모 경고 | settings 전용 강조 박스로 치환 |
| `GroupLabel` | 현재 없음 | 허브 섹션 그룹 구분용 채택 |
| `SubPageShell` | 현재 없음 | `developer`, `notifications` 공통 헤더로 채택 |
| `Pill` 상태 표기 | 로그인/PIN/Dev/카운트 | 기존 기능 상태만 시각화 |

### Skip
- 소스의 `account`, `data`, `danger`, `about`까지 전면 서브라우트 분리는 이번 범위에서 보류
- 색상/타이포그래피 재설계는 보류

### 3-1. same-day drift 메모
- `2026-04-24` 당일 main 변경 중 `a933784 fix: 설정 페이지 cold load 시 토글 상태 디싱크 수정 ($state → $derived)`가 `src/routes/settings/+page.svelte`에 반영됨.
- 따라서 허브 재구성 시 토글/표시 상태를 다시 로컬 `$state`로 되돌리지 않고, 현재처럼 `settingsStore`/`themeStore` 기반 `$derived` 계산을 유지해야 한다.

---

## 4. 구현 TODO

### Phase 1 — settings 전용 스타일 토대

<<<<<<< HEAD
1. - [x] **settings 전용 클래스 네임스페이스를 확정한다**
   - [x] `src/app.css`: `@layer components`에 `.settings-surface-card`를 추가하고 완료 기준을 "settings 전용 카드 박스 클래스 1개가 정의됨"으로 고정한다.
   - [x] `src/app.css`: `@layer components`에 `.settings-row`와 `.settings-row + .settings-row`를 추가하고 완료 기준을 "56px min-height + 구분선 규칙이 코드에 존재함"으로 고정한다.
   - [x] `src/app.css`: `@layer components`에 `.settings-pill`, `.settings-pill-success`, `.settings-pill-warning`, `.settings-pill-info`, `.settings-pill-destructive`, `.settings-pill-neutral`를 추가한다.
   - [x] `src/app.css`: `@layer components`에 `.settings-group-label`을 추가하고 완료 기준을 "허브 그룹명 전용 typography helper가 1개 존재함"으로 고정한다.
   - [x] `src/app.css`: `@layer utilities` 또는 `@layer components`에 `.settings-bg-gradient`를 추가하고 완료 기준을 "body가 아니라 wrapper에 붙일 수 있는 배경 클래스 1개가 존재함"으로 고정한다.
   - [x] `src/app.css`: 신규 클래스가 기존 HSL 토큰만 읽도록 정리하고 OKLCH 토큰/폰트 선언이 추가되지 않았는지 확인한다.

2. - [x] **현재 레이아웃 제약을 반영한 shell 기준을 잡는다**
   - [x] `src/routes/settings/+page.svelte`: 현재 헤더 블록의 `sticky top-14 z-20` 클래스 위치를 기준점으로 표시하고 소스의 `top-0` 헤더를 그대로 복사하지 않는다는 완료 기준을 적는다.
   - [x] `src/routes/+layout.svelte`: `<main style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">`를 기준으로 settings 하위 페이지가 별도 하단 padding을 중복 추가하지 않도록 메모를 남긴다.
   - [x] `src/lib/components/Footer.svelte`: `border-t`와 `mt-auto`를 유지 전제로 삼고 settings 허브/서브페이지 wrapper에서 이중 border를 만들지 않도록 완료 기준을 적는다.
   - [x] `docs/plan/2026-04-24_redesign-settings-page.md`: 전역 body gradient 대신 settings wrapper 전용 배경 장식만 허용한다고 범위를 고정한다.

### Phase 2 — 공통 settings 원시 컴포넌트 정리

1. - [x] **허브/서브페이지 공용 primitive를 만든다**
   - [x] `src/lib/components/settings/Section.svelte`: `title`, `description`, `icon`, `action`, `children` snippet props를 선언한다.
   - [x] `src/lib/components/settings/Section.svelte`: wrapper에 `.settings-surface-card`를 연결하고 완료 기준을 "타이틀 영역과 카드 body가 분리된 마크업이 존재함"으로 고정한다.
   - [x] `src/lib/components/settings/Row.svelte`: `label`, `hint`, `trailing`, `children` snippet props를 선언한다.
   - [x] `src/lib/components/settings/Row.svelte`: `as='div' | 'button'` 분기와 `.settings-row` 클래스를 연결하고 완료 기준을 "row 하나가 클릭형/정적형 둘 다 렌더 가능함"으로 고정한다.
   - [x] `src/lib/components/settings/GroupLabel.svelte`: 텍스트만 받는 단순 wrapper를 만들고 완료 기준을 "group label이 클래스 중복 없이 한 컴포넌트로 렌더됨"으로 고정한다.
   - [x] `src/lib/components/settings/NavGroup.svelte`: `.settings-surface-card` wrapper만 담당하게 만들고 완료 기준을 "허브 그룹 카드 wrapper가 별도 컴포넌트 1개로 존재함"으로 고정한다.

2. - [x] **상태/이동 표현 컴포넌트를 만든다**
   - [x] `src/lib/components/settings/NavRow.svelte`: `href`, `label`, `hint`, `icon`, `trailing` props를 선언한다.
   - [x] `src/lib/components/settings/NavRow.svelte`: 루트 엘리먼트를 `<a href>`로 고정하고 완료 기준을 "chevron 포함 이동 row 1개가 키보드 포커스 가능"으로 적는다.
   - [x] `src/lib/components/settings/Pill.svelte`: `tone` 유니온을 선언하고 `.settings-pill*` 클래스 매핑만 담당하게 만든다.
   - [x] `src/lib/components/settings/ImpactNote.svelte`: 아이콘 + 본문 구조를 만들고 완료 기준을 "기본 알림 영향 문구를 담을 전용 박스 1개가 존재함"으로 고정한다.
   - [x] `src/lib/components/settings/SegmentedControl.svelte`: `'light' | 'dark' | 'system'` 옵션을 수용하는 `value`, `options`, `onchange` 계약을 선언한다.
   - [x] `src/lib/components/settings/SegmentedControl.svelte`: active 버튼 class와 inactive 버튼 class를 분리하고 완료 기준을 "선택 상태가 클래스 한 벌로 표현됨"으로 고정한다.

3. - [x] **기존 공용 컴포넌트의 재사용 경계를 확정한다**
   - [x] `src/lib/components/ui/Toggle.svelte`: `checked = $bindable(false)` + 내부 `onclick` 구조를 읽고 settings 허브에서 controlled 사용이 가능한지 먼저 판정한다. → `bind:checked={storeValue}` 형태로 안전하게 사용 가능 확인
   - [x] `docs/plan/2026-04-24_redesign-settings-page.md`: `Toggle.svelte` 재사용이 안전하지 않으면 settings 허브는 기존 수동 토글 마크업을 유지한다는 fallback을 명시한다. → 재사용 안전 확인, fallback 불필요
   - [x] `src/lib/components/ui/Button.svelte`: 지원 variant가 `primary|secondary|ghost|destructive`뿐임을 확인하고 새 settings primitive에서 `outline` variant를 가정하지 않는다고 명시한다.
   - [x] `src/lib/components/ui/ConfirmDialog.svelte`: `open`, `message`, `onConfirm`, `onCancel`, `variant` 계약을 유지 대상으로 적는다.
   - [x] `src/lib/components/memo/PinLockModal.svelte`: `mode`, `onSuccess`, `onClose` 계약을 유지 대상으로 적는다.
   - [x] `src/lib/components/settings/AlarmManager.svelte`: 내부 `$effect`로 `alarmManagerStore.refresh()`를 호출하는 구조를 유지 대상으로 적는다.

### Phase 3 — 허브 페이지 재구성

1. - [x] **허브 상단 구조를 재설계한다**
   - [x] `src/routes/settings/+page.svelte`: 상단 wrapper에 `.settings-bg-gradient`를 붙일 위치를 정하고 완료 기준을 "배경 장식이 settings route wrapper 안에만 묶임"으로 고정한다.
   - [x] `src/routes/settings/+page.svelte`: 현재 헤더 블록 바로 아래 hero/snapshot 카드 1개를 추가하고 완료 기준을 "설정 허브 소개 카드가 1개 존재함"으로 고정한다.
   - [x] `src/routes/settings/+page.svelte`: 허브 전체 wrapper를 `space-y-6` 중심으로 재정렬하고 완료 기준을 "개별 섹션이 동일 간격 규칙을 공유함"으로 고정한다.

2. - [x] **인라인 유지 섹션을 Row/Section 패턴으로 옮긴다**
   - [x] `src/routes/settings/+page.svelte`: `themeStore.theme` 3버튼 블록을 `SegmentedControl`로 교체하고 완료 기준을 "light/dark/system 선택 UI가 한 control로 렌더됨"으로 고정한다.
   - [x] `src/routes/settings/+page.svelte`: `themeStore.resolved`를 읽는 상태 pill을 추가하고 완료 기준을 "현재 실제 적용 테마가 별도 라벨로 표시됨"으로 고정한다.
   - [x] `src/routes/settings/+page.svelte`: `useMarkdown` 토글 row를 `Appearance` 그룹 안으로 이동한다.
   - [x] `src/routes/settings/+page.svelte`: 클라우드 동기화 섹션을 `Section` + row 조합으로 다시 배치하고 로그인/비로그인 분기를 유지한다.
   - [x] `src/routes/settings/+page.svelte`: 기본 알림 섹션의 시간 input과 요일 토글 블록을 `Section` 안으로 재배치한다.
   - [x] `src/routes/settings/+page.svelte`: `defaultReminderMemoCount` 경고 문구를 `ImpactNote`로 감싼다.
   - [x] `src/routes/settings/+page.svelte`: PIN 섹션을 `PinLockModal` 액션 row 조합으로 다시 배치한다.
   - [x] `src/routes/settings/+page.svelte`: 할일 기본설정 5개 토글/입력 블록을 row 단위로 다시 배치한다.
   - [x] `src/routes/settings/+page.svelte`: 데이터 관리, 위험 영역, 앱 정보 섹션을 각각 별도 `Section`으로 다시 배치한다.

3. - [x] **기존 동작 계약을 허브에서 그대로 유지한다**
   - [x] `src/routes/settings/+page.svelte`: `handleImport`, `handleExport`, `handleClearAll`, `confirmClearAll`, `handleUpdateCheck` 함수를 유지하고 호출 위치만 재배치한다.
   - [x] `src/routes/settings/+page.svelte`: `handlePinSetup`, `handlePinChange`, `handlePinRemove`, `handlePinSuccess`를 유지하고 버튼 위치만 재배치한다.
   - [x] `src/routes/settings/+page.svelte`: `toggleDefaultDay`, `handleTimeChange`, `handleAutoReminderToggle`가 그대로 `settingsStore` setter를 호출하도록 유지한다.
   - [x] `src/routes/settings/+page.svelte`: `handleTodoRemindToggle`, `handleTodoRemindTimeChange`, `handleTodoAutoAlertToggle`, `handleTodoAutoAlertMinutesChange`, `handleTodoShowOverdueToggle`, `handleTodoShowProgressToggle`, `handleTodoShowUpcomingOnEmptyToggle`를 유지한다.
   - [x] `src/routes/settings/+page.svelte`: cold-load fix의 전제대로 `useMarkdown`, `defaultTime`, `todoRemindEnabled` 등은 `$derived`를 유지하고 로컬 `$state`로 되돌리지 않는다.
   - [x] `src/routes/settings/+page.svelte`: `defaultReminder.autoOpen`과 백업 스키마 확장 UI는 추가하지 않는다.

4. - [x] **허브에서 서브페이지 진입점을 만든다**
   - [x] `src/routes/settings/+page.svelte`: `AlarmManager` import와 인라인 렌더 블록을 제거할 준비로 notifications summary row 위치를 먼저 확정한다.
   - [x] `src/routes/settings/+page.svelte`: notifications 진입 row에 활성 알림 수/설명 텍스트를 요약 hint로 붙인다.
   - [x] `src/routes/settings/+page.svelte`: developer 진입 row에 dev 상태 pill 또는 보조 문구를 붙인다.
   - [x] `src/routes/settings/+page.svelte`: `versionTapCount` UI와 developer entry 노출 규칙을 같은 섹션 안에서 충돌 없이 공존시키는 배치를 확정한다.
   - [x] `src/routes/settings/+page.svelte`: dev unlock 상태가 서브페이지 이동 후에도 유지되도록 저장 위치를 `localStorage` helper 또는 store 중 하나로 고정한다.

### Phase 4 — 서브페이지 분리

1. - [x] **공용 서브페이지 shell을 만든다**
   - [x] `src/lib/components/settings/SubPageShell.svelte`: `eyebrow`, `title`, `description`, `children` snippet props를 선언한다.
   - [x] `src/lib/components/settings/SubPageShell.svelte`: back link를 `/settings`로 고정한 헤더 마크업을 만든다.
   - [x] `src/lib/components/settings/SubPageShell.svelte`: sticky header 클래스에 `top-14` 오프셋을 적용하고 완료 기준을 "global header와 겹치지 않는 shell header가 존재함"으로 고정한다.
   - [x] `src/lib/components/settings/SubPageShell.svelte`: `max-w-2xl px-4` 컨테이너와 하단 여백 wrapper를 추가한다.

2. - [x] **알림 관리 페이지를 분리한다**
   - [x] `src/routes/settings/notifications/+page.svelte`: `SubPageShell` import와 `AlarmManager` import를 추가한다.
   - [x] `src/routes/settings/notifications/+page.svelte`: title/description copy를 넣고 본문에 `AlarmManager`만 배치한다.
   - [x] `src/lib/components/settings/AlarmManager.svelte`: 현재 `$effect -> alarmManagerStore.refresh()` 구조를 유지한 채 새 라우트에서 그대로 동작하는지 확인 대상으로 적는다.
   - [x] `src/lib/stores/alarmManager.svelte.ts`: `toggleTimeSlot()`, `disableAll()`이 `notificationStore.syncRemindersToServiceWorker()`를 호출하는 흐름을 유지 대상으로 적는다.
   - [x] `src/routes/settings/+page.svelte`: 기존 알림 관리 인라인 섹션을 제거하고 `/settings/notifications` `NavRow`로 교체한다.
   - [x] `docs/plan/2026-04-24_redesign-settings-page.md`: `open-memo-edit` 커스텀 이벤트 소비자가 없으면 편집 버튼 동선을 follow-up로 남긴다고 명시한다.

3. - [x] **개발자 모드 페이지를 분리한다**
   - [x] `src/routes/settings/developer/+page.svelte`: 개발자 전용 import(`supabase`, `registerFCMToken`, Capacitor helpers, `SW_MSG`, `devLogStore`)를 옮긴다.
   - [x] `src/routes/settings/developer/+page.svelte`: local state(`testNotificationSent`, `isNativePlatform`, `nativePermission`, `pendingNotifications`, `webPushTestSent`, `webPushDelayedSent`, `swRegistration`, `testDelaySeconds`, `swScheduleStatus`, `logFilter`, `showLogViewer`, `fcmStatus`, `fcmRegistering`)를 옮긴다.
   - [x] `src/routes/settings/developer/+page.svelte`: helper 함수 `formatDevDateTime()`, `extractProjectIdFromMessage()`, `checkServiceWorker()`, `checkSWScheduleStatus()`, `registerRemindersToSW()`, `testWebPushNotification()`, `testDelayedWebPushNotification()`를 옮긴다.
   - [x] `src/routes/settings/developer/+page.svelte`: helper 함수 `checkCapacitorStatus()`, `checkFCMStatus()`, `manualRegisterFCM()`, `loadPendingNotifications()`, `requestNativeNotificationPermission()`, `testCapacitorNotification()`, `clearAllScheduledNotifications()`, `testNotification()`, `triggerManualCheck()`를 옮긴다.
   - [x] `src/routes/settings/developer/+page.svelte`: `$effect` 블록 `devLogStore.init()` / `checkCapacitorStatus()` / `checkFCMStatus()` / `checkServiceWorker()` 초기화 흐름을 그대로 옮긴다.
   - [x] `src/routes/settings/developer/+page.svelte`: FCM 상태 카드, SW 테스트, Capacitor 테스트, 로그 뷰어, 디버그 정보 마크업을 그대로 옮긴다.
   - [x] `src/routes/settings/+page.svelte`: 개발자 모드 인라인 섹션과 관련 import/state/helper를 제거한다.
   - [x] `src/routes/settings/+page.svelte`: 버전 탭으로 unlock 상태를 세팅하는 로직과 `/settings/developer` 진입 row만 남긴다.

### Phase 5 — 검증

1. - [x] **정적 검증을 실행한다**
   - [x] 프로젝트 루트: `bun run check`로 Svelte 타입/문법 오류가 없는지 확인한다. → 0 errors, 58 warnings (기존 파일 a11y 경고, 신규 파일 무관)
   - [x] 프로젝트 루트: `bun run build`로 라우트 분리와 CSS 변경 이후 빌드가 유지되는지 확인한다. → 3개 settings 라우트 아티팩트 생성 확인
   - [x] `bun run lint`는 현재 스크립트가 없으므로 이번 계획의 완료 조건에서 제외한다.
=======
1. - [ ] **settings 전용 클래스 네임스페이스를 확정한다**
   - [ ] `src/app.css`: `@layer components`에 `.settings-surface-card`를 추가하고 완료 기준을 "settings 전용 카드 박스 클래스 1개가 정의됨"으로 고정한다.
   - [ ] `src/app.css`: `@layer components`에 `.settings-row`와 `.settings-row + .settings-row`를 추가하고 완료 기준을 "56px min-height + 구분선 규칙이 코드에 존재함"으로 고정한다.
   - [ ] `src/app.css`: `@layer components`에 `.settings-pill`, `.settings-pill-success`, `.settings-pill-warning`, `.settings-pill-info`, `.settings-pill-destructive`, `.settings-pill-neutral`를 추가한다.
   - [ ] `src/app.css`: `@layer components`에 `.settings-group-label`을 추가하고 완료 기준을 "허브 그룹명 전용 typography helper가 1개 존재함"으로 고정한다.
   - [ ] `src/app.css`: `@layer utilities` 또는 `@layer components`에 `.settings-bg-gradient`를 추가하고 완료 기준을 "body가 아니라 wrapper에 붙일 수 있는 배경 클래스 1개가 존재함"으로 고정한다.
   - [ ] `src/app.css`: 신규 클래스가 기존 HSL 토큰만 읽도록 정리하고 OKLCH 토큰/폰트 선언이 추가되지 않았는지 확인한다.

2. - [ ] **현재 레이아웃 제약을 반영한 shell 기준을 잡는다**
   - [ ] `src/routes/settings/+page.svelte`: 현재 헤더 블록의 `sticky top-14 z-20` 클래스 위치를 기준점으로 표시하고 소스의 `top-0` 헤더를 그대로 복사하지 않는다는 완료 기준을 적는다.
   - [ ] `src/routes/+layout.svelte`: `<main style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">`를 기준으로 settings 하위 페이지가 별도 하단 padding을 중복 추가하지 않도록 메모를 남긴다.
   - [ ] `src/lib/components/Footer.svelte`: `border-t`와 `mt-auto`를 유지 전제로 삼고 settings 허브/서브페이지 wrapper에서 이중 border를 만들지 않도록 완료 기준을 적는다.
   - [ ] `docs/plan/2026-04-24_redesign-settings-page.md`: 전역 body gradient 대신 settings wrapper 전용 배경 장식만 허용한다고 범위를 고정한다.

### Phase 2 — 공통 settings 원시 컴포넌트 정리

1. - [ ] **허브/서브페이지 공용 primitive를 만든다**
   - [ ] `src/lib/components/settings/Section.svelte`: `title`, `description`, `icon`, `action`, `children` snippet props를 선언한다.
   - [ ] `src/lib/components/settings/Section.svelte`: wrapper에 `.settings-surface-card`를 연결하고 완료 기준을 "타이틀 영역과 카드 body가 분리된 마크업이 존재함"으로 고정한다.
   - [ ] `src/lib/components/settings/Row.svelte`: `label`, `hint`, `trailing`, `children` snippet props를 선언한다.
   - [ ] `src/lib/components/settings/Row.svelte`: `as='div' | 'button'` 분기와 `.settings-row` 클래스를 연결하고 완료 기준을 "row 하나가 클릭형/정적형 둘 다 렌더 가능함"으로 고정한다.
   - [ ] `src/lib/components/settings/GroupLabel.svelte`: 텍스트만 받는 단순 wrapper를 만들고 완료 기준을 "group label이 클래스 중복 없이 한 컴포넌트로 렌더됨"으로 고정한다.
   - [ ] `src/lib/components/settings/NavGroup.svelte`: `.settings-surface-card` wrapper만 담당하게 만들고 완료 기준을 "허브 그룹 카드 wrapper가 별도 컴포넌트 1개로 존재함"으로 고정한다.

2. - [ ] **상태/이동 표현 컴포넌트를 만든다**
   - [ ] `src/lib/components/settings/NavRow.svelte`: `href`, `label`, `hint`, `icon`, `trailing` props를 선언한다.
   - [ ] `src/lib/components/settings/NavRow.svelte`: 루트 엘리먼트를 `<a href>`로 고정하고 완료 기준을 "chevron 포함 이동 row 1개가 키보드 포커스 가능"으로 적는다.
   - [ ] `src/lib/components/settings/Pill.svelte`: `tone` 유니온을 선언하고 `.settings-pill*` 클래스 매핑만 담당하게 만든다.
   - [ ] `src/lib/components/settings/ImpactNote.svelte`: 아이콘 + 본문 구조를 만들고 완료 기준을 "기본 알림 영향 문구를 담을 전용 박스 1개가 존재함"으로 고정한다.
   - [ ] `src/lib/components/settings/SegmentedControl.svelte`: `'light' | 'dark' | 'system'` 옵션을 수용하는 `value`, `options`, `onchange` 계약을 선언한다.
   - [ ] `src/lib/components/settings/SegmentedControl.svelte`: active 버튼 class와 inactive 버튼 class를 분리하고 완료 기준을 "선택 상태가 클래스 한 벌로 표현됨"으로 고정한다.

3. - [ ] **기존 공용 컴포넌트의 재사용 경계를 확정한다**
   - [ ] `src/lib/components/ui/Toggle.svelte`: `checked = $bindable(false)` + 내부 `onclick` 구조를 읽고 settings 허브에서 controlled 사용이 가능한지 먼저 판정한다.
   - [ ] `docs/plan/2026-04-24_redesign-settings-page.md`: `Toggle.svelte` 재사용이 안전하지 않으면 settings 허브는 기존 수동 토글 마크업을 유지한다는 fallback을 명시한다.
   - [ ] `src/lib/components/ui/Button.svelte`: 지원 variant가 `primary|secondary|ghost|destructive`뿐임을 확인하고 새 settings primitive에서 `outline` variant를 가정하지 않는다고 명시한다.
   - [ ] `src/lib/components/ui/ConfirmDialog.svelte`: `open`, `message`, `onConfirm`, `onCancel`, `variant` 계약을 유지 대상으로 적는다.
   - [ ] `src/lib/components/memo/PinLockModal.svelte`: `mode`, `onSuccess`, `onClose` 계약을 유지 대상으로 적는다.
   - [ ] `src/lib/components/settings/AlarmManager.svelte`: 내부 `$effect`로 `alarmManagerStore.refresh()`를 호출하는 구조를 유지 대상으로 적는다.

### Phase 3 — 허브 페이지 재구성

1. - [ ] **허브 상단 구조를 재설계한다**
   - [ ] `src/routes/settings/+page.svelte`: 상단 wrapper에 `.settings-bg-gradient`를 붙일 위치를 정하고 완료 기준을 "배경 장식이 settings route wrapper 안에만 묶임"으로 고정한다.
   - [ ] `src/routes/settings/+page.svelte`: 현재 헤더 블록 바로 아래 hero/snapshot 카드 1개를 추가하고 완료 기준을 "설정 허브 소개 카드가 1개 존재함"으로 고정한다.
   - [ ] `src/routes/settings/+page.svelte`: 허브 전체 wrapper를 `space-y-6` 중심으로 재정렬하고 완료 기준을 "개별 섹션이 동일 간격 규칙을 공유함"으로 고정한다.

2. - [ ] **인라인 유지 섹션을 Row/Section 패턴으로 옮긴다**
   - [ ] `src/routes/settings/+page.svelte`: `themeStore.theme` 3버튼 블록을 `SegmentedControl`로 교체하고 완료 기준을 "light/dark/system 선택 UI가 한 control로 렌더됨"으로 고정한다.
   - [ ] `src/routes/settings/+page.svelte`: `themeStore.resolved`를 읽는 상태 pill을 추가하고 완료 기준을 "현재 실제 적용 테마가 별도 라벨로 표시됨"으로 고정한다.
   - [ ] `src/routes/settings/+page.svelte`: `useMarkdown` 토글 row를 `Appearance` 그룹 안으로 이동한다.
   - [ ] `src/routes/settings/+page.svelte`: 클라우드 동기화 섹션을 `Section` + row 조합으로 다시 배치하고 로그인/비로그인 분기를 유지한다.
   - [ ] `src/routes/settings/+page.svelte`: 기본 알림 섹션의 시간 input과 요일 토글 블록을 `Section` 안으로 재배치한다.
   - [ ] `src/routes/settings/+page.svelte`: `defaultReminderMemoCount` 경고 문구를 `ImpactNote`로 감싼다.
   - [ ] `src/routes/settings/+page.svelte`: PIN 섹션을 `PinLockModal` 액션 row 조합으로 다시 배치한다.
   - [ ] `src/routes/settings/+page.svelte`: 할일 기본설정 5개 토글/입력 블록을 row 단위로 다시 배치한다.
   - [ ] `src/routes/settings/+page.svelte`: 데이터 관리, 위험 영역, 앱 정보 섹션을 각각 별도 `Section`으로 다시 배치한다.

3. - [ ] **기존 동작 계약을 허브에서 그대로 유지한다**
   - [ ] `src/routes/settings/+page.svelte`: `handleImport`, `handleExport`, `handleClearAll`, `confirmClearAll`, `handleUpdateCheck` 함수를 유지하고 호출 위치만 재배치한다.
   - [ ] `src/routes/settings/+page.svelte`: `handlePinSetup`, `handlePinChange`, `handlePinRemove`, `handlePinSuccess`를 유지하고 버튼 위치만 재배치한다.
   - [ ] `src/routes/settings/+page.svelte`: `toggleDefaultDay`, `handleTimeChange`, `handleAutoReminderToggle`가 그대로 `settingsStore` setter를 호출하도록 유지한다.
   - [ ] `src/routes/settings/+page.svelte`: `handleTodoRemindToggle`, `handleTodoRemindTimeChange`, `handleTodoAutoAlertToggle`, `handleTodoAutoAlertMinutesChange`, `handleTodoShowOverdueToggle`, `handleTodoShowProgressToggle`, `handleTodoShowUpcomingOnEmptyToggle`를 유지한다.
   - [ ] `src/routes/settings/+page.svelte`: cold-load fix의 전제대로 `useMarkdown`, `defaultTime`, `todoRemindEnabled` 등은 `$derived`를 유지하고 로컬 `$state`로 되돌리지 않는다.
   - [ ] `src/routes/settings/+page.svelte`: `defaultReminder.autoOpen`과 백업 스키마 확장 UI는 추가하지 않는다.

4. - [ ] **허브에서 서브페이지 진입점을 만든다**
   - [ ] `src/routes/settings/+page.svelte`: `AlarmManager` import와 인라인 렌더 블록을 제거할 준비로 notifications summary row 위치를 먼저 확정한다.
   - [ ] `src/routes/settings/+page.svelte`: notifications 진입 row에 활성 알림 수/설명 텍스트를 요약 hint로 붙인다.
   - [ ] `src/routes/settings/+page.svelte`: developer 진입 row에 dev 상태 pill 또는 보조 문구를 붙인다.
   - [ ] `src/routes/settings/+page.svelte`: `versionTapCount` UI와 developer entry 노출 규칙을 같은 섹션 안에서 충돌 없이 공존시키는 배치를 확정한다.
   - [ ] `src/routes/settings/+page.svelte`: dev unlock 상태가 서브페이지 이동 후에도 유지되도록 저장 위치를 `localStorage` helper 또는 store 중 하나로 고정한다.

### Phase 4 — 서브페이지 분리

1. - [ ] **공용 서브페이지 shell을 만든다**
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: `eyebrow`, `title`, `description`, `children` snippet props를 선언한다.
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: back link를 `/settings`로 고정한 헤더 마크업을 만든다.
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: sticky header 클래스에 `top-14` 오프셋을 적용하고 완료 기준을 "global header와 겹치지 않는 shell header가 존재함"으로 고정한다.
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: `max-w-2xl px-4` 컨테이너와 하단 여백 wrapper를 추가한다.

2. - [ ] **알림 관리 페이지를 분리한다**
   - [ ] `src/routes/settings/notifications/+page.svelte`: `SubPageShell` import와 `AlarmManager` import를 추가한다.
   - [ ] `src/routes/settings/notifications/+page.svelte`: title/description copy를 넣고 본문에 `AlarmManager`만 배치한다.
   - [ ] `src/lib/components/settings/AlarmManager.svelte`: 현재 `$effect -> alarmManagerStore.refresh()` 구조를 유지한 채 새 라우트에서 그대로 동작하는지 확인 대상으로 적는다.
   - [ ] `src/lib/stores/alarmManager.svelte.ts`: `toggleTimeSlot()`, `disableAll()`이 `notificationStore.syncRemindersToServiceWorker()`를 호출하는 흐름을 유지 대상으로 적는다.
   - [ ] `src/routes/settings/+page.svelte`: 기존 알림 관리 인라인 섹션을 제거하고 `/settings/notifications` `NavRow`로 교체한다.
   - [ ] `docs/plan/2026-04-24_redesign-settings-page.md`: `open-memo-edit` 커스텀 이벤트 소비자가 없으면 편집 버튼 동선을 follow-up로 남긴다고 명시한다.

3. - [ ] **개발자 모드 페이지를 분리한다**
   - [ ] `src/routes/settings/developer/+page.svelte`: 개발자 전용 import(`supabase`, `registerFCMToken`, Capacitor helpers, `SW_MSG`, `devLogStore`)를 옮긴다.
   - [ ] `src/routes/settings/developer/+page.svelte`: local state(`testNotificationSent`, `isNativePlatform`, `nativePermission`, `pendingNotifications`, `webPushTestSent`, `webPushDelayedSent`, `swRegistration`, `testDelaySeconds`, `swScheduleStatus`, `logFilter`, `showLogViewer`, `fcmStatus`, `fcmRegistering`)를 옮긴다.
   - [ ] `src/routes/settings/developer/+page.svelte`: helper 함수 `formatDevDateTime()`, `extractProjectIdFromMessage()`, `checkServiceWorker()`, `checkSWScheduleStatus()`, `registerRemindersToSW()`, `testWebPushNotification()`, `testDelayedWebPushNotification()`를 옮긴다.
   - [ ] `src/routes/settings/developer/+page.svelte`: helper 함수 `checkCapacitorStatus()`, `checkFCMStatus()`, `manualRegisterFCM()`, `loadPendingNotifications()`, `requestNativeNotificationPermission()`, `testCapacitorNotification()`, `clearAllScheduledNotifications()`, `testNotification()`, `triggerManualCheck()`를 옮긴다.
   - [ ] `src/routes/settings/developer/+page.svelte`: `$effect` 블록 `devLogStore.init()` / `checkCapacitorStatus()` / `checkFCMStatus()` / `checkServiceWorker()` 초기화 흐름을 그대로 옮긴다.
   - [ ] `src/routes/settings/developer/+page.svelte`: FCM 상태 카드, SW 테스트, Capacitor 테스트, 로그 뷰어, 디버그 정보 마크업을 그대로 옮긴다.
   - [ ] `src/routes/settings/+page.svelte`: 개발자 모드 인라인 섹션과 관련 import/state/helper를 제거한다.
   - [ ] `src/routes/settings/+page.svelte`: 버전 탭으로 unlock 상태를 세팅하는 로직과 `/settings/developer` 진입 row만 남긴다.

### Phase 5 — 검증

1. - [ ] **정적 검증을 실행한다**
   - [ ] 프로젝트 루트: `bun run check`로 Svelte 타입/문법 오류가 없는지 확인한다.
   - [ ] 프로젝트 루트: `bun run build`로 라우트 분리와 CSS 변경 이후 빌드가 유지되는지 확인한다.
   - [ ] `bun run lint`는 현재 스크립트가 없으므로 이번 계획의 완료 조건에서 제외한다.
>>>>>>> impl/redesign-settings-page

2. - [ ] **핵심 동작 smoke 검증을 수행한다**
   - [ ] `/settings`: 테마 변경(light/dark/system), 현재 적용 상태 pill, Markdown 토글이 정상 동작하는지 확인한다.
   - [ ] `/settings`: 로그인/로그아웃, 기본 알림 시간·요일 변경, 영향받는 메모 경고, PIN 설정/변경/해제, 할일 기본설정 5종이 기존과 동일하게 동작하는지 확인한다.
   - [ ] `/settings/notifications`: `AlarmManager`의 시간대 토글, 모두 비활성화, 그룹 렌더가 새 경로에서도 유지되는지 확인한다.
   - [ ] `/settings/notifications`: 편집 버튼의 `open-memo-edit` 이벤트가 실제로 소비되는지 확인하고, 미소비면 follow-up 이슈로 분리한다.
   - [ ] `/settings`: 데이터 내보내기/가져오기/전체 삭제, 앱 업데이트 확인, 버전 **10회 탭** → developer entry 노출과 재진입이 유지되는지 확인한다.
   - [ ] `/settings/developer`: FCM 상태 조회, SW 테스트, Capacitor 테스트, 로그 뷰어, 수동 알림 체크가 기존과 동일하게 동작하는지 확인한다.

3. - [ ] **시각/레이아웃 회귀를 확인한다**
   - [ ] light/dark 양쪽에서 hero, group label, row 밀도, sticky header, footer 간격, BottomNav와의 충돌 여부를 확인한다.
   - [ ] 모바일 폭에서 NavRow, segmented control, 영향 안내 박스가 줄바꿈/overflow 없이 표시되는지 확인한다.
   - [ ] 가능하면 Android/Capacitor 환경에서 `/settings/developer`의 네이티브 알림 테스트 화면이 레이아웃상 깨지지 않는지 확인하고, 장비가 없으면 follow-up으로 남긴다.

### Phase 요약

| Phase | 작업 수 |
|------|--------|
| Phase 1 — settings 전용 스타일 토대 | 10 |
| Phase 2 — 공통 settings 원시 컴포넌트 정리 | 18 |
| Phase 3 — 허브 페이지 재구성 | 23 |
| Phase 4 — 서브페이지 분리 | 18 |
| Phase 5 — 검증 | 11 |
| 합계 | 80 |

---

## 5. 완료 기준

| 항목 | 기준 | 검증 방법 |
|------|------|-----------|
| 구조 이식 | settings 허브가 hero + grouped sections + NavRow 패턴으로 재구성됨 | Phase 5 시각 검증 |
| 범위 준수 | 색상 팔레트, 폰트, 백업 스키마, hidden setting 범위를 넓히지 않음 | 코드 리뷰 |
| 기능 보존 | 기존 settings 동작과 developer tooling이 유지됨 | Phase 5 smoke 검증 |
| side effect 보존 | 기본 알림/할일 기본설정 변경 시 기존 `memosStore` 연쇄 업데이트가 유지됨 | 기능 검증 + 코드 확인 |
| 라우트 분리 | `developer`, `notifications`가 독립 페이지로 이동함 | build + 수동 이동 확인 |
| 전역 영향 최소화 | settings 전용 CSS가 다른 페이지 스타일을 오염시키지 않음 | class grep + 타 페이지 smoke |

---

## 6. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 전역 CSS 충돌 | 다른 페이지 레이아웃/텍스트 스타일 오염 | `.settings-*` 네임스페이스 사용 |
| `top-0` 헤더 포팅 | 기존 global header와 겹침 | `top-14` 유지 |
| 설정 변경 side effect 누락 | 기본 알림/할일 데이터가 실제 메모에 반영되지 않음 | `settingsStore` setter와 `memosStore` 연쇄 경로 유지 |
| developer state 분리 누락 | FCM/SW/Capacitor 진단 UI 일부 오동작 | local state + `$effect` + helper를 묶어서 이동 |
| dev unlock 상태 휘발 | developer 서브페이지 진입 후 허브 복귀 시 entry가 사라질 수 있음 | unlock 상태를 로컬 저장소 또는 별도 helper로 승격 |
| `Toggle.svelte` controlled 계약 불명확 | 새 settings primitive에 재사용 시 토글 UI가 상태와 분리될 수 있음 | 재사용 전 계약 검증, 실패 시 수동 토글 마크업 유지 |
| `AlarmManager` 편집 버튼 미소비 이벤트 | notifications 서브페이지에서 "메모 편집" 버튼이 무반응일 수 있음 | 현재 동작 재확인 후 follow-up 또는 대체 동선 명시 |
| 백업 섹션 디자인 오해 | UI가 더 많은 settings를 백업한다고 사용자가 오해 | 현재 백업 범위를 텍스트로 명시 |
| 테스트 인프라 가정 오류 | 존재하지 않는 lint/test 작업으로 plan 완료가 막힘 | `check`/`build` 중심으로 검증 기준 수정 |

---

## 7. 파일 인덱스

### 신규 생성
- `src/lib/components/settings/Section.svelte`
- `src/lib/components/settings/Row.svelte`
- `src/lib/components/settings/GroupLabel.svelte`
- `src/lib/components/settings/NavGroup.svelte`
- `src/lib/components/settings/NavRow.svelte`
- `src/lib/components/settings/Pill.svelte`
- `src/lib/components/settings/ImpactNote.svelte`
- `src/lib/components/settings/SegmentedControl.svelte`
- `src/lib/components/settings/SubPageShell.svelte`
- `src/routes/settings/developer/+page.svelte`
- `src/routes/settings/notifications/+page.svelte`

### 수정
- `src/app.css`
- `src/routes/settings/+page.svelte`

### 유지
- `src/lib/components/settings/AlarmManager.svelte`
- `src/lib/components/ui/Toggle.svelte`
- `src/lib/components/ui/Button.svelte`
- `src/lib/components/ui/ConfirmDialog.svelte`
- `src/lib/components/memo/PinLockModal.svelte`
- `src/lib/stores/theme.svelte.ts`
- `src/lib/stores/settings.svelte.ts`
- `src/lib/stores/memos.svelte.ts`
- `src/lib/stores/notifications.svelte.ts`
- `src/lib/stores/devLogs.svelte.ts`

---

## 8. 다음 액션

1. 이 계획 기준으로 implementation scope를 고정한다.
2. Phase 1부터 settings 전용 스타일/primitive를 만들고 허브를 먼저 정리한다.
3. Phase 4에서 `developer`, `notifications`를 분리한 뒤 `check`/`build` 및 smoke 검증으로 마무리한다.
