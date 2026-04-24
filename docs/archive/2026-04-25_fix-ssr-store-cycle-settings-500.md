# 배포 후 `/settings` 500 및 `favicon.ico` 연쇄 오류 수정

> 작성일: 2026-04-25
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 요약: 배포 후 `/settings` 진입 시 SSR 단계에서 store 순환 초기화가 터져 전체 페이지가 500으로 실패했다. `memosStore -> notificationStore` 정적 import를 지연 로드로 바꿔 초기화 순환을 끊고, `/favicon.ico`는 `/favicon.png`로 리다이렉트해 브라우저 기본 요청도 정리했다.

---

## 증상

- 배포 후 `https://memo.woory.day/settings` 접속 시 `500 Internal Server Error`
- 같은 시점에 `https://memo.woory.day/favicon.ico` 요청도 `500`
- `/favicon.ico` 자체가 깨진 것이 아니라, 404/에러 페이지 렌더 단계도 같은 SSR 예외에 말려 같이 500으로 번지는 상태

## 원인

- `src/lib/stores/notifications.svelte.ts`는 모듈 초기화 시점에 `memosStore`를 참조한다.
- 동시에 `src/lib/stores/memos.svelte.ts`가 `notificationStore`를 정적 import하고 있어 SSR 번들 로드 시 순환 참조가 형성됐다.
- Cloudflare SSR에서 해당 모듈 그래프를 평가하는 순간 `ReferenceError: Cannot access 'memosStore' before initialization`가 발생했고, 이 예외가 `/settings`뿐 아니라 에러 페이지 렌더 전체를 깨뜨렸다.

## 수정 내용

### 1. store 초기화 순환 제거

- `src/lib/stores/memos.svelte.ts`
  - `notificationStore` 정적 import 제거
  - `getNotificationStore()` 지연 로드 helper 추가
  - Service Worker 알림 등록/갱신/제거 시점에만 `await import('./notifications.svelte')`로 로드

### 2. 브라우저 기본 favicon 요청 정리

- `src/routes/favicon.ico/+server.ts`
  - `GET`, `HEAD` 요청을 `/favicon.png`로 `308` 리다이렉트
  - 배포 후 브라우저가 기본적으로 때리는 `/favicon.ico` 요청이 404/500으로 남지 않도록 보강

## 검증

- SSR 스모크 테스트
  - `GET /` → `200`
  - `GET /settings` → `200`
  - `GET /favicon.ico` → `308` (`/favicon.png`)
- `npm run check`
  - 오류 `0`
  - 기존 Svelte a11y/runes 경고만 남음

## 비고

- 로컬 `npm run build`는 이 수정과 별개로 Windows 환경에서 `.svelte-kit/cloudflare` 정리 단계 `EPERM`이 간헐적으로 발생한다.
- 이번 수정의 핵심 장애 원인인 SSR store 순환 예외는 별도 SSR 응답 검증으로 재현 및 해소를 확인했다.
