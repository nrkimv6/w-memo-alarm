# 상하 스크롤 시 좌우 스와이프 오동작 방지 (Direction Lock)

> 작성일: 2026-03-30
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/4 (0%)
> 요약: 모바일에서 상하 스크롤 시 손가락의 미세한 좌우 이동이 스와이프(핀/삭제)를 트리거하는 문제. SwipeableCard에 방향 잠금(direction lock) 로직을 추가하여 스크롤과 스와이프를 분리한다.

---

## 개요

현재 `SwipeableCard.svelte`는 touchstart 즉시 드래그 모드에 진입하고, touchmove에서 수평 이동량이 수직보다 크면 바로 `currentX`를 갱신한다. 이로 인해 상하 스크롤 중 손가락이 살짝 좌우로 움직이기만 해도 카드가 밀리고, 스크롤이 끝난 시점에 `SWIPE_THRESHOLD(80px)`를 넘으면 핀/삭제가 실행된다.

**해결책**: 터치 이동 초기(10px 이상 이동 시점)에 수평/수직 우세 방향을 1회 판별하여 잠금. 수직으로 잠기면 해당 터치 세션 동안 스와이프를 완전히 무시한다.

## 기술적 고려사항

- `touch-action: pan-y`는 브라우저 기본 수직 스크롤을 허용하지만, JS 레벨에서 `currentX` 업데이트를 막지는 않음 → JS 방향 잠금 필수
- 방향 결정 임계값 10px는 기존 코드에서 이미 사용 중인 값으로 일관성 유지
- `directionLocked`를 `$state`로 관리하여 Svelte 5 반응성 유지

---

## TODO

### Phase 1: 방향 잠금 구현

1. - [ ] **SwipeableCard에 direction lock 로직 추가** — 수직 스크롤 시 스와이프 차단
   - [ ] `src/lib/components/memo/SwipeableCard.svelte`: `directionLocked` 상태 변수 추가 (`'none' | 'horizontal' | 'vertical'`)
   - [ ] `src/lib/components/memo/SwipeableCard.svelte`: `handleTouchStart`에서 `directionLocked = 'none'` 초기화
   - [ ] `src/lib/components/memo/SwipeableCard.svelte`: `handleTouchMove`에서 방향 감지 로직 — 10px 이상 이동 시 우세 방향으로 잠금, `vertical`이면 `currentX` 업데이트 스킵, `horizontal`이면 기존 스와이프 처리
   - [ ] `src/lib/components/memo/SwipeableCard.svelte`: `handleTouchEnd`에서 `directionLocked = 'none'` 초기화

### Phase 2: 빌드 검증

2. - [ ] **빌드 성공 확인** — `npm run build` 에러 없음
   - [ ] 빌드 실행 후 에러 없이 완료 확인

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

*상태: 초안 | 진행률: 0/4 (0%)*
