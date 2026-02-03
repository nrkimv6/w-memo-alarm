# Android 하단 네비게이션 바 영역 겹침 수정 계획서

## 1. 현상

Android 기기에서 앱 하단 네비게이터(BottomNav) 아래, 안드로이드 네이티브 시스템 바(뒤로/홈/최근앱) 영역으로 앱 화면이 비쳐 보이는 현상이 간헐적으로 발생합니다.

```
┌──────────────────────┐
│     앱 콘텐츠 영역     │
│                      │
├──────────────────────┤
│   BottomNav (홈/메모/설정)  │  ← 앱 하단 네비
├──────────────────────┤
│  ◁    ○    □         │  ← 시스템 네비바 (이 영역에 앱 콘텐츠가 비침)
└──────────────────────┘
```

---

## 2. 원인 분석

### 2.1 직접 원인: `safe-bottom` CSS 클래스 미정의

`BottomNav.svelte:13`에서 `safe-bottom` 클래스를 사용하고 있지만, **이 클래스가 `app.css` 어디에도 정의되어 있지 않습니다.**

```svelte
<!-- BottomNav.svelte -->
<nav class="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
```

즉, 시스템 네비바 영역에 대한 safe area inset 보정이 전혀 적용되지 않고 있습니다.

### 2.2 근본 원인: viewport-fit=cover + 미보상

`app.html:6`에서 `viewport-fit=cover`를 설정하고 있습니다:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

이 설정은 웹뷰 콘텐츠를 화면 전체 영역(노치, 시스템 네비바 포함)까지 확장합니다. 원래 이 설정은 `env(safe-area-inset-*)` CSS 환경변수와 함께 사용하여, 확장된 영역에 대해 패딩/마진을 보정하는 것이 정석입니다. 하지만 현재 프로젝트에서는 이 보정이 누락되어 있습니다.

### 2.3 Android 네이티브 레벨 미설정

- **`styles.xml`**: `android:navigationBarColor`가 설정되어 있지 않아 시스템 네비바가 투명/반투명으로 렌더링될 수 있습니다.
- **`MainActivity.java`**: Edge-to-edge 관련 설정이 없는 기본 `BridgeActivity` 상속만 존재합니다.
- **`capacitor.config.ts`**: StatusBar/NavigationBar 관련 플러그인 설정이 없습니다.

### 2.4 PWA이기 때문인가?

부분적으로 맞습니다. 순수 PWA(브라우저에서 홈 화면에 추가)에서는 시스템 네비바 색상을 `theme-color` meta 태그로 어느 정도 제어할 수 있지만, 이 앱은 **Capacitor를 통한 네이티브 래핑 앱**이므로 WebView 안에서 동작합니다. Capacitor WebView는 기본적으로 시스템 네비바 영역을 별도 관리하지 않으며, 이로 인해 `viewport-fit=cover` 상태에서 콘텐츠가 시스템 영역까지 확장됩니다.

### 2.5 "간헐적" 발생 원인

- 제스처 네비게이션 모드 vs 3-버튼 네비게이션 모드에 따라 시스템 바 크기가 다름
- Android 버전, 기기 제조사별 시스템 바 투명도 정책 차이
- 화면 전환 시 View Transition 애니메이션 중 일시적 레이아웃 플리커

---

## 3. 수정 방안

### 수정 A: CSS safe-bottom 유틸리티 정의 (필수)

**파일**: `src/app.css`

`@layer utilities` 블록에 `safe-bottom` 클래스를 정의합니다.

```css
@layer utilities {
  /* Safe area insets for notch/navigation bar */
  .safe-bottom {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .safe-top {
    padding-top: env(safe-area-inset-top, 0px);
  }
}
```

**효과**: BottomNav가 시스템 네비바 높이만큼 아래쪽에 패딩을 확보하여, 네비바 뒤로 콘텐츠가 비치지 않게 됩니다.

### 수정 B: Android 시스템 네비바 색상 지정 (필수)

**파일**: `android/app/src/main/res/values/styles.xml`

```xml
<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="windowActionBar">false</item>
    <item name="windowNoTitle">true</item>
    <item name="android:background">@null</item>
    <item name="android:navigationBarColor">@color/colorPrimary</item>
</style>
```

**효과**: 시스템 네비바 영역이 투명 대신 앱 테마 색상(sage green)으로 채워져, 콘텐츠가 비치는 현상이 원천 차단됩니다.

### 수정 C: BottomNav 배경 확장 (필수)

**파일**: `src/lib/components/BottomNav.svelte`

BottomNav 자체의 배경이 safe area inset 영역까지 확장되도록 수정합니다.

```svelte
<nav
    class="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
    style="view-transition-name: bottom-nav; padding-bottom: env(safe-area-inset-bottom, 0px);"
>
```

### 수정 D: 루트 레이아웃 하단 패딩 보정 (필수)

**파일**: `src/routes/+layout.svelte`

BottomNav에 safe-area 패딩이 추가되면 전체 높이가 늘어나므로, 루트 레이아웃의 `pb-20`도 보정이 필요합니다.

```svelte
<div class="min-h-screen bg-background" style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">
```

### 수정 E: body 배경색 보장 (권장)

**파일**: `src/app.html`

body 자체에 배경색이 확실히 적용되도록 하여, 어떤 상황에서도 시스템 바 영역에 빈 공간이 노출되지 않도록 합니다. 현재 `app.css`의 base 레이어에서 `bg-background`를 적용하고 있으나, CSS 로딩 전 flash를 방지하기 위해 inline style도 추가합니다.

```html
<body data-sveltekit-preload-data="hover" style="background-color: #faf8f5;">
```

### 수정 F: FAB, Toast, SyncBanner 위치 보정 (권장)

BottomNav 높이가 변경되므로 관련 컴포넌트들의 위치도 보정합니다.

**파일**: `src/app.css` (FAB)
```css
.fab {
    @apply fixed right-6 w-14 h-14 rounded-full shadow-lg;
    bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
    /* ... */
}
```

---

## 4. 수정 파일 목록

| 우선순위 | 파일 | 수정 내용 |
|---------|------|----------|
| 필수 | `src/app.css` | `safe-bottom`, `safe-top` 유틸리티 클래스 정의 |
| 필수 | `src/lib/components/BottomNav.svelte` | safe-area-inset-bottom 패딩 적용 |
| 필수 | `src/routes/+layout.svelte` | 하단 패딩을 safe area 포함하여 보정 |
| 필수 | `android/app/src/main/res/values/styles.xml` | navigationBarColor 설정 |
| 권장 | `src/app.html` | body inline background-color 추가 |
| 권장 | `src/app.css` | FAB 위치 safe area 보정 |

---

## 5. 검증 방법

1. **3-버튼 네비게이션 모드**: 뒤로/홈/최근앱 버튼 영역에 앱 콘텐츠가 비치지 않는지 확인
2. **제스처 네비게이션 모드**: 하단 제스처 바 영역이 자연스럽게 처리되는지 확인
3. **화면 전환 시**: View Transition 애니메이션 중 하단 영역 플리커 없는지 확인
4. **다크 모드**: 시스템 네비바 색상이 다크 모드 배경과 조화되는지 확인
5. **다양한 기기**: 노치/펀치홀 기기, 구형 기기 등에서 정상 동작 확인

---

## 6. 참고

- CSS `env(safe-area-inset-bottom)`: [MDN 문서](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- `viewport-fit=cover`와 함께 사용해야 `env()` 값이 0이 아닌 실제 값을 반환함
- Capacitor 8에서는 `@capacitor/status-bar` 플러그인으로 상태바 색상 제어 가능 (현재 미사용)
- Android API 35+ (Android 15)부터 edge-to-edge가 기본 강제 적용되므로, safe area 대응은 향후 필수 사항
