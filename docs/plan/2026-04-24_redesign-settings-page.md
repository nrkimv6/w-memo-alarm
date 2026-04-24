# 2026-04-24 Settings 페이지 재디자인 (design-port)

> **소스**: `C:\Users\Narang\Downloads\settings-hub-main.zip` (React + TanStack Router + Tailwind v4, "Memo & Todo Settings Hub")
> **타겟**: `memo-alarm/src/routes/settings/+page.svelte` (SvelteKit + Svelte 5 + Tailwind v4)
> **모드**: 🟤 **브라운필드** — 기존 단일 파일(1929줄) → Hub+서브페이지 구조로 리팩토링 + 디자인 토큰 재적용

---

## 0. 결정 사항 (2026-04-24 확정)

| # | 항목 | 결정 | 근거 |
|---|------|------|------|
| Q1 | 색상 테마 정책 | **B** — 기존 gentle-notes(HSL sage/coral) 유지, 소스의 구조 토큰만 이식 | 앱 전체 일관성. `memo-card`·`sketchy-*`·`btn-*`이 이미 고착되어 있고, OKLCH 전면 전환은 settings 외 페이지 회귀 리스크 큼 |
| Q2 | 페이지 분리 범위 | **C** — 핵심 섹션만 서브라우트 분리 (`developer`, `notifications`) | 1929줄 중 개발자 모드가 700줄+로 단일 파일 비대 주요 원인. data/danger 등은 인라인 유지가 동선상 자연스러움 |
| Q3 | 서체 | **B** — Fraunces 미도입, Noto Sans KR 유지 | 한글 타이틀 우선. 영문 headline 노출 빈도 낮음 |
| Q4 | 기존 컴포넌트 재사용 | **A 기반 + 필요한 것만 B에서 추가** — `Toggle`/`Button`/`ConfirmDialog`/`memo-card`/`btn-*` 유지, 신규로 `Section`/`Row`/`NavRow`/`Pill`/`SegmentedControl`/`ImpactNote` 추가 | 중복 구현 방지 + 허브 레이아웃 이식에 필요한 최소 원시 컴포넌트만 신설 |

### 이후 Phase 내용은 위 결정을 전제로 작성됨.

---

## 1. 소스 구조 분석

### 1-1. 라우트 트리
```
routes/
├── settings.tsx                  # <Outlet/> 레이아웃
├── settings.index.tsx            # 허브 (/settings)
├── settings.account.tsx          # 계정/클라우드 동기화
├── settings.reminders.tsx        # 기본 알림
├── settings.lock.tsx             # 메모 PIN
├── settings.todos.tsx            # 할일 기본
├── settings.notifications.tsx    # 알림 목록 관리
├── settings.data.tsx             # 백업/복원
├── settings.danger.tsx           # 위험 영역
├── settings.about.tsx            # 앱 정보
└── settings.developer.tsx        # 개발자 모드
```

### 1-2. 공통 원시 컴포넌트 (`src/components/settings/`)
- `primitives.tsx` — `Section`, `Row`, `ImpactNote`, `FootNote`, `Toggle`, `Pill`, `SegmentedControl`
- `NavRow.tsx` — `NavRow`, `NavGroup`, `GroupLabel` (허브용 링크 행)
- `SubPageShell.tsx` — 서브페이지 공통 헤더(뒤로가기 + eyebrow + title + description)

### 1-3. 디자인 토큰 (핵심)
| 카테고리 | 값 | 타겟 매핑 |
|---------|----|---------|
| **색상 정책** | OKLCH paper-warmth (light) / deep-ink (dark) | Q1=B → 이식 안 함, 기존 HSL 유지 |
| **반경** | `--radius: 0.875rem`, `--radius-2xl: 1.375rem` | 기존 `--radius-xl: 1rem` 유지, `2xl` 신설 검토 |
| **폰트** | Inter(sans) / Fraunces(display) / JetBrains Mono | Q3=B → 미도입 |
| **그림자** | `--shadow-soft`, `--shadow-pop` (color-mix 기반) | **신규 도입** (구조 토큰) |
| **배경 그라디언트** | fixed radial-gradient (accent 12% + info 10%) | **인라인, settings 페이지 한정 적용** |
| **유틸 클래스** | `.surface-card`, `.row`, `.pill` | **Svelte 컴포넌트로 이식** (app.css에 추가) |
| **헤더** | `sticky top-0 z-30 backdrop-blur-md bg-background/80` | 기존 header 공통화 검토 |
| **컨테이너** | `mx-auto max-w-2xl px-4 space-y-6` | **그대로 채택** (현재 타겟도 유사) |
| **Row min-height** | 56px, padding 0.875rem 1rem, gap 1rem | **핵심 이식 대상** |
| **GroupLabel** | `text-[11px] uppercase tracking-[0.14em]` | **채택** (섹션 그룹 명확화) |

### 1-4. 인터랙션 & 시그니처 패턴
- **NavRow**: 아이콘 박스(36×36 `rounded-xl bg-muted`) + label + hint + trailing Pill + `>` chevron
- **Pill tones**: `neutral/success/warning/info/destructive/accent` (상태 시각화)
- **SegmentedControl**: `p-1 rounded-xl bg-muted` + active `bg-surface-elevated shadow-sm`
- **ImpactNote**: 경고/영향 메시지(`bg-impact`) — 타겟의 "영향받는 메모" 경고 (line 921) 에 매핑
- **Toggle**: 48×28 rounded-full, thumb 20×20 — 기존 `toggle-switch`(40×20)와 규격 다름 → 기존 유지

---

## 2B. 전수 비교표 (소스 ↔ 기존 타겟)

| # | 소스 서브/인라인 | 타겟 섹션(라인) | 커버리지 | 비고 |
|---|-----------------|----------------|---------|------|
| 1 | Hero 배너 ("Make it yours") | 없음 | ❌ 추가 | 간단한 그라디언트 hero 도입 가능 |
| 2 | Appearance (인라인 SegmentedControl) | 테마 (L741-773) | ✅ 구조 상이 | 현재 Sun/Moon/Monitor 버튼 → SegmentedControl로 개선 |
| 3 | Markdown toggle (인라인) | 메모 표시 설정 (L994-1021) | ✅ | Appearance 섹션에 병합 검토 |
| 4 | settings.account | 클라우드 동기화 (L775-847) | ✅ | NavRow + 서브페이지 분리 검토(Q2=C이면 인라인 유지) |
| 5 | settings.reminders | 기본 알림 설정 (L849-934) | ✅ | 영향받는 메모 경고 → ImpactNote 적용 |
| 6 | settings.lock | 메모 잠금 PIN (L936-992) | ✅ | PinLockModal 기존 재사용 |
| 7 | settings.todos | 할일 기본설정 (L1023-1160) | ✅ | 5개 하위 토글 — Row로 정렬 |
| 8 | settings.notifications | 알림 관리 (L1162-1172) | ✅ | AlarmManager 컴포넌트 분리 유지 |
| 9 | settings.data | 데이터 관리 (L1174-1207) | ✅ | export/import/clear |
| 10 | settings.danger | 위험 영역 (L1209-1222) | ✅ | destructive Pill + ConfirmDialog |
| 11 | settings.about | 앱 정보 (L1224-1262) | ✅ | 버전 탭 → 개발자 모드 토글 (기존 동작) |
| 12 | settings.developer | 개발자 모드 (L1264-1927) | ✅ 비대 | **별도 라우트 분리 강력 권장** (700줄+) |
| 13 | — | PinLockModal, AlarmManager 분리 | — | 유지 |

### 커버리지 결론
- 소스의 기능 체계(Hub+11섹션)는 타겟과 **완전 정합** — 기능 누락 없음
- 타겟에만 있고 소스에 없음: **개발자 모드 전체(FCM/SW/로그 뷰어/테스트 알림)** — 포팅 시 반드시 보존
- 소스에만 있고 타겟에 없음: Hero 배너, ImpactNote, SegmentedControl 패턴, GroupLabel

---

## 3B. 심각도 분류 (이식 대상)

### 🔴 High — 구조적 개선 (사용자 체감 큼)
1. **개발자 모드 분리** — 1929→~1100줄로 축소, 빌드 파서 부하 감소
2. **섹션 그룹화 + GroupLabel** — `Account / Reminders / Memos & todos / Data / App` 그룹 헤더
3. **NavRow 패턴 도입** — 서브페이지로 이동할 항목(최소 dev, notifications, data)에 적용
4. **SegmentedControl(테마)** — 3버튼 horizontal → 통합 segmented pill
5. **ImpactNote 도입** — "영향받는 메모 N개" 경고(L921)를 명확한 박스로

### 🟡 Medium — 디자인 토큰 정리
6. **surface-card 유틸 클래스 추가** (`app.css @layer components`) — `bg-card border rounded-2xl shadow-soft`
7. **row 유틸 클래스 추가** — `flex items-center justify-between gap-4 min-h-14 px-4 py-3.5` + `row + row { border-top }`
8. **pill 유틸 클래스 추가** — tone 변형(neutral/success/warning/info/destructive/accent)
9. **그림자 토큰** — `--shadow-soft`, `--shadow-pop` 추가 (color-mix 기반)
10. **radial 배경 (settings 한정)** — `+layout.svelte` 또는 settings 페이지 wrapper에 fixed gradient

### 🟢 Low — 선택적
11. Hero 배너 ("이 기기") — 간단한 카드 추가
12. 서브페이지 SubPageShell 공통화 (Q2=A/C일 때만)
13. Fraunces 서체 도입 (Q3=A일 때만)

### ⛔ Skip (기존 유지)
- 색상 팔레트 (Q1=B)
- `memo-card`, `btn-*`, `toggle-switch`, `sketchy-*` — 앱 전체 공통
- `PinLockModal`, `AlarmManager`, `ConfirmDialog` — 동작/계약 유지

---

## 4B. 구현 TODO

### Phase 1 — 디자인 토큰 기반 (독립, 회귀 위험 낮음)
- [ ] **app.css**: `@theme`에 `--radius-2xl: 1.375rem`, `--shadow-soft`, `--shadow-pop` 추가
- [ ] **app.css**: `@layer components`에 `.surface-card`, `.row`, `.row + .row`, `.pill`, `.pill-{tone}` 추가
- [ ] **app.css**: `.settings-bg-gradient` 유틸 추가 (fixed radial, accent/info 약채도로 조정 — gentle-notes 팔레트에 맞게)
- [ ] 타겟 기존 `app.css` 값과 충돌 없는지 확인 (특히 `.row`가 프로젝트 전역 중복 여부 Grep)
- [ ] **검증**: 기존 페이지(memos/todos/stats/notifications)가 영향 없는지 `bun run check` + 눈확인

### Phase 2 — 공통 원시 컴포넌트 (Svelte 5 runes)
- [ ] `src/lib/components/settings/Section.svelte` — title/description/icon/action snippet
- [ ] `src/lib/components/settings/Row.svelte` — label/hint/trailing snippet + `onclick`
- [ ] `src/lib/components/settings/NavRow.svelte` — `href`(`<a>` with SvelteKit navigation) + icon/label/hint/trailing + chevron
- [ ] `src/lib/components/settings/NavGroup.svelte` — `.surface-card divide-y` 래퍼
- [ ] `src/lib/components/settings/GroupLabel.svelte`
- [ ] `src/lib/components/settings/Pill.svelte` — tone prop, `.pill-{tone}` 클래스 매핑
- [ ] `src/lib/components/settings/SegmentedControl.svelte` — generic value/options/onchange (svelte generics)
- [ ] `src/lib/components/settings/ImpactNote.svelte`
- [ ] **기존 `Toggle.svelte` 재사용 여부**: 기존 디자인(40×20 dashed) 유지 → Row의 trailing에 그대로 배치 (소스 48×28 미도입)
- [ ] **TC**: 각 컴포넌트 최소 렌더 테스트 (props snapshot)

### Phase 3 — Hub 페이지 (허브만 먼저)
- [ ] `src/routes/settings/+page.svelte` 허브화 — 기존 11섹션 중 **인라인 유지할 것** (테마/계정/기본알림/메모잠금/할일/데이터/위험/앱정보)과 **서브라우트 유도할 것**(Q2=C이면 **개발자 모드**, **알림 관리**만) 구분
- [ ] 섹션 그룹: `Appearance` · `Account` · `Reminders` · `Memos & todos` · `Data` · `App` · (dev-mode on일 때) `Developer`
- [ ] 각 `<section>`을 `<Section>` 컴포넌트로 치환, 제목 옆 아이콘(lucide-svelte) 추가
- [ ] 테마 선택: 3버튼 → `<SegmentedControl value={themeStore.theme} options={light/dark/system}>`
- [ ] 기본 알림 "영향받는 메모" 경고 → `<ImpactNote>`
- [ ] Pill 활용: "로그인됨"(success) / "로그아웃"(neutral) / "PIN 설정됨"(success) / "Dev"(warning) / 카운트(neutral)

### Phase 4 — 서브라우트 분리 (Q2=C 기준 최소 2개)
- [ ] `src/routes/settings/developer/+page.svelte` 신설 — 기존 L1264-1927 개발자 모드 전부 이관
- [ ] `src/routes/settings/notifications/+page.svelte` 신설 — AlarmManager + 관련 UI
- [ ] `src/lib/components/settings/SubPageShell.svelte` — 뒤로가기(`<a href="/settings">`) + eyebrow + title + description + children
- [ ] 허브의 해당 섹션 → `<NavRow href="/settings/developer">` 등으로 치환
- [ ] `authStore`/`themeStore`/`settingsStore`/`notificationStore`/`devLogStore` — 서브 페이지에서도 동일하게 import (전역 store라 문제 없음)
- [ ] **state 분리 주의**: 기존 1929줄의 `let devMode = $state(false)` 등 로컬 state 중 개발자 모드 관련 전부 `developer/+page.svelte`로 이관. 다른 섹션과 공유하는 state가 있으면 store로 승격
- [ ] Q2=A로 변경 시 나머지 7개 서브 페이지도 추가 (이 TODO는 Q2 확정 후 확장)

### Phase 5 — 검증
- [ ] `bun run check` (svelte-check) 0 에러
- [ ] `bun run lint` 통과
- [ ] 빌드: `bun run build` 성공
- [ ] 시각 검증: 각 섹션 light/dark 양쪽 스크린샷 비교 (이전 vs 이후)
- [ ] 기능 검증 체크리스트:
  - [ ] 테마 전환(light/dark/system) 즉시 반영
  - [ ] 마크다운 토글 저장/반영
  - [ ] 클라우드 로그인/로그아웃
  - [ ] 기본 알림 on/off + 시간/요일 변경
  - [ ] 메모 PIN 설정/잠금 해제
  - [ ] 할일 토글 5종
  - [ ] 알림 관리 (AlarmManager) — 서브 페이지에서 정상 동작
  - [ ] 백업 내보내기/복원/전체 삭제(ConfirmDialog)
  - [ ] 위험 영역 전체 삭제 경고
  - [ ] 앱 버전 표시 + 업데이트 확인 + 버전 7회 탭 → devMode
  - [ ] 개발자 모드 서브 페이지: FCM 상태/SW 테스트/알림 권한/로그 뷰어 전부 동작
- [ ] Capacitor(Android) 빌드 확인 — `capacitor.config.ts` 영향 없음 확인 (라우트 추가만)

---

## 5B. 커버리지 검증 체크리스트 (완료 기준)

| 항목 | 기준 | 검증 방법 |
|------|------|-----------|
| 기능 누락 없음 | 타겟 기존 11 섹션의 모든 토글/버튼/입력이 이식 후에도 동작 | Phase 5 기능 체크리스트 |
| 기존 store 계약 유지 | `themeStore`, `settingsStore`, `authStore`, `notificationStore`, `devLogStore`, `memosStore` API 변경 없음 | grep으로 외부 호출처 변경 여부 확인 |
| 외부 컴포넌트 호환 | `AlarmManager`, `PinLockModal`, `ConfirmDialog`, `Button`, `Footer` props 그대로 | import 변화 외 없음 |
| 디자인 토큰 범위 | 신규 유틸(surface-card/row/pill)이 settings 외 페이지에 침범하지 않음 | class 사용 사이트 grep, 다른 페이지 스크린샷 비교 |
| 회귀 없음 | 기존 페이지(memos/todos/stats/notifications/share 등) 시각/기능 변화 없음 | 각 페이지 스모크 |
| 번들 크기 | 코드 스플리팅으로 허브 초기 로드 감소(개발자 모드 분리) | `bun run build` 번들 리포트 |

---

## 6. 참고 — React→Svelte 변환 주의점

| 소스 패턴 | Svelte 5 치환 |
|----------|---------------|
| `<Link to="/settings/x">` | `<a href="/settings/x">` (SvelteKit) |
| `useSettings()` + `setSettings({...})` | `settingsStore.xxx = v` (runes store) |
| `useAppliedTheme(s.theme)` | `$derived(applyTheme(themeStore.theme))` 또는 store 내부 |
| `<Section title="X" description="Y"><Row/></Section>` | `<Section title="X" description="Y">{#snippet children()}...{/snippet}</Section>` — **snippet 전달 필수** |
| `<SegmentedControl<ThemeMode> value onChange options>` | Svelte 5 generics: `<script lang="ts" generics="T extends string">` |
| `className={cn(a, b)}` | `class={cn(a, b)}` — 기존 `$lib/utils` `cn` 이미 존재 |
| `onChange={v => setSettings({theme: v})}` | `onchange={(v) => themeStore.theme = v}` |

---

## 7. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `.row` 클래스 이름 충돌 (타겟 전역에 이미 있을 가능성) | 다른 페이지 레이아웃 깨짐 | Phase 1 착수 전 `grep -r '\.row\b'` 확인. 충돌 시 `.settings-row`로 네임스페이스 |
| 개발자 모드 서브 페이지 분리 중 state 누락 | FCM/SW 테스트 깨짐 | 각 `$state` 이관 목록을 PR에 열거, 기존 `$effect` 그대로 복사 |
| 서브페이지로 이동 시 AlarmManager 초기화 타이밍 | 알림 목록 빈 상태로 보일 수 있음 | `onMount` 동작 확인, 필요 시 store 구독을 허브에서 유지 |
| Svelte 5 snippet children 오용 | 컴포넌트 렌더 실패 | Phase 2 TC에서 snippet 전달 테스트 필수 |
| SegmentedControl generics | 타입 추론 실패 | Fallback으로 `value: string` + 호출측 캐스팅 |

---

## 8. 파일 인덱스

### 신규 생성
- `src/lib/components/settings/Section.svelte`
- `src/lib/components/settings/Row.svelte`
- `src/lib/components/settings/NavRow.svelte`
- `src/lib/components/settings/NavGroup.svelte`
- `src/lib/components/settings/GroupLabel.svelte`
- `src/lib/components/settings/Pill.svelte`
- `src/lib/components/settings/SegmentedControl.svelte`
- `src/lib/components/settings/ImpactNote.svelte`
- `src/lib/components/settings/SubPageShell.svelte`
- `src/routes/settings/developer/+page.svelte`
- `src/routes/settings/notifications/+page.svelte`

### 수정
- `src/app.css` — @theme 토큰 + @layer components 유틸 추가
- `src/routes/settings/+page.svelte` — 허브화 (1929→예상 ~600줄)

### 유지 (변경 없음)
- `src/lib/components/settings/AlarmManager.svelte`
- `src/lib/components/ui/Toggle.svelte` / `Button.svelte` / `ConfirmDialog.svelte`
- `src/lib/components/memo/PinLockModal.svelte`
- `src/lib/stores/*.svelte.ts`

---

## 9. 다음 액션

1. ✅ Q1~Q4 결정 완료 (§0)
2. Phase 1 (app.css 토큰·유틸) 구현 — `/implement`
3. Phase 2 (공통 원시 컴포넌트 9종) 구현
4. Phase 3-4 순차 진행, 섹션 단위 커밋
