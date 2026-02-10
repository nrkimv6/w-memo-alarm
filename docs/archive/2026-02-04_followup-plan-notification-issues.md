# 후속 작업 계획서: 알림 시스템 잔여 이슈

> 완료일: 2026-02-11
> 아카이브됨
> 진행률: 4/4 (100%)

- **날짜**: 2026-02-04
- **관련 수정**: `fix-report-android-pwa-notification-click.md`
- **대상 프로젝트**: memo-alarm

---

## 개요

Android PWA 알림 클릭 수정 과정에서 발견된 유사 이슈 및 플랫폼별 개선 사항을 정리한다.

---

## Issue 1: Capacitor 네이티브 알림 클릭 리스너 미연결

### 상태: CRITICAL — 미구현

### 현상
`setupNotificationListeners()`가 `src/lib/utils/capacitor.ts:176`에 정의되어 있으나, **`+layout.svelte`에서 호출되지 않는다.** iOS/Android 네이티브 앱에서 Capacitor LocalNotifications를 통해 표시된 알림을 탭해도 아무 동작이 없다.

### 영향 범위
- iOS Capacitor 네이티브 빌드
- Android Capacitor 네이티브 빌드

### 구체적 변경 내용

**파일: `src/routes/+layout.svelte`**

1. import 추가 (16행 부근, 기존 `setupShareIntentListener` import에 `setupNotificationListeners` 추가)
   - 현재: `import { setupShareIntentListener, shareIntentToQueryParams, type ShareIntentData } from "$lib/utils/capacitor";`
   - 변경: `import { setupShareIntentListener, setupNotificationListeners, shareIntentToQueryParams, type ShareIntentData } from "$lib/utils/capacitor";`

2. onMount 내 (115행 `setupShareIntentListener` 호출 아래) 리스너 등록 추가
   - `setupNotificationListeners` 콜백에서 `goto(`/?memo=${memoId}`)` 호출
   - `url` 파라미터가 있으면 `window.open(url, '_blank')` 호출

### 작업 항목
- [x] `+layout.svelte` 16행: import에 `setupNotificationListeners` 추가
- [x] `+layout.svelte` 115행 아래: `setupNotificationListeners((memoId, url) => { ... })` 호출 추가
- [x] 콜백 내부: url이 있으면 `window.open(url, '_blank')`, 이후 `goto(`/?memo=${memoId}`)` 호출
- [ ] iOS 네이티브 빌드에서 알림 클릭 동작 테스트
- [ ] Android 네이티브 빌드에서 알림 클릭 동작 테스트

---

## Issue 2: 포그라운드 `window.open()` 중복 호출 가능성

### 상태: MEDIUM — 동작하지만 개선 권장

### 현상
`notifications.svelte.ts`의 두 곳에서 `autoOpen` 활성화 시 `window.open(memo.url, '_blank')`를 호출:
- **214~216행**: snoozed 알림 트리거 시
- **264~267행**: 정규 알림 트리거 시

서비스 워커 `notificationclick`(service-worker.ts:536~538)에서도 외부 URL을 `openWindow()`로 열므로, 포그라운드 상태에서 알림 클릭 시 **동일 URL이 두 번 열림**.

### 영향 범위
- 앱이 포그라운드 상태일 때 알림이 발생하고 사용자가 알림을 클릭하는 경우

### 권장: 방안 A — 포그라운드 `window.open()` 제거
서비스 워커가 포그라운드/백그라운드 모두 커버하므로 포그라운드 코드에서 제거.

### 구체적 변경 내용

**파일: `src/lib/stores/notifications.svelte.ts`**

1. 214~216행 제거: snoozed 알림의 `window.open` + `incrementOpenCount` 블록
2. 264~267행 제거: 정규 알림의 `window.open` + `incrementOpenCount` 블록
3. 단, `incrementOpenCount`는 서비스 워커에서 호출 불가하므로, 메인 스레드에서 `notificationclick` 메시지 수신 시 처리하는 로직이 필요 (service-worker.ts에서 `postMessage`로 전달)

### 작업 항목
- [x] `notifications.svelte.ts` 214~216행: snoozed 알림의 `window.open` + `incrementOpenCount` 제거
- [x] `notifications.svelte.ts` 264~267행: 정규 알림의 `window.open` + `incrementOpenCount` 제거
- [x] `service-worker.ts` notificationclick 핸들러(509행~): 외부 URL 열기 후 `postMessage({ type: 'AUTO_OPEN_TRIGGERED', memoId })` 전달 추가
- [x] `notifications.svelte.ts`에서 SW `AUTO_OPEN_TRIGGERED` 메시지 수신 시 `incrementOpenCount` 호출하는 리스너 추가
- [ ] 포그라운드 상태에서 알림 발생 → 클릭 시 URL이 1번만 열리는지 테스트
- [ ] 백그라운드 상태에서 알림 클릭 시 URL 열기 정상 동작 테스트

---

## Issue 3: iOS PWA Web Push 제한 사항 대응

### 상태: LOW — 플랫폼 제한 (보류 권장)

### 현상
iOS Safari PWA(16.4+)에서 Web Push를 지원하지만 다음 제한이 있다:
- `clients.openWindow()`가 Safari로 빠져나감 (standalone 모드 이탈)
- 백그라운드 서비스 워커 실행 시간 제한이 더 엄격
- `WindowClient.navigate()` 동작은 하지만 일부 버전에서 불안정

### 영향 범위
- iOS 16.4+ Safari에서 PWA로 설치한 경우

### 수정 방안

iOS PWA에서의 알림 클릭은 현재 수정으로 기본 동작은 하지만, 외부 URL 열기 시 Safari로 전환되는 것은 iOS 플랫폼 제한이다. 근본적 해결은 Capacitor 네이티브 빌드 사용.

### 작업 항목
- [ ] iOS PWA 16.4+에서 알림 클릭 동작 실제 테스트
- [ ] 외부 URL 열기 시 사용자에게 "Safari에서 열립니다" 안내 추가 검토
- [ ] iOS 사용자에게는 네이티브 앱 설치 유도 검토

---

## Issue 4: 서비스 워커 `notificationclick`에서 `navigate()` 실패 시 fallback 없음

### 상태: LOW — 방어 코드 부재

### 현상
- `service-worker.ts` 535행: `focus().then(c => c.navigate(appUrl))` — catch 없음
- `static/firebase-messaging-sw.js` 51행: `client.focus().then(c => c.navigate(appUrl))` — catch 없음

`navigate()`가 실패하면(서비스 워커가 페이지를 제어하지 않는 경우) 알림 클릭이 무시됨.

### 구체적 변경 내용

**파일: `src/service-worker.ts` (535행 부근)**
- `focusedClient.navigate(appUrl)` 뒤에 `.catch(() => sw.clients.openWindow(appUrl))` 체인 추가

**파일: `static/firebase-messaging-sw.js` (51행 부근)**
- `focusedClient.navigate(appUrl)` 뒤에 `.catch(() => clients.openWindow(appUrl))` 체인 추가

### 작업 항목
- [x] `src/service-worker.ts` 541행: `focusedClient.navigate(appUrl)` 뒤에 `.catch(() => sw.clients.openWindow(appUrl))` 추가
- [x] `static/firebase-messaging-sw.js` 52행: `focusedClient.navigate(appUrl)` 뒤에 `.catch(() => clients.openWindow(appUrl))` 추가

---

## Issue 5: `?memo=` 파라미터 처리 시 `memosStore` 미초기화 대기 로직 개선

### 상태: LOW — 동작하지만 개선 가능

### 현상
`src/routes/+page.svelte` 115~124행에서 `setTimeout(tryOpenMemo, 200)`으로 폴링.
- 최대 재시도 횟수 제한 없음 (무한 폴링 가능)
- `memosStore.initialized === true`인데 메모를 못 찾는 경우(삭제된 메모) 사용자 피드백 없음

### 구체적 변경 내용

**파일: `src/routes/+page.svelte` (115~124행)**

1. `tryOpenMemo` 함수에 `retryCount` 변수 추가 (최대 15회 = 3초)
2. 재시도 초과 또는 `initialized === true && memo 없음` 시 토스트 메시지 표시
3. 토스트: `$lib/components/ui`의 Toast 유틸 사용 (이미 import 가능)

### 작업 항목
- [x] `src/routes/+page.svelte` 115행: `let retryCount = 0;` 추가
- [x] 121행: `setTimeout` 전에 `retryCount++; if (retryCount > 15) { /* 토스트: 메모를 찾을 수 없습니다 */ return; }` 조건 추가
- [x] 120행: `else if (!memosStore.initialized)` → `else if (!memosStore.initialized && retryCount < 15)` 조건 변경
- [x] 120행 else 분기 추가: `memosStore.initialized === true && !memo` 시 "해당 메모를 찾을 수 없습니다" 토스트 표시

---

## 우선순위 정리

| 순위 | Issue | 심각도 | 난이도 | 대상 파일 |
|------|-------|--------|--------|-----------|
| 1 | Capacitor 알림 클릭 리스너 미연결 | CRITICAL | 낮음 | `+layout.svelte` |
| 2 | 포그라운드 `window.open()` 중복 | MEDIUM | 중간 | `notifications.svelte.ts`, `service-worker.ts` |
| 3 | `navigate()` 실패 시 fallback | LOW | 낮음 | `service-worker.ts`, `firebase-messaging-sw.js` |
| 4 | `?memo=` 폴링 로직 개선 | LOW | 낮음 | `+page.svelte` |
| 5 | iOS PWA 제한 대응 | LOW | 높음 | 보류 (플랫폼 제한) |

---

*상태: 구현완료 | 진행률: 4/4 (100%)*
