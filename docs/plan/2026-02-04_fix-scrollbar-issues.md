# 홈탭 스크롤바 문제 분석 및 수정 계획서

## 1. 문제 현상

### 1.1 세로 스크롤바 발생
- **증상**: 홈탭의 세로축이 화면보다 미묘하게 길어져 불필요한 스크롤바 발생
- **영향 범위**: 홈, 메모, 할일, 설정, 알림 모든 탭에서 동일 현상 발생

### 1.2 가로 스크롤바 발생
- **증상**: 필터 버튼 영역(전체/핀/즐겨찾기)이 화면 너비를 초과
- **영향 범위**: 메모탭의 FilterTabs 컴포넌트

**⚠️ 확인 필요**: 사용자가 "홈탭"이라고 언급했으나, "전체/핀/즐겨찾기" 버튼은 **메모탭**에만 존재함. 홈탭에서 가로 스크롤이 발생한다면 다음 요소들이 원인일 수 있음:
- 섹션 헤더 ("고정된 메모" + "더보기" 링크)
- QuickMemoInput 컴포넌트
- UnifiedHeader 컴포넌트

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

## 3. 수정 계획 (세부 업무 단위)

---

### Task 0: 홈탭 가로 스크롤 원인 사전 확인 (필수 선행)

**담당자**: _______________
**우선순위**: 최상 (다른 Task 전에 수행)
**난이도**: ★☆☆☆☆

**작업 내용**:
1. 개발자 도구를 열고 홈탭으로 이동한다
2. 화면 너비를 320px로 줄인다 (모바일 최소 너비)
3. 가로 스크롤바가 나타나는지 확인한다
4. 나타난다면, 개발자 도구에서 요소 검사를 통해 어떤 요소가 화면을 넘어가는지 찾는다
5. 발견된 요소의 파일 경로와 라인 번호를 기록한다

**확인할 요소들**:
- 섹션 헤더 영역 (`src/routes/+page.svelte` 324번 라인 근처)
- QuickMemoInput (`src/lib/components/memo/QuickMemoInput.svelte`)
- UnifiedHeader (`src/lib/components/layout/UnifiedHeader.svelte`)

**완료 기준**:
- 홈탭 가로 스크롤의 정확한 원인 요소가 파악됨
- 필요시 Task 4-1 추가 여부 결정됨

**결과 기록란**:
- [x] 홈탭에 가로 스크롤 있음 / 없음 → 전역 overflow-x 미설정이 원인
- [x] 원인 요소: 전역 CSS (Task 3에서 해결)
- [x] 추가 Task 필요: 아니오 (Task 3으로 해결됨)

**의존성**: 없음 (가장 먼저 수행)

---

### Task 1: 루트 레이아웃 Flexbox 구조 변경

**담당자**: _______________
**우선순위**: 높음 (다른 Task의 선행 작업)
**난이도**: ★★☆☆☆

**파일**: `src/routes/+layout.svelte`

**작업 내용**:
1. 파일을 열고 115번 라인 근처의 루트 컨테이너 div를 찾는다
2. 현재 클래스 `min-h-screen bg-background`에 `flex flex-col`을 추가한다
3. 기존 inline style의 `padding-bottom`을 제거한다
4. 자식 요소들을 감싸는 main 태그를 추가하고 `flex-1` 클래스를 부여한다
5. main 태그에 기존 padding-bottom 스타일을 이동시킨다

**완료 기준**:
- 루트 div가 flex 컨테이너로 동작
- 콘텐츠 영역이 flex-1로 남은 공간을 채움
- BottomNav와 Header는 고정 크기 유지

**의존성**: 없음 (첫 번째로 수행)

---

### Task 2-1: 홈탭 min-h-screen 제거

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★☆☆☆☆

**파일**: `src/routes/+page.svelte`

**작업 내용**:
1. 파일을 열고 241번 라인 근처를 찾는다
2. `class="min-h-screen"`에서 `min-h-screen`을 제거한다
3. 빈 class 속성이 되면 class 속성 자체를 삭제해도 됨

**완료 기준**:
- 해당 div에 min-h-screen 클래스가 없음
- 페이지가 정상적으로 렌더링됨

**의존성**: Task 1 완료 후 수행

**테스트 방법**:
- 홈탭에서 메모가 1-2개만 있을 때 세로 스크롤바가 없어야 함
- 메모가 많을 때는 정상적으로 스크롤되어야 함

---

### Task 2-2: 메모탭 min-h-screen 제거

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★☆☆☆☆

**파일**: `src/routes/memos/+page.svelte`

**작업 내용**:
1. 파일을 열고 177번 라인 근처를 찾는다
2. `class="min-h-screen"`에서 `min-h-screen`을 제거한다

**완료 기준**:
- 해당 div에 min-h-screen 클래스가 없음

**의존성**: Task 1 완료 후 수행

**테스트 방법**:
- 메모탭에서 메모가 적을 때 세로 스크롤바가 없어야 함

---

### Task 2-3: 할일탭 min-h-screen 및 pb-20 제거

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★☆☆☆☆

**파일**: `src/routes/todos/+page.svelte`

**작업 내용**:
1. 파일을 열고 324번 라인 근처를 찾는다
2. `class="min-h-screen pb-20"`에서 `min-h-screen`과 `pb-20` 모두 제거한다
3. pb-20은 루트 레이아웃에서 이미 처리되므로 중복 제거

**완료 기준**:
- 해당 div에 min-h-screen, pb-20 클래스가 모두 없음

**의존성**: Task 1 완료 후 수행

**주의사항**:
- 이 파일만 pb-20이 추가로 있으므로 반드시 함께 제거할 것

**테스트 방법**:
- 할일탭에서 할일이 적을 때 세로 스크롤바가 없어야 함
- 하단 여백이 BottomNav에 가려지지 않아야 함

---

### Task 2-4: 설정탭 min-h-screen 제거

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★☆☆☆☆

**파일**: `src/routes/settings/+page.svelte`

**작업 내용**:
1. 파일을 열고 570번 라인 근처를 찾는다
2. `class="min-h-screen"`에서 `min-h-screen`을 제거한다

**완료 기준**:
- 해당 div에 min-h-screen 클래스가 없음

**의존성**: Task 1 완료 후 수행

**테스트 방법**:
- 설정탭이 정상적으로 표시되어야 함

---

### Task 2-5: 알림탭 min-h-screen 제거

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★☆☆☆☆

**파일**: `src/routes/notifications/+page.svelte`

**작업 내용**:
1. 파일을 열고 119번 라인 근처를 찾는다
2. `class="min-h-screen"`에서 `min-h-screen`을 제거한다

**완료 기준**:
- 해당 div에 min-h-screen 클래스가 없음

**의존성**: Task 1 완료 후 수행

**테스트 방법**:
- 알림탭에서 알림이 적을 때 세로 스크롤바가 없어야 함

---

### Task 3: 전역 가로 오버플로우 숨김 설정

**담당자**: _______________
**우선순위**: 중간
**난이도**: ★☆☆☆☆

**파일**: `src/app.css`

**작업 내용**:
1. 파일을 열고 `@layer base` 블록을 찾는다
2. 해당 블록 안에 html, body 선택자를 추가한다
3. overflow-x: hidden과 max-width: 100vw 속성을 추가한다

**완료 기준**:
- html과 body 요소에 가로 오버플로우가 숨겨짐
- 전체 페이지에서 가로 스크롤바가 나타나지 않음

**의존성**: 없음 (독립 작업)

**테스트 방법**:
- 모든 탭에서 가로 스크롤바가 없어야 함
- 브라우저 창을 좁게 줄여도 가로 스크롤이 안 생겨야 함

---

### Task 4: FilterTabs 스크롤 영역 개선

**담당자**: _______________
**우선순위**: 중간
**난이도**: ★★☆☆☆

**파일**: `src/lib/components/layout/FilterTabs.svelte`

**작업 내용**:
1. 파일을 열고 가장 바깥쪽 컨테이너 div를 찾는다 (약 19번 라인)
2. 기존 클래스에 `overflow-y-hidden`을 추가한다
3. 기존 클래스에 `-mx-4 px-4`를 추가한다 (음수 마진 + 패딩 기법)

**완료 기준**:
- 필터 탭이 좁은 화면에서 가로 스크롤 가능
- 스크롤 영역이 부모 컨테이너 밖으로 누출되지 않음

**의존성**: 없음 (독립 작업)

**배경 지식**:
- 음수 마진(-mx-4)으로 컨테이너를 부모 밖으로 확장
- 동일한 크기의 패딩(px-4)으로 내용물 위치는 유지
- 이렇게 하면 스크롤 영역이 화면 가장자리까지 확장됨

**테스트 방법**:
- 메모탭에서 필터 버튼들이 많을 때 가로 스크롤이 자연스럽게 됨
- 스크롤해도 페이지 전체에 가로 스크롤바가 생기지 않음

---

### Task 4-1: 홈탭 가로 스크롤 원인 수정 (조건부)

**담당자**: _______________
**우선순위**: 중간
**난이도**: ★★☆☆☆

**⚠️ 이 Task는 Task 0 결과에 따라 수행 여부가 결정됨**

**파일**: Task 0에서 파악된 파일

**작업 내용**:
Task 0에서 발견된 원인에 따라 다음 중 해당하는 수정 수행:

**케이스 A: 섹션 헤더가 원인인 경우** (`src/routes/+page.svelte`)
1. 324번 라인 근처의 섹션 헤더 div를 찾는다
2. `flex items-center justify-between`에 `min-w-0`을 추가한다
3. 텍스트 요소에 `truncate` 클래스를 추가하여 오버플로우 방지

**케이스 B: QuickMemoInput이 원인인 경우** (`src/lib/components/memo/QuickMemoInput.svelte`)
1. 64번 라인 근처의 컨테이너 div를 찾는다
2. `max-w-full` 또는 `overflow-hidden` 클래스 추가

**케이스 C: UnifiedHeader가 원인인 경우** (`src/lib/components/layout/UnifiedHeader.svelte`)
1. 헤더 내부 요소들의 `flex-shrink-0` 사용 검토
2. 필요시 `min-w-0` 또는 `overflow-hidden` 추가

**완료 기준**:
- 홈탭에서 320px 화면 너비에서도 가로 스크롤바가 없음

**의존성**: Task 0 완료 후 (원인 파악 필요)

---

### Task 5: SwipeableCard에 touch-action CSS 추가

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★☆☆☆☆

**파일**: `src/lib/components/memo/SwipeableCard.svelte`

**작업 내용**:
1. 파일을 열고 가장 바깥쪽 컨테이너 div를 찾는다 (bind:this={containerElement}가 있는 div)
2. 해당 div에 `style="touch-action: pan-y;"` 속성을 추가한다

**완료 기준**:
- 컨테이너에 touch-action: pan-y 스타일이 적용됨

**의존성**: 없음 (Task 6과 동시 진행 가능)

**배경 지식**:
- touch-action: pan-y는 "세로 스크롤만 브라우저가 처리하라"는 의미
- 가로 방향 터치는 JavaScript 코드가 직접 처리함
- 이를 통해 스와이프와 페이지 스크롤의 충돌 방지

**테스트 방법**:
- 메모 카드를 좌우로 스와이프해도 페이지 전체가 움직이지 않음

---

### Task 6: SwipeableCard touchstart에 Y좌표 저장 추가

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★★☆☆☆

**파일**: `src/lib/components/memo/SwipeableCard.svelte`

**작업 내용**:
1. 파일 상단의 state 변수 선언부를 찾는다
2. `let startX = $state(0);` 옆에 `let startY = $state(0);`를 추가한다
3. handleTouchStart 함수를 찾는다
4. `startX = e.touches[0].clientX;` 다음 줄에 `startY = e.touches[0].clientY;`를 추가한다

**완료 기준**:
- startY 상태 변수가 선언됨
- 터치 시작 시 Y좌표가 저장됨

**의존성**: 없음 (Task 5, 7과 동시 진행 가능)

---

### Task 7: SwipeableCard touchmove에 preventDefault 로직 추가

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★★★☆☆

**파일**: `src/lib/components/memo/SwipeableCard.svelte`

**작업 내용**:
1. handleTouchMove 함수를 찾는다
2. 기존 `currentX = e.touches[0].clientX - startX;` 코드를 수정한다
3. deltaX와 deltaY를 계산하는 코드를 추가한다
4. 가로 움직임이 세로보다 크고 10px 이상이면 e.preventDefault()를 호출하는 조건문을 추가한다
5. currentX에 deltaX 값을 할당한다

**완료 기준**:
- 가로 스와이프가 우세할 때 브라우저 기본 동작이 방지됨
- 세로 스크롤은 여전히 정상 동작함

**의존성**: Task 6 완료 후 수행 (startY 변수 필요)

**배경 지식**:
- deltaX: 터치 시작점에서 현재 위치까지의 가로 이동 거리
- deltaY: 터치 시작점에서 현재 위치까지의 세로 이동 거리
- Math.abs(): 절대값 함수 (음수를 양수로 변환)
- 가로 움직임이 더 크면 사용자가 스와이프를 의도한 것으로 판단

**테스트 방법**:
- 메모 카드를 좌우로 스와이프할 때 화면이 흔들리지 않음
- 세로로 스크롤할 때는 정상적으로 페이지가 스크롤됨
- 핀/삭제 기능이 정상 동작함

---

### Task 8: 통합 테스트

**담당자**: _______________
**우선순위**: 높음
**난이도**: ★★☆☆☆

**작업 내용**:
모든 수정 완료 후 [수동 테스트 체크리스트](./MANUAL-TESTS.md)를 따라 테스트 수행

**의존성**: Task 1~7 모두 완료 후 수행

---

## 4. 테스트 체크리스트

📋 **수동 테스트 항목은 별도 문서로 분리되었습니다.**

👉 [수동 테스트 체크리스트](./MANUAL-TESTS.md)

해당 문서에서 다음 항목들을 확인할 수 있습니다:
- 세로 스크롤 테스트
- 가로 스크롤 테스트
- 스와이프 테스트
- 반응형 테스트 (다양한 해상도)
- 플랫폼별 테스트
- 엣지 케이스 테스트

---

## 5. 업무 분배 요약

### 5.1 Task 의존성 다이어그램

```
[Task 0: 홈탭 가로 스크롤 확인] ───▶ [Task 4-1: 홈탭 수정] (조건부)
        (최우선)                              │
                                             ▼
[Task 1: 루트 레이아웃] ─────┬──▶ [Task 2-1: 홈탭]
        (선행 필수)         ├──▶ [Task 2-2: 메모탭]
                           ├──▶ [Task 2-3: 할일탭]
                           ├──▶ [Task 2-4: 설정탭]
                           └──▶ [Task 2-5: 알림탭]

[Task 3: 전역 CSS] ─────────────▶ (독립 작업)

[Task 4: FilterTabs] ───────────▶ (독립 작업)

[Task 5: touch-action] ─────────▶ (독립 작업)

[Task 6: startY 추가] ──────────▶ [Task 7: preventDefault]

                                     │
                                     ▼
                              [Task 8: 통합 테스트]
```

### 5.2 병렬 작업 가능 그룹

| 그룹 | Task | 동시 작업 가능 |
|------|------|---------------|
| 0 | Task 0 | 단독 (최우선, 사전 확인) |
| A | Task 1 | 단독 (선행 필수) |
| B | Task 2-1 ~ 2-5 | 5개 동시 가능 |
| C | Task 3, 4, 4-1(조건부), 5, 6 | 최대 5개 동시 가능 |
| D | Task 7 | Task 6 완료 후 |
| E | Task 8 | 최종 (모두 완료 후) |

### 5.3 난이도별 분류

| 난이도 | Task | 적합 대상 |
|--------|------|----------|
| ★☆☆☆☆ | 0, 2-1, 2-2, 2-4, 2-5, 3, 5 | 입문자 |
| ★★☆☆☆ | 1, 2-3, 4, 4-1, 6, 8 | 초급 개발자 |
| ★★★☆☆ | 7 | 중급 개발자 |

### 5.4 예상 소요 시간

| Task | 예상 시간 | 담당자 |
|------|----------|--------|
| Task 0: 홈탭 가로 스크롤 원인 확인 | 10분 | |
| Task 1: 루트 레이아웃 Flexbox 변경 | 20분 | |
| Task 2-1: 홈탭 min-h-screen 제거 | 5분 | |
| Task 2-2: 메모탭 min-h-screen 제거 | 5분 | |
| Task 2-3: 할일탭 min-h-screen/pb-20 제거 | 5분 | |
| Task 2-4: 설정탭 min-h-screen 제거 | 5분 | |
| Task 2-5: 알림탭 min-h-screen 제거 | 5분 | |
| Task 3: 전역 가로 오버플로우 숨김 | 10분 | |
| Task 4: FilterTabs 스크롤 영역 개선 | 15분 | |
| Task 4-1: 홈탭 가로 스크롤 수정 (조건부) | 15분 | |
| Task 5: SwipeableCard touch-action 추가 | 5분 | |
| Task 6: SwipeableCard startY 추가 | 10분 | |
| Task 7: SwipeableCard preventDefault 추가 | 20분 | |
| Task 8: 통합 테스트 | 30분 | |
| **총계** | **약 2시간 40분** | |

### 5.5 권장 작업 순서

**0단계 (1명, 10분) - 필수 사전 작업**
- Task 0: 홈탭 가로 스크롤 원인 확인
- 결과에 따라 Task 4-1 수행 여부 결정

**1단계 (1명, 20분)**
- Task 1: 루트 레이아웃 수정 (필수 선행)

**2단계 (최대 5명 병렬, 각 5분)**
- Task 2-1 ~ 2-5: 각 페이지 min-h-screen 제거

**3단계 (최대 5명 병렬, 10~20분)**
- Task 3: 전역 CSS 수정
- Task 4: FilterTabs 수정
- Task 4-1: 홈탭 가로 스크롤 수정 (Task 0 결과에 따라)
- Task 5: touch-action 추가
- Task 6: startY 추가

**4단계 (1명, 20분)**
- Task 7: preventDefault 로직 추가

**5단계 (전원 참여, 30분)**
- Task 8: 통합 테스트

---

## 6. 관련 파일 목록

### 수정 필요 파일 (확정)
| # | 파일 | 관련 Task |
|---|------|----------|
| 1 | `src/routes/+layout.svelte` | Task 1 |
| 2 | `src/routes/+page.svelte` | Task 2-1, Task 4-1 |
| 3 | `src/routes/memos/+page.svelte` | Task 2-2 |
| 4 | `src/routes/todos/+page.svelte` | Task 2-3 |
| 5 | `src/routes/settings/+page.svelte` | Task 2-4 |
| 6 | `src/routes/notifications/+page.svelte` | Task 2-5 |
| 7 | `src/lib/components/memo/SwipeableCard.svelte` | Task 5, 6, 7 |
| 8 | `src/lib/components/layout/FilterTabs.svelte` | Task 4 |
| 9 | `src/app.css` | Task 3 |

### 수정 가능 파일 (Task 0 결과에 따라)
| # | 파일 | 관련 Task | 조건 |
|---|------|----------|------|
| 10 | `src/lib/components/memo/QuickMemoInput.svelte` | Task 4-1 | 케이스 B |
| 11 | `src/lib/components/layout/UnifiedHeader.svelte` | Task 4-1 | 케이스 C |

### 확인 필요 파일 (변경 없음, 참조용)
| # | 파일 | 용도 |
|---|------|------|
| 1 | `src/lib/components/BottomNav.svelte` | 레이아웃 구조 확인 |
| 2 | `src/lib/components/memo/MemoCard.svelte` | SwipeableCard 사용 위치 확인 |

---

## 7. 검토 이력

| 일자 | 버전 | 변경 내용 |
|------|------|----------|
| 최초 작성 | v1.0 | 3개 Task로 구성된 초기 계획 |
| 세분화 | v2.0 | 12개 세부 Task로 분리, 업무 분배용 |
| 검토 보완 | v3.0 | Task 0, Task 4-1 추가, 테스트 체크리스트 보강, 홈탭/메모탭 혼동 이슈 명시 |
| 구현 완료 | v4.0 | Task 0~7 구현 완료, Task 4-1 불필요로 판정 |
| **문서 분리** | v4.1 | 수동 테스트 체크리스트를 `MANUAL-TESTS.md`로 분리 |

---

## 8. 구현 완료 내역

### 완료된 수정 사항

| Task | 파일 | 변경 내용 | 상태 |
|------|------|----------|------|
| Task 0 | - | 홈탭 가로 스크롤 원인 분석 (전역 CSS 문제) | ✅ 완료 |
| Task 1 | `+layout.svelte` | flex flex-col 추가, main 태그로 children 감싸기 | ✅ 완료 |
| Task 2-1 | `+page.svelte` | min-h-screen 제거 | ✅ 완료 |
| Task 2-2 | `memos/+page.svelte` | min-h-screen 제거 | ✅ 완료 |
| Task 2-3 | `todos/+page.svelte` | min-h-screen pb-20 제거 | ✅ 완료 |
| Task 2-4 | `settings/+page.svelte` | min-h-screen 제거 | ✅ 완료 |
| Task 2-5 | `notifications/+page.svelte` | min-h-screen 제거 | ✅ 완료 |
| Task 3 | `app.css` | html, body에 overflow-x: hidden, max-width: 100vw 추가 | ✅ 완료 |
| Task 4 | `FilterTabs.svelte` | overflow-y-hidden, -mx-4 px-4 추가 | ✅ 완료 |
| Task 4-1 | - | Task 3으로 해결되어 불필요 | ⏭️ 스킵 |
| Task 5 | `SwipeableCard.svelte` | touch-action: pan-y 추가 | ✅ 완료 |
| Task 6 | `SwipeableCard.svelte` | startY 변수 추가, touchstart에서 Y좌표 저장 | ✅ 완료 |
| Task 7 | `SwipeableCard.svelte` | touchmove에서 preventDefault 로직 추가 | ✅ 완료 |
| Task 8 | `MANUAL-TESTS.md` | 테스트 체크리스트 별도 문서로 분리 완료 | 📋 테스트 준비 완료 |
