# 모바일 웹앱 레이아웃 개발 가이드

모바일-퍼스트 웹앱에서 흔히 발생하는 스크롤바 및 레이아웃 문제를 방지하기 위한 개발 가이드입니다.

---

## 1. 불필요한 스크롤바 방지

### 1.1 `min-h-screen` 중복 사용 금지

**문제**: 부모와 자식 모두 `min-h-screen`을 사용하면 높이가 누적됨

```svelte
<!-- ❌ 잘못된 패턴 -->
<!-- layout.svelte -->
<div class="min-h-screen" style="padding-bottom: 5rem;">
  <slot />
</div>

<!-- page.svelte -->
<div class="min-h-screen">  <!-- 중복! -->
  내용
</div>
```

```svelte
<!-- ✅ 올바른 패턴 -->
<!-- layout.svelte -->
<div class="flex flex-col min-h-screen">
  <Header />
  <main class="flex-1 pb-20">
    <slot />
  </main>
  <BottomNav />
</div>

<!-- page.svelte -->
<div>  <!-- min-h-screen 없음 -->
  내용
</div>
```

### 1.2 Flexbox 레이아웃 활용

```css
/* 권장 레이아웃 구조 */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height (모바일 주소창 고려) */
}

.app-header {
  flex-shrink: 0; /* 헤더는 축소 안됨 */
}

.app-content {
  flex: 1;        /* 남은 공간 채움 */
  overflow-y: auto; /* 필요시 스크롤 */
}

.app-footer {
  flex-shrink: 0; /* 푸터는 축소 안됨 */
}
```

### 1.3 100vh 대신 100dvh 사용 (최신 브라우저)

```css
/* 모바일에서 주소창 높이 변화 대응 */
.container {
  min-height: 100vh;    /* 폴백 */
  min-height: 100dvh;   /* Dynamic viewport height */
}
```

---

## 2. 가로 스크롤바 방지

### 2.1 전역 오버플로우 제어

```css
/* app.css 또는 globals.css */
html, body {
  overflow-x: hidden;
  max-width: 100vw;
}

/* 또는 Tailwind 사용 시 */
@layer base {
  html, body {
    @apply overflow-x-hidden;
  }
}
```

### 2.2 100vw 사용 시 주의

```css
/* ❌ 위험: 스크롤바 너비 포함 안됨 */
.full-width {
  width: 100vw;
}

/* ✅ 안전한 대안 */
.full-width {
  width: 100%;
  max-width: 100vw;
}
```

### 2.3 음수 마진 + 패딩 기법

가로 스크롤이 필요한 영역에서 부모 컨테이너 침범 방지:

```svelte
<!-- 부모 컨테이너 -->
<div class="px-4">
  <!-- 가로 스크롤 영역 -->
  <div class="overflow-x-auto -mx-4 px-4">
    <div class="flex gap-2 w-max">
      <!-- 아이템들 -->
    </div>
  </div>
</div>
```

### 2.4 flex-shrink-0 남용 주의

```svelte
<!-- ❌ 모든 요소가 축소 안되면 오버플로우 발생 -->
<div class="flex">
  <div class="flex-shrink-0">긴 텍스트...</div>
  <div class="flex-shrink-0">긴 텍스트...</div>
</div>

<!-- ✅ 필요한 곳만 flex-shrink-0 사용 -->
<div class="flex">
  <div class="flex-shrink-0">아이콘</div>
  <div class="truncate">긴 텍스트는 잘림...</div>
</div>
```

---

## 3. 터치 스와이프 처리

### 3.1 touch-action CSS 사용

```css
/* 가로 스와이프 제스처 직접 처리 시 */
.swipeable-card {
  touch-action: pan-y; /* 세로 스크롤만 브라우저가 처리 */
}

/* 모든 방향 제스처 직접 처리 시 */
.draggable-element {
  touch-action: none;
}

/* 핀치 줌 비활성화 */
.no-pinch {
  touch-action: pan-x pan-y;
}
```

### 3.2 터치 이벤트에서 preventDefault 사용

```typescript
function handleTouchMove(e: TouchEvent) {
  const deltaX = e.touches[0].clientX - startX;
  const deltaY = e.touches[0].clientY - startY;

  // 가로 움직임이 더 크면 페이지 스크롤 방지
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
    e.preventDefault(); // 중요!
  }

  // 스와이프 처리...
}
```

### 3.3 스크롤 잠금 유틸리티

```typescript
// 모달, 드로어 등에서 배경 스크롤 방지
export function lockScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
}

export function unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
}
```

---

## 4. Fixed 요소와 Safe Area

### 4.1 iOS Safe Area 대응

```css
/* 하단 네비게이션 */
.bottom-nav {
  position: fixed;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* 콘텐츠 영역 */
.main-content {
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
}
```

### 4.2 viewport-fit=cover 설정

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 4.3 Fixed 요소 높이 계산

```svelte
<script>
  // 동적으로 높이 계산
  const HEADER_HEIGHT = 56;  // h-14 = 3.5rem = 56px
  const NAV_HEIGHT = 64;     // h-16 = 4rem = 64px
</script>

<style>
  .sticky-header {
    position: sticky;
    top: 56px; /* 헤더 높이 */
    z-index: 20;
  }

  .content-with-fixed {
    padding-bottom: calc(64px + env(safe-area-inset-bottom));
  }
</style>
```

---

## 5. 반응형 레이아웃 체크리스트

### 5.1 필수 테스트 해상도

| 디바이스 | 너비 | 특이사항 |
|---------|------|---------|
| iPhone SE | 320px | 최소 너비 |
| iPhone 12 | 390px | 일반적인 모바일 |
| iPad Mini | 768px | 태블릿 시작점 |
| iPad Pro | 1024px | 큰 태블릿 |
| Desktop | 1200px+ | 데스크톱 |

### 5.2 공통 문제 체크리스트

- [ ] 가로 스크롤바가 불필요하게 나타나지 않는가?
- [ ] 세로 스크롤바가 콘텐츠가 적을 때도 나타나지 않는가?
- [ ] 터치 스와이프 시 페이지 전체가 움직이지 않는가?
- [ ] Fixed 요소가 콘텐츠를 가리지 않는가?
- [ ] 모바일 키보드가 나타날 때 레이아웃이 깨지지 않는가?
- [ ] 세로 모드 ↔ 가로 모드 전환 시 레이아웃이 정상인가?

---

## 6. 디버깅 팁

### 6.1 오버플로우 원인 찾기

```css
/* 개발 중 오버플로우 요소 시각화 */
* {
  outline: 1px solid red !important;
}

/* 특정 요소의 크기 확인 */
.debug {
  background: rgba(255, 0, 0, 0.1);
}
```

### 6.2 브라우저 개발자 도구

1. **Elements 패널** → 요소 선택 → Computed 탭 → Box Model 확인
2. **Device Mode** → 다양한 해상도로 테스트
3. **Performance 패널** → 스크롤 성능 확인

### 6.3 CSS 디버깅 유틸리티

```javascript
// 콘솔에서 가로로 넘치는 요소 찾기
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > el.clientWidth) {
    console.log('Overflow X:', el);
  }
});
```

---

## 7. 권장 CSS 리셋

```css
/* 스크롤바 관련 리셋 */
@layer base {
  html {
    overflow-x: hidden;
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
  }

  body {
    overflow-x: hidden;
    min-height: 100vh;
    min-height: 100dvh;
    -webkit-overflow-scrolling: touch;
  }

  /* 터치 하이라이트 제거 */
  button, a {
    -webkit-tap-highlight-color: transparent;
  }

  /* 커스텀 스크롤바 (webkit) */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
}
```

---

## 8. 프레임워크별 주의사항

### 8.1 SvelteKit

```svelte
<!-- +layout.svelte에서 전역 레이아웃 설정 -->
<script>
  import '../app.css';
</script>

<div class="flex flex-col min-h-dvh">
  <slot />
</div>

<!-- 개별 페이지에서는 min-h-screen 사용 금지 -->
```

### 8.2 Tailwind CSS

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      minHeight: {
        'dvh': '100dvh',
      },
      height: {
        'dvh': '100dvh',
      }
    }
  }
}
```

---

## 요약: 핵심 원칙

1. **min-h-screen은 최상위 레이아웃에서만** 사용
2. **overflow-x: hidden**은 html/body에 전역 설정
3. **터치 스와이프**는 touch-action + preventDefault 필수
4. **safe-area-inset**으로 iOS 노치 대응
5. **100vw 대신 100%** 사용 (스크롤바 너비 문제)
6. **flex-1**로 남은 공간 채우기 (고정 높이 대신)
