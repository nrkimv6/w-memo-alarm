# 상하 스크롤 시 좌우 스와이프 오동작 방지 (Direction Lock)

> 작성일: 2026-03-30
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/9 (0%)
> 요약: 모바일에서 상하 스크롤 시 손가락의 미세한 좌우 이동이 스와이프(핀/삭제)를 트리거하는 문제. SwipeableCard에 방향 잠금(direction lock) 로직을 추가하여 스크롤과 스와이프를 분리한다.

---

## 개요

현재 `SwipeableCard.svelte`는 touchstart 즉시 드래그 모드에 진입하고, touchmove에서 수평 이동량이 수직보다 크면 바로 `currentX`를 갱신한다. 이로 인해 상하 스크롤 중 손가락이 살짝 좌우로 움직이기만 해도 카드가 밀리고, 스크롤이 끝난 시점에 `SWIPE_THRESHOLD(80px)`를 넘으면 핀/삭제가 실행된다.

**해결책**: 터치 이동 초기(10px 이상 이동 시점)에 수평/수직 우세 방향을 1회 판별하여 잠금. 수직으로 잠기면 해당 터치 세션 동안 스와이프를 완전히 무시한다.

## 기술적 고려사항

- `touch-action: pan-y`는 브라우저 기본 수직 스크롤을 허용하지만, JS 레벨에서 `currentX` 업데이트를 막지는 않음 → JS 방향 잠금 필수
- 방향 결정 임계값 10px는 기존 코드에서 이미 사용 중인 값으로 일관성 유지
- `directionLocked`는 템플릿에서 참조하지 않으므로 일반 `let` 변수로 선언 (`$state` 불필요)

---

## TODO

### Phase 1: 방향 잠금 구현

1. - [ ] **direction lock 상태 변수 추가** — 터치 세션별 방향 기록
   - [ ] `src/lib/components/memo/SwipeableCard.svelte:16`: `let isDragging` 선언 뒤에 `let directionLocked: 'none' | 'horizontal' | 'vertical' = 'none';` 추가 (일반 `let`, `$state` 아님)

2. - [ ] **handleTouchStart 수정** — 터치 시작 시 방향 잠금 초기화
   - [ ] `src/lib/components/memo/SwipeableCard.svelte:22-26`: `handleTouchStart` 함수 내 `isDragging = true;` 뒤에 `directionLocked = 'none';` 추가

3. - [ ] **handleTouchMove 수정** — 방향 감지 후 잠금, 수직이면 스와이프 무시
   - [ ] `src/lib/components/memo/SwipeableCard.svelte:28-45`: `handleTouchMove` 함수 전면 교체. before: deltaX/deltaY 비교 후 항상 `currentX` 갱신. after: (1) `directionLocked === 'none'`일 때 `abs(delta) > 10`이면 우세 방향으로 잠금 후 `return` (2) `directionLocked === 'vertical'`이면 즉시 `return` (3) `directionLocked === 'horizontal'`이면 `e.preventDefault()` + `currentX` 갱신 + MAX_DRAG 제한

4. - [ ] **handleTouchEnd 수정** — 터치 종료 시 방향 잠금 초기화
   - [ ] `src/lib/components/memo/SwipeableCard.svelte:47-63`: `handleTouchEnd` 함수의 초기화 블록(L60-62)에 `directionLocked = 'none';` 추가

### Phase 2: 빌드 검증

5. - [ ] **빌드 성공 확인** — `npm run build` 에러 없음
   - [ ] `npm run build` 실행 후 에러 없이 완료 확인

---

## 검증

### 빌드 확인

```bash
npm run build
```

### 수동 테스트 (모바일 브라우저/에뮬레이터)

- 상하 스크롤 시 카드가 좌우로 밀리지 않는지 확인
- 의도적 좌우 스와이프(삭제/핀)가 정상 동작하는지 확인
- 대각선 터치 시 먼저 감지된 방향으로만 동작하는지 확인

---

*상태: 초안 | 진행률: 0/9 (0%)*
