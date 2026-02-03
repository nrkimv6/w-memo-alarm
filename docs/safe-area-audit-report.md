# Android Safe Area 및 모바일 UI 감사 보고서

> 최종 업데이트: 2026-02-03

## 개요

하단 네비바 겹침 수정과 함께 프로젝트 전체를 검토한 결과, 동일한 패턴의 잠재적 이슈를 발견했습니다. 처리 완료 항목과, 향후 모니터링이 필요한 항목을 정리합니다.

---

## 이번 수정에서 처리 완료된 항목

| 컴포넌트 | 파일 | 수정 내용 | 상태 |
|----------|------|----------|------|
| safe-bottom/safe-top 유틸리티 | `src/app.css` | `@layer utilities`에 클래스 정의 추가 | DONE |
| BottomNav | `src/lib/components/BottomNav.svelte` | `env(safe-area-inset-bottom)` 패딩 적용 | DONE |
| 루트 레이아웃 | `src/routes/+layout.svelte` | `pb-20` → `calc(5rem + env(...))` | DONE |
| FAB | `src/app.css` | `bottom-6` → `calc(5.5rem + env(...))` | DONE |
| SyncStatusBanner | `src/lib/components/SyncStatusBanner.svelte` | `bottom-20` → `calc(5rem + env(...))` | DONE |
| Toast | `src/lib/components/ui/Toast.svelte` | `bottom-4` → `calc(5.5rem + env(...))` | DONE |
| Android 시스템 네비바 (라이트) | `android/.../values/styles.xml` | `navigationBarColor` → `#faf8f5` | DONE |
| Android 시스템 네비바 (다크) | `android/.../values-night/styles.xml` | `navigationBarColor` → `#1c1714` | DONE |
| body 배경색 + 다크모드 flash 방지 | `src/app.html` | inline bgcolor + 조기 테마 감지 스크립트 | DONE |
| 설정 페이지 중복 패딩 | `src/routes/settings/+page.svelte` | `pb-24` 제거 (루트 레이아웃과 중복) | DONE |

---

## 향후 모니터링이 필요한 항목

### [HIGH] 1. sticky 헤더에 safe-area-inset-top 미적용

`sticky top-0` 또는 `sticky top-14`를 사용하는 헤더들이 Android 노치/상태바 영역과 겹칠 수 있습니다.

**관련 파일:**
| 파일 | 라인 | 값 |
|------|------|-----|
| `src/lib/components/layout/UnifiedHeader.svelte` | :121 | `sticky top-0` |
| `src/routes/+page.svelte` | :202 | `sticky top-14` |
| `src/routes/memos/+page.svelte` | :179 | `sticky top-14` |
| `src/routes/settings/+page.svelte` | :529 | `sticky top-14` |
| `src/routes/terms/+page.svelte` | :13 | `sticky top-0` |
| `src/routes/about/+page.svelte` | :25 | `sticky top-0` |
| `src/routes/contact/+page.svelte` | :18 | `sticky top-0` |
| `src/routes/privacy/+page.svelte` | :13 | `sticky top-0` |
| `src/routes/share/+page.svelte` | :164 | `sticky top-0` |

**현재 평가:** Capacitor WebView에서는 상태바가 WebView 위에 별도 렌더링되므로, 현재는 실제 겹침이 발생하지 않을 가능성이 높습니다. 하지만 Android 15 edge-to-edge 강제 적용 시 이슈가 될 수 있습니다.

**권장 대응:** `env(safe-area-inset-top)`을 사용한 보정 준비. UnifiedHeader가 최상단에 있으므로 이 컴포넌트에 `safe-top` 적용을 우선 고려.

---

### [HIGH] 2. 드롭다운 메뉴 화면 하단 오버플로우

**관련 파일:**
| 파일 | 라인 | 위치 클래스 |
|------|------|------------|
| `src/lib/components/memo/EmojiPicker.svelte` | :49 | `absolute top-12 left-0 w-64` |
| `src/lib/components/memo/KebabMenu.svelte` | :60 | `absolute right-0 top-full w-40` |
| `src/lib/components/layout/SortDropdown.svelte` | :39 | `absolute top-full right-0 min-w-[140px]` |
| `src/lib/components/memo/TagInput.svelte` | :89 | `absolute z-10 w-full mt-1` |
| `src/lib/components/memo/FolderSelector.svelte` | :69 | `absolute top-full left-0 right-0` |

**현상:** 화면 하단에 위치한 메모에서 드롭다운을 열면, BottomNav 아래로 잘려 보일 수 있습니다.

**권장 대응:** `bits-ui`의 Popover/DropdownMenu를 사용하면 viewport boundary 자동 감지가 됩니다. 또는 드롭다운 열릴 때 viewport 경계를 계산하여 위/아래 방향을 자동 전환하는 로직을 추가합니다.

---

### [HIGH] 3. UnifiedHeader Family Sites 드롭다운 터치 미작동

**파일:** `src/lib/components/layout/UnifiedHeader.svelte:188-224`

**현상:** `group-hover`를 사용하여 마우스 호버로만 드롭다운이 표시됩니다. 터치 디바이스에서는 호버 이벤트가 없으므로 접근 불가.

**권장 대응:** `group-hover`를 click/focus 핸들러로 교체하거나 `group-focus-within`을 추가.

---

### [MEDIUM] 4. group-hover 기반 인터랙션 터치 미작동

**관련 파일:**
| 파일 | 라인 | 대상 |
|------|------|------|
| `src/lib/components/memo/MemoCard.svelte` | :172 | 숨겨진 컨트롤 |
| `src/lib/components/memo/ChecklistEditor.svelte` | :132, :180 | 숨겨진 컨트롤 |

**현상:** `group-hover:opacity-100`으로 마우스 호버 시에만 표시되는 버튼들이 터치 디바이스에서 접근 불가.

**권장 대응:** 모바일에서는 항상 표시하거나, `@media (hover: none)` 미디어 쿼리로 터치 디바이스 분기.

---

### [MEDIUM] 5. 모달 max-h-[90vh]와 가상 키보드 충돌

**관련 파일:**
| 파일 | 라인 | 값 |
|------|------|-----|
| `src/lib/components/ui/Modal.svelte` | :85 | `max-h-[90vh]` |
| `src/lib/components/memo/ScheduledRemindersModal.svelte` | :102 | `max-h-[400px]` |

**현상:** `vh` 단위는 가상 키보드가 열려도 변하지 않으므로, 키보드가 올라오면 모달 내용이 키보드에 가려질 수 있습니다.

**권장 대응:** `90vh` → `90dvh` (Dynamic Viewport Height) 변경. `dvh`는 가상 키보드 영역을 제외한 실제 보이는 높이를 반영합니다.

---

### [MEDIUM] 6. OnboardingModal h-screen/w-screen 문제

**파일:** `src/lib/components/OnboardingModal.svelte:85`

**현상:** `h-screen w-screen max-h-screen`은 가상 키보드/안전 영역 변화에 반응하지 않습니다.

**권장 대응:** `h-dvh w-dvw` 사용 또는 `fixed inset-0`으로 대체.

---

### [LOW] 7. 입력 필드 포커스 시 스크롤 패딩 미설정

**관련 파일:**
| 파일 | 라인 |
|------|------|
| `src/lib/components/memo/QuickMemoInput.svelte` | :65-72 |
| `src/lib/components/memo/SearchBar.svelte` | :22-29 |
| `src/lib/components/memo/TagInput.svelte` | :74-80 |

**현상:** 입력 필드 포커스 시 가상 키보드가 올라오면 입력 영역이 가려질 수 있습니다.

**권장 대응:** `scroll-padding-bottom`을 html/body에 설정하거나, 포커스 시 `scrollIntoView({ behavior: 'smooth', block: 'center' })`를 호출합니다.

---

### [LOW] 8. Android 15 (API 35) Edge-to-Edge 강제 적용 대비

**배경:** Android 15부터 앱이 자동으로 edge-to-edge 모드로 실행됩니다.

**현재 상태:** 이번 수정으로 하단 `env(safe-area-inset-bottom)` 보정을 적용했으므로, edge-to-edge가 강제되더라도 하단은 정상 동작할 것으로 예상됩니다. 다만 상단(safe-area-inset-top)도 함께 대응이 필요합니다.

**확인 필요:** Capacitor 8이 Android 15 edge-to-edge를 어떻게 처리하는지 실기기 테스트가 필요합니다.

---

## 테스트 체크리스트

### 하단 safe area (수정 완료)
- [ ] 3-버튼 네비게이션 모드에서 BottomNav와 시스템 바가 겹치지 않는지
- [ ] 제스처 네비게이션 모드에서 하단 제스처 바 영역이 자연스러운지
- [ ] Toast가 BottomNav 위에 정상 표시되는지
- [ ] SyncStatusBanner가 BottomNav 바로 위에 표시되는지
- [ ] FAB가 BottomNav와 겹치지 않는지

### 모달/오버레이
- [ ] 모달 열었을 때 콘텐츠가 시스템 바에 가려지지 않는지
- [ ] 모달 내 입력 필드 포커스 시 키보드에 가려지지 않는지
- [ ] OnboardingModal이 전체 화면을 올바르게 덮는지

### 테마/색상
- [ ] 다크 모드에서 시스템 네비바 색상이 자연스러운지
- [ ] 다크 모드 전환 시 body 배경색 flash가 없는지

### 디바이스 호환
- [ ] 화면 회전 시 safe area가 정상 적용되는지
- [ ] 노치/펀치홀 기기에서 상단 콘텐츠가 가려지지 않는지
- [ ] 터치 디바이스에서 드롭다운 메뉴 접근 가능한지
