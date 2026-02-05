# 하단 네비게이션 꿈틀거림 수정 계획

> 상태: 완료
> 작성일: 2026-02-05

---

## 현상

- 탭 전환 시 하단 네비게이션이 미세하게 "꿈틀"거림
- 애니메이션 문제가 아닌, 탭별 레이아웃 차이로 인해 네비 위치가 미세하게 다름
- 특정 탭으로 전환 시 순간적으로 위치 차이가 보임

---

## 원인 분석

### 원인 1: 스크롤바 토글에 의한 뷰포트 폭 변동 (주원인)

**파일:** `src/app.css:98-102`

```css
html,
body {
    overflow-x: hidden;
    max-width: 100vw;
}
```

`overflow-y`가 제어되지 않아 탭별 콘텐츠 높이에 따라 스크롤바가 나타났다 사라짐.

| 탭 | 콘텐츠 높이 | 스크롤바 | 뷰포트 폭 |
|----|------------|---------|----------|
| 홈 | 메모 적으면 짧음 | 없음 | 넓음 |
| 메모 | 필터+그리드 | 있음 | ~15px 좁음 |
| 할일 | sticky 3단 + 리스트 | 있음 | ~15px 좁음 |
| 설정 | Footer까지 김 | 있음 | ~15px 좁음 |

BottomNav는 `fixed left-0 right-0`이므로 뷰포트에 맞춰 폭이 변하고, 내부 `justify-around` 아이콘들이 **수평으로 미세 이동**.

### 원인 2: View Transition cross-fade가 차이를 증폭

**파일:** `src/lib/components/BottomNav.svelte:25`

```svelte
style="view-transition-name: bottom-nav; padding-bottom: env(safe-area-inset-bottom, 0px);"
```

BottomNav에 `view-transition-name: bottom-nav`가 설정되어 있지만, 전용 애니메이션 룰이 없어 기본 cross-fade 적용.

전환 시 **이전 탭의 네비 스냅샷**(넓은 폭)과 **새 탭의 네비**(좁은 폭)가 0.35초간 겹쳐 보이며, 원래는 눈치 못 챌 ~15px 차이가 "꿈틀"로 체감됨.

### 원인 3: root scale 애니메이션

**파일:** `src/app.css:384-394`

```css
::view-transition-old(root) {
    animation-name: fade-out, scale-down;  /* scale(1.04)로 확대 */
}
::view-transition-new(root) {
    animation-name: fade-in, scale-up;     /* scale(0.96)에서 시작 */
}
```

BottomNav는 별도 transition-name으로 분리되어 root scale에서 제외되지만, cross-fade 중에 전체 레이아웃이 scale되면서 시각적 불안정을 더함.

---

## 수정 사항

### 1. scrollbar-gutter: stable 추가

**파일:** `src/app.css`

```css
/* Before */
html,
body {
    overflow-x: hidden;
    max-width: 100vw;
}

/* After */
html {
    overflow-x: hidden;
    max-width: 100vw;
    scrollbar-gutter: stable;
}

body {
    overflow-x: hidden;
    max-width: 100vw;
}
```

**효과:** 스크롤바 유무와 관계없이 항상 스크롤바 공간 확보 → 뷰포트 폭 고정

### 2. BottomNav view-transition-name 제거

**파일:** `src/lib/components/BottomNav.svelte`

```svelte
<!-- Before -->
style="view-transition-name: bottom-nav; padding-bottom: env(safe-area-inset-bottom, 0px);"

<!-- After -->
style="padding-bottom: env(safe-area-inset-bottom, 0px);"
```

**효과:** 네비가 cross-fade 대상에서 빠져 위치 변화가 노출되지 않음

### 3. root 전환에서 scale 제거, fade만 유지

**파일:** `src/app.css`

```css
/* Before */
::view-transition-old(root),
::view-transition-new(root) {
    animation-duration: 0.35s;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(root) {
    animation-name: fade-out, scale-down;
}

::view-transition-new(root) {
    animation-name: fade-in, scale-up;
}

/* After */
::view-transition-old(root),
::view-transition-new(root) {
    animation-duration: 0.25s;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

::view-transition-old(root) {
    animation-name: fade-out;
}

::view-transition-new(root) {
    animation-name: fade-in;
}
```

**효과:** 전환 중 레이아웃 안정성 확보, 전환 속도 단축 (0.35s → 0.25s)

---

## 적용 결과

| # | 수정 | 효과 |
|---|------|------|
| 1 | `scrollbar-gutter: stable` | 근본 원인 해결 (뷰포트 폭 고정) |
| 2 | `view-transition-name` 제거 | 전환 시 시각 안정성 (필요시 롤백 가능) |
| 3 | scale 애니메이션 제거 | 전환 중 레이아웃 안정성 |

**커밋:** `0d8c2da` fix: bottom nav flickering

---

## 롤백 가이드

2번 수정이 불필요하다 판단되면:

```svelte
<!-- src/lib/components/BottomNav.svelte:25 -->
style="view-transition-name: bottom-nav; padding-bottom: env(safe-area-inset-bottom, 0px);"
```

`view-transition-name: bottom-nav;`를 다시 추가.
