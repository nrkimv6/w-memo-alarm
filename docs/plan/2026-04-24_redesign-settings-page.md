# 2026-04-24 Settings 페이지 재디자인 (design-port)

> **소스**: `C:\Users\Narang\Downloads\settings-hub-main.zip` (React + TanStack Router + Tailwind v4, "Memo & Todo Settings Hub")
> **타겟**: `memo-alarm/src/routes/settings/+page.svelte` (SvelteKit + Svelte 5 + Tailwind v4)
> **모드**: 🟤 **브라운필드** — 기존 단일 파일(1929줄) → Hub+서브페이지 구조로 리팩토링 + 디자인/배치만 이식

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

---

## 4. 구현 TODO

### Phase 1 — settings 전용 스타일 토대

1. - [ ] **settings 전용 클래스 네임스페이스를 확정한다**
   - [ ] `src/app.css`: 소스의 `.surface-card`, `.row`, `.pill`를 그대로 복사하지 말고 `.settings-surface-card`, `.settings-row`, `.settings-pill`, `.settings-group-label`, `.settings-bg-gradient`로 추가한다.
   - [ ] `src/app.css`: 신규 스타일은 기존 HSL 토큰(`--color-card`, `--color-muted`, `--color-border`, `--color-primary`, `--color-info`)만 조합하고 OKLCH 팔레트/새 폰트는 추가하지 않는다.
   - [ ] `src/app.css`: radius/shadow helper가 필요하면 settings 전용 변수 또는 직접 값으로 한정하고 전역 `body` 배경은 건드리지 않는다.

2. - [ ] **현재 레이아웃 제약을 반영한 shell 기준을 잡는다**
   - [ ] `src/routes/settings/+page.svelte`: 현재 `sticky top-14` 헤더와 `max-w-2xl px-4 py-6` 컨테이너를 기준선으로 삼아 소스의 `top-0` 헤더를 그대로 쓰지 않도록 명시한다.
   - [ ] `src/routes/+layout.svelte`: `BottomNav`가 존재하므로 허브/서브페이지의 하단 padding, footer 간격, safe-area 가림 여부를 확인 항목으로 포함한다.
   - [ ] `docs/plan/2026-04-24_redesign-settings-page.md`: 전역 body gradient가 아니라 settings wrapper 한정 배경 장식을 쓰도록 범위를 고정한다.

### Phase 2 — 공통 settings 원시 컴포넌트 정리

1. - [ ] **허브/서브페이지 공용 primitive를 만든다**
   - [ ] `src/lib/components/settings/Section.svelte`: title / description / icon / action / children snippet을 받는 공통 섹션 컴포넌트를 만든다.
   - [ ] `src/lib/components/settings/Row.svelte`: label / hint / trailing snippet과 button/div 변형을 지원하는 row 컴포넌트를 만든다.
   - [ ] `src/lib/components/settings/GroupLabel.svelte`: 그룹 헤더용 소문자/uppercase 보조 텍스트 컴포넌트를 만든다.
   - [ ] `src/lib/components/settings/NavGroup.svelte`: 카드 래퍼 + divide-y 역할을 담당하는 그룹 컨테이너를 만든다.

2. - [ ] **상태/이동 표현 컴포넌트를 만든다**
   - [ ] `src/lib/components/settings/NavRow.svelte`: `<a href="/settings/...">` 기반으로 icon/label/hint/trailing/chevron/focus style을 포함한 이동 row를 만든다.
   - [ ] `src/lib/components/settings/Pill.svelte`: tone(`neutral|success|warning|info|destructive|accent`)에 따라 settings 전용 pill 클래스를 매핑한다.
   - [ ] `src/lib/components/settings/ImpactNote.svelte`: 기본 알림 영향 범위 같은 경고/안내 메시지 박스를 만든다.
   - [ ] `src/lib/components/settings/SegmentedControl.svelte`: `themeStore.theme`의 `'light' | 'dark' | 'system'` 값을 처리하는 제네릭 또는 유니온 기반 control을 만든다.

3. - [ ] **기존 공용 컴포넌트와의 경계를 고정한다**
   - [ ] `src/lib/components/ui/Toggle.svelte`: 기존 `toggle-switch`는 그대로 재사용하고 새로운 settings primitive는 trailing slot으로만 감싼다.
   - [ ] `src/lib/components/ui/Button.svelte`, `src/lib/components/ui/ConfirmDialog.svelte`, `src/lib/components/memo/PinLockModal.svelte`, `src/lib/components/settings/AlarmManager.svelte`: props/계약 변경 없이 조합만 바꾸는 것으로 계획 범위를 제한한다.
   - [ ] 테스트 러너 부재를 전제로 컴포넌트 unit test 대신 Phase 5의 통합 smoke 검증으로 대체한다.

### Phase 3 — 허브 페이지 재구성

1. - [ ] **허브 상단 구조를 재설계한다**
   - [ ] `src/routes/settings/+page.svelte`: 현재 헤더 아래에 settings 전용 hero/snapshot 카드를 추가하되 색상 토큰 교체 없이 spacing, hierarchy, copy만 이식한다.
   - [ ] `src/routes/settings/+page.svelte`: `Appearance`, `Account`, `Reminders`, `Memos & todos`, `Data`, `App`, `Developer` 그룹으로 섹션을 재배치한다.
   - [ ] `src/routes/settings/+page.svelte`: `Footer`는 유지하고 hub 전체 세로 간격을 `space-y-6` 중심으로 재정렬한다.

2. - [ ] **인라인 유지 섹션을 Row/Section 패턴으로 옮긴다**
   - [ ] `src/routes/settings/+page.svelte`: 테마 UI를 3버튼 카드에서 `SegmentedControl` + `themeStore.resolved` 상태 pill 조합으로 치환한다.
   - [ ] `src/routes/settings/+page.svelte`: 메모 표시 설정(`useMarkdown`), 클라우드 동기화, 메모 PIN, 할일 기본설정, 데이터 관리, 위험 영역, 앱 정보를 `Section`/`Row` 기반으로 다시 배치한다.
   - [ ] `src/routes/settings/+page.svelte`: 기본 알림 섹션의 "영향받는 메모 N개" 문구를 `ImpactNote`로 승격한다.

3. - [ ] **기존 동작 계약을 허브에서 그대로 유지한다**
   - [ ] `src/routes/settings/+page.svelte`: `handleImport`, `handleExport`, `confirmClearAll`, `handleUpdateCheck`, `handlePinSetup|Change|Remove`를 유지하고 마크업만 재배치한다.
   - [ ] `src/routes/settings/+page.svelte`: 개발자 모드 해금은 현재 코드대로 **버전 10회 탭** 조건을 유지한다.
   - [ ] `src/routes/settings/+page.svelte`: `settingsStore.setDefaultReminderTime`, `setDefaultReminderDays`, `setTodoRemindTime`, `setTodoAutoAlertMinutes`가 연쇄적으로 `memosStore`를 갱신하므로 핸들러 이름/호출 순서를 보존한다.
   - [ ] `src/routes/settings/+page.svelte`: `defaultReminder.autoOpen`이나 백업 스키마 확장처럼 범위 밖 기능 추가는 하지 않는다.

4. - [ ] **허브에서 서브페이지 진입점을 만든다**
   - [ ] `src/routes/settings/+page.svelte`: `notifications`와 `developer`는 인라인 섹션 대신 `NavRow`로 연결한다.
   - [ ] `src/routes/settings/+page.svelte`: developer entry는 현재 `devMode`가 켜졌을 때만 렌더링하고 warning pill 또는 보조 문구로 상태를 표시한다.
   - [ ] `src/routes/settings/+page.svelte`: notifications entry는 `AlarmManager`가 보여주던 정보를 요약 hint/pill(알림 수, 활성 상태 등)로 축약한다.

### Phase 4 — 서브페이지 분리

1. - [ ] **공용 서브페이지 shell을 만든다**
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: back link, eyebrow, title, description, children snippet을 받는 공통 shell을 만든다.
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: 상단 오프셋은 `top-14` 기준으로 잡아 기존 layout header와 충돌하지 않게 한다.
   - [ ] `src/lib/components/settings/SubPageShell.svelte`: 허브와 동일하게 `max-w-2xl px-4` 컨테이너와 하단 여백을 유지한다.

2. - [ ] **알림 관리 페이지를 분리한다**
   - [ ] `src/routes/settings/notifications/+page.svelte`: `AlarmManager.svelte`와 관련 안내 문구를 옮기고 `SubPageShell` 안에서 렌더링한다.
   - [ ] `src/routes/settings/notifications/+page.svelte`: 허브에서 제거된 섹션의 데이터 흐름이 `AlarmManager` 단독으로 유지되는지 확인한다.
   - [ ] `src/routes/settings/+page.svelte`: 알림 관리 섹션의 기존 인라인 마크업을 제거하고 NavRow 링크로 교체한다.

3. - [ ] **개발자 모드 페이지를 분리한다**
   - [ ] `src/routes/settings/developer/+page.svelte`: `devMode` 관련 local state(`testDelaySeconds`, `swScheduleStatus`, `fcmStatus`, `logFilter`, `showLogViewer` 등)를 함께 옮긴다.
   - [ ] `src/routes/settings/developer/+page.svelte`: `$effect` 기반 초기화(`devLogStore.init`, `checkCapacitorStatus`, `checkFCMStatus`, `checkServiceWorker`)와 helper 함수들을 분리 페이지로 이동한다.
   - [ ] `src/routes/settings/developer/+page.svelte`: Supabase 조회(`user_devices`, `alarm_schedules`, `notification_logs`), Service Worker 테스트, Capacitor 테스트, 로그 뷰어, 디버그 정보 UI를 기존 기능과 동일하게 보존한다.
   - [ ] `src/routes/settings/+page.svelte`: 개발자 모드 인라인 마크업을 제거하고 devMode 노출 조건만 유지한 채 NavRow 링크로 대체한다.

### Phase 5 — 검증

1. - [ ] **정적 검증을 실행한다**
   - [ ] 프로젝트 루트: `bun run check`로 Svelte 타입/문법 오류가 없는지 확인한다.
   - [ ] 프로젝트 루트: `bun run build`로 라우트 분리와 CSS 변경 이후 빌드가 유지되는지 확인한다.
   - [ ] `bun run lint`는 현재 스크립트가 없으므로 이번 계획의 완료 조건에서 제외한다.

2. - [ ] **핵심 동작 smoke 검증을 수행한다**
   - [ ] `/settings`: 테마 변경(light/dark/system), 현재 적용 상태 pill, Markdown 토글이 정상 동작하는지 확인한다.
   - [ ] `/settings`: 로그인/로그아웃, 기본 알림 시간·요일 변경, 영향받는 메모 경고, PIN 설정/변경/해제, 할일 기본설정 5종이 기존과 동일하게 동작하는지 확인한다.
   - [ ] `/settings/notifications`: `AlarmManager` 편집/토글/메모 진입이 깨지지 않는지 확인한다.
   - [ ] `/settings`: 데이터 내보내기/가져오기/전체 삭제, 앱 업데이트 확인, 버전 **10회 탭** → developer entry 노출이 유지되는지 확인한다.
   - [ ] `/settings/developer`: FCM 상태 조회, SW 테스트, Capacitor 테스트, 로그 뷰어, 수동 알림 체크가 기존과 동일하게 동작하는지 확인한다.

3. - [ ] **시각/레이아웃 회귀를 확인한다**
   - [ ] light/dark 양쪽에서 hero, group label, row 밀도, sticky header, footer 간격, BottomNav와의 충돌 여부를 확인한다.
   - [ ] 모바일 폭에서 NavRow, segmented control, 영향 안내 박스가 줄바꿈/overflow 없이 표시되는지 확인한다.
   - [ ] 가능하면 Android/Capacitor 환경에서 `/settings/developer`의 네이티브 알림 테스트 화면이 레이아웃상 깨지지 않는지 확인하고, 장비가 없으면 follow-up으로 남긴다.

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
