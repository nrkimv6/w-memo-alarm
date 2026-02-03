# Android Safe Area 관련 추가 검토 사항

## 개요

하단 네비바 겹침 수정과 함께 프로젝트 전체를 검토한 결과, 동일한 패턴의 잠재적 이슈를 추가로 발견했습니다. 현재 수정에서 함께 처리한 항목과, 향후 모니터링이 필요한 항목을 정리합니다.

---

## 이번 수정에서 처리 완료된 항목

| 컴포넌트 | 파일 | 수정 내용 |
|----------|------|----------|
| safe-bottom/safe-top 유틸리티 | `src/app.css` | `@layer utilities`에 클래스 정의 추가 |
| BottomNav | `src/lib/components/BottomNav.svelte` | `env(safe-area-inset-bottom)` 패딩 적용 |
| 루트 레이아웃 | `src/routes/+layout.svelte` | `pb-20` → `calc(5rem + env(...))` |
| FAB | `src/app.css` | `bottom-6` → `calc(5.5rem + env(...))` |
| SyncStatusBanner | `src/lib/components/SyncStatusBanner.svelte` | `bottom-20` → `calc(5rem + env(...))` |
| Toast | `src/lib/components/ui/Toast.svelte` | `bottom-4` → `calc(5.5rem + env(...))` |
| Android 시스템 네비바 | `android/.../styles.xml` | `navigationBarColor` 지정 |
| body 배경색 | `src/app.html` | inline `background-color` 추가 |

---

## 향후 모니터링이 필요한 항목

### 1. 드롭다운 메뉴 화면 하단 오버플로우 (중간 우선순위)

**관련 파일:**
- `src/lib/components/memo/EmojiPicker.svelte` — `absolute top-12`
- `src/lib/components/memo/KebabMenu.svelte` — `absolute right-0 top-full`
- `src/lib/components/layout/SortDropdown.svelte` — `absolute top-full right-0`

**현상:** 화면 하단에 위치한 메모 카드에서 이 드롭다운들을 열면, BottomNav 아래로 잘려 보일 수 있습니다.

**권장 대응:**
- 현재는 드롭다운이 주로 상단/중간에서 열리므로 실제 문제 발생 빈도가 낮음
- 만약 이슈가 발생하면, 드롭다운 열릴 때 viewport boundary를 계산하여 위/아래 방향을 자동 전환하는 로직 추가 고려
- 라이브러리(`bits-ui`의 Popover/DropdownMenu 등)를 사용하면 자동으로 처리됨

### 2. 모달/다이얼로그 전체화면 백드롭 (낮은 우선순위)

**관련 파일:**
- `src/lib/components/ui/Modal.svelte` — `fixed inset-0`
- `src/lib/components/OnboardingModal.svelte` — `fixed inset-0 h-screen w-screen`

**현상:** 모달 백드롭이 `fixed inset-0`으로 전체 화면을 덮는데, 시스템 네비바 영역까지 포함됩니다.

**평가:** 모달은 의도적으로 전체 화면을 어둡게 해야 하므로, 이 경우는 시스템 바 영역까지 확장되는 것이 오히려 자연스럽습니다. 다만 모달 콘텐츠 자체가 시스템 바에 가려지지 않도록 `max-h-[90vh]` + centered 패턴을 유지하면 됩니다. **현재 구현이 적절합니다.**

### 3. 다크 모드에서 시스템 네비바 색상 불일치 (중간 우선순위)

**현상:** `styles.xml`의 `android:navigationBarColor`를 `#faf8f5` (라이트 모드 배경색)로 고정했는데, 다크 모드에서는 이 색상이 어색할 수 있습니다.

**권장 대응:**
- Android `values-night/styles.xml`을 추가하여 다크 모드 전용 네비바 색상 설정
- 또는 `@capacitor/status-bar` 플러그인을 도입하여 JavaScript에서 동적으로 제어

```xml
<!-- android/app/src/main/res/values-night/styles.xml -->
<resources>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:navigationBarColor">#1c1816</item>
    </style>
</resources>
```

### 4. Android 15 (API 35) Edge-to-Edge 강제 적용 대비 (낮은 우선순위)

**배경:** Android 15부터 앱이 자동으로 edge-to-edge 모드로 실행됩니다. 즉, 시스템 바가 투명해지고 콘텐츠가 그 아래로 확장됩니다.

**현재 상태:** 이번 수정으로 `env(safe-area-inset-bottom)` 보정을 적용했으므로, edge-to-edge가 강제되더라도 콘텐츠가 적절히 배치됩니다.

**확인 필요:** Capacitor 8이 Android 15 edge-to-edge를 어떻게 처리하는지, WebView 내 `env()` 값이 정상적으로 전달되는지 실기기 테스트 필요합니다.

### 5. 설정 페이지 별도 패딩 (낮은 우선순위)

**관련 파일:** 설정 페이지에서 `pb-24`를 사용하는 경우가 있을 수 있음

**평가:** 루트 레이아웃의 `padding-bottom: calc(5rem + env(...))` 이 모든 페이지에 적용되므로, 페이지별 별도 패딩이 있다면 중복 적용될 수 있습니다. 페이지별 `pb-*` 사용 여부를 확인하고, 중복이 있으면 제거해야 합니다.

---

## 테스트 체크리스트

- [ ] 3-버튼 네비게이션 모드에서 BottomNav와 시스템 바가 겹치지 않는지
- [ ] 제스처 네비게이션 모드에서 하단 제스처 바 영역이 자연스러운지
- [ ] Toast가 BottomNav 위에 정상 표시되는지
- [ ] SyncStatusBanner가 BottomNav 바로 위에 표시되는지
- [ ] FAB가 BottomNav와 겹치지 않는지
- [ ] 모달 열었을 때 콘텐츠가 시스템 바에 가려지지 않는지
- [ ] 다크 모드에서 시스템 네비바 색상이 자연스러운지
- [ ] 화면 회전 시 safe area가 정상 적용되는지
