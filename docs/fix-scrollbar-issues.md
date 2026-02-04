# 홈탭 스크롤바 문제 분석 및 수정 계획서

## 1. 문제 현상

### 1.1 세로 스크롤바 발생
- **증상**: 홈탭의 세로축이 화면보다 미묘하게 길어져 불필요한 스크롤바 발생
- **영향 범위**: 홈, 메모, 할일, 설정, 알림 모든 탭에서 동일 현상 발생

### 1.2 가로 스크롤바 발생
- **증상**: 필터 버튼 영역(전체/핀/즐겨찾기)이 화면 너비를 초과
- **영향 범위**: 메모탭의 FilterTabs 컴포넌트

### 1.3 스와이프 시 화면 움직임
- **증상**: 메모 카드 스와이프(핀/삭제) 시 화면 전체가 미세하게 움직임
- **영향 범위**: SwipeableCard 컴포넌트 사용하는 모든 곳

---

## 2. 원인 분석

### 2.1 세로 스크롤바 원인: `min-h-screen` 중복 및 패딩 누적

**루트 레이아웃** (`src/routes/+layout.svelte:115`):
```svelte
<div class="min-h-screen bg-background"
     style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">
```

**각 페이지에서 중복 사용**:
| 파일 | 라인 | 코드 |
|------|------|------|
| `+page.svelte` (홈) | 241 | `<div class="min-h-screen">` |
| `memos/+page.svelte` | 177 | `<div class="min-h-screen">` |
| `todos/+page.svelte` | 324 | `<div class="min-h-screen pb-20">` |
| `settings/+page.svelte` | 570 | `<div class="min-h-screen">` |
| `notifications/+page.svelte` | 119 | `<div class="min-h-screen">` |

**문제 계산**:
```
루트 레이아웃: min-h-screen (100vh) + padding-bottom (5rem)
자식 페이지: min-h-screen (100vh)
실제 높이: 100vh + 5rem = 스크롤 발생
```

### 2.2 가로 스크롤바 원인: 오버플로우 처리 미흡

**FilterTabs.svelte (line 19)**:
```svelte
<div class="flex items-center justify-between gap-2 overflow-x-auto pb-1">
```
- `overflow-x-auto`가 설정되어 있지만 부모 컨테이너에서 오버플로우가 누출됨
- body/html 레벨에서 `overflow-x: hidden`이 없어 미세한 오버플로우가 스크롤바 유발

**추가 원인**:
- 일부 요소에 `flex-shrink-0` 사용으로 화면 너비 초과
- 패딩/마진 계산으로 인한 100vw 초과

### 2.3 스와이프 시 화면 움직임 원인: 터치 이벤트 미처리

**SwipeableCard.svelte (line 26-33)**:
```typescript
function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    // ❌ e.preventDefault() 누락!
    // ❌ touch-action CSS 미설정!
}
```

**문제점**:
1. `e.preventDefault()` 미호출 → 브라우저 기본 스크롤 동작 발생
2. `touch-action` CSS 미설정 → 터치 제스처 충돌
3. 가로 스와이프와 페이지 스크롤이 동시 발생

---

## 3. 수정 계획

### Task 1: 세로 스크롤바 수정 (높은 우선순위)

#### 1-1. 루트 레이아웃 수정
**파일**: `src/routes/+layout.svelte`

**수정 전**:
```svelte
<div class="min-h-screen bg-background"
     style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">
```

**수정 후**:
```svelte
<div class="flex flex-col min-h-screen bg-background">
  <UnifiedHeader />
  <main class="flex-1" style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">
    {@render children()}
  </main>
  <SyncStatusBanner />
  <BottomNav />
</div>
```

#### 1-2. 각 페이지에서 `min-h-screen` 제거
**수정 대상 파일**:
- `src/routes/+page.svelte` (line 241)
- `src/routes/memos/+page.svelte` (line 177)
- `src/routes/todos/+page.svelte` (line 324)
- `src/routes/settings/+page.svelte` (line 570)
- `src/routes/notifications/+page.svelte` (line 119)

**수정 방법**:
```diff
- <div class="min-h-screen">
+ <div>
```

**todos 페이지 특별 처리**:
```diff
- <div class="min-h-screen pb-20">
+ <div>
```
(pb-20은 루트 레이아웃에서 처리되므로 제거)

---

### Task 2: 가로 스크롤바 수정 (중간 우선순위)

#### 2-1. 전역 오버플로우 제어
**파일**: `src/app.css`

**추가할 코드**:
```css
@layer base {
  html, body {
    overflow-x: hidden;
    max-width: 100vw;
  }
}
```

#### 2-2. FilterTabs 컨테이너 수정
**파일**: `src/lib/components/layout/FilterTabs.svelte`

**수정 전**:
```svelte
<div class="flex items-center justify-between gap-2 overflow-x-auto pb-1">
```

**수정 후**:
```svelte
<div class="flex items-center justify-between gap-2 overflow-x-auto overflow-y-hidden pb-1 -mx-4 px-4">
```
(음수 마진 + 패딩으로 스크롤 영역 확장)

---

### Task 3: 스와이프 터치 이벤트 수정 (높은 우선순위)

**파일**: `src/lib/components/memo/SwipeableCard.svelte`

#### 3-1. touch-action CSS 추가
```diff
<div
-   class="relative pt-3"
+   class="relative pt-3"
+   style="touch-action: pan-y;"
    bind:this={containerElement}
```

#### 3-2. preventDefault 추가
```diff
function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
-   currentX = e.touches[0].clientX - startX;
+   const deltaX = e.touches[0].clientX - startX;
+
+   // 가로 스와이프가 세로보다 크면 페이지 스크롤 방지
+   if (Math.abs(deltaX) > 10) {
+       e.preventDefault();
+   }
+
+   currentX = deltaX;
```

#### 3-3. touchstart에서 초기 Y 좌표 저장 (선택적 개선)
```diff
let startX = $state(0);
+ let startY = $state(0);

function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
+   startY = e.touches[0].clientY;
    isDragging = true;
}

function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;
+
+   const deltaX = e.touches[0].clientX - startX;
+   const deltaY = e.touches[0].clientY - startY;
+
+   // 가로 스와이프가 우세하면 페이지 스크롤 방지
+   if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
+       e.preventDefault();
+   }
+
    currentX = e.touches[0].clientX - startX;
```

---

## 4. 테스트 체크리스트

### 4.1 세로 스크롤 테스트
- [ ] 홈탭: 메모가 적을 때 불필요한 스크롤바 없음
- [ ] 메모탭: 메모가 적을 때 불필요한 스크롤바 없음
- [ ] 할일탭: 할일이 적을 때 불필요한 스크롤바 없음
- [ ] 설정탭: 스크롤바 적절하게 동작
- [ ] 알림탭: 알림이 적을 때 불필요한 스크롤바 없음

### 4.2 가로 스크롤 테스트
- [ ] 모든 화면 너비에서 가로 스크롤바 없음
- [ ] FilterTabs가 좁은 화면에서 올바르게 스크롤됨
- [ ] 헤더 요소가 오버플로우되지 않음

### 4.3 스와이프 테스트
- [ ] 메모 카드 스와이프 시 화면 전체가 움직이지 않음
- [ ] 세로 스크롤은 정상 동작
- [ ] 핀/삭제 기능 정상 동작

### 4.4 반응형 테스트
- [ ] 모바일 (320px ~ 480px)
- [ ] 태블릿 (768px ~ 1024px)
- [ ] 데스크톱 (1200px+)

---

## 5. 예상 소요 시간

| Task | 예상 시간 |
|------|----------|
| Task 1: 세로 스크롤바 수정 | 30분 |
| Task 2: 가로 스크롤바 수정 | 20분 |
| Task 3: 스와이프 터치 수정 | 30분 |
| 테스트 | 30분 |
| **총계** | **약 2시간** |

---

## 6. 관련 파일 목록

### 수정 필요 파일
1. `src/routes/+layout.svelte`
2. `src/routes/+page.svelte`
3. `src/routes/memos/+page.svelte`
4. `src/routes/todos/+page.svelte`
5. `src/routes/settings/+page.svelte`
6. `src/routes/notifications/+page.svelte`
7. `src/lib/components/memo/SwipeableCard.svelte`
8. `src/lib/components/layout/FilterTabs.svelte`
9. `src/app.css`

### 확인 필요 파일
1. `src/lib/components/BottomNav.svelte`
2. `src/lib/components/layout/UnifiedHeader.svelte`
