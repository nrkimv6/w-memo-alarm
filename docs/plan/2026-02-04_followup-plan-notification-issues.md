# 후속 작업 계획서: 알림 시스템 잔여 이슈

- **날짜**: 2026-02-04
- **관련 수정**: `fix-report-android-pwa-notification-click.md`

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

### 수정 방안

`src/routes/+layout.svelte`의 `onMount` 내에 리스너 등록 추가:

```typescript
import { setupNotificationListeners } from '$lib/utils/capacitor';

onMount(async () => {
    // ... 기존 초기화 코드 ...

    // Capacitor 네이티브 알림 클릭 리스너 설정
    setupNotificationListeners((memoId, url) => {
        if (url) {
            // autoOpen이 활성화된 경우 외부 URL 열기
            window.open(url, '_blank');
        }
        // 해당 메모로 이동
        goto(`/?memo=${memoId}`);
    });
});
```

### 작업 항목
- [ ] `+layout.svelte`에 `setupNotificationListeners` 호출 추가
- [ ] 콜백에서 `goto('/?memo=${memoId}')` 로 메모 상세 이동 처리
- [ ] `autoOpen` URL이 있을 경우 외부 브라우저(`@capacitor/browser`)로 열기
- [ ] iOS 네이티브 빌드에서 알림 클릭 동작 테스트
- [ ] Android 네이티브 빌드에서 알림 클릭 동작 테스트

---

## Issue 2: 포그라운드 `window.open()` 중복 호출 가능성

### 상태: MEDIUM — 동작하지만 개선 권장

### 현상
`notifications.svelte.ts:207,258`에서 `autoOpen` 활성화 시 `window.open(memo.url, '_blank')`를 호출한다. 이 코드는 **포그라운드 setInterval 체크**에서만 실행되며, 서비스 워커의 `notificationclick`에서도 외부 URL을 `openWindow()`로 열도록 수정되었으므로 **동일 URL이 두 번 열릴 수 있다.**

### 영향 범위
- 앱이 포그라운드 상태일 때 알림이 발생하고 사용자가 알림을 클릭하는 경우

### 수정 방안

두 가지 접근 중 택 1:

**방안 A: 포그라운드 `window.open()` 제거**
서비스 워커의 `notificationclick`에서 외부 URL 열기를 담당하므로, 포그라운드 코드에서는 제거.

**방안 B: 서비스 워커에서 외부 URL 열기 제거**
포그라운드 코드가 확실히 실행되는 경우에만 `window.open()` 사용. 단, 백그라운드 알림에서는 동작 안 함.

### 권장: 방안 A
서비스 워커가 포그라운드/백그라운드 모두 커버하므로 포그라운드 `window.open()`을 제거하는 것이 깔끔하다.

### 작업 항목
- [ ] `notifications.svelte.ts`에서 `autoOpen` 관련 `window.open()` 호출 제거 또는 조건부 실행
- [ ] 서비스 워커의 외부 URL 열기가 모든 시나리오에서 동작하는지 확인
- [ ] 포그라운드/백그라운드 전환 시나리오 테스트

---

## Issue 3: iOS PWA Web Push 제한 사항 대응

### 상태: LOW — 플랫폼 제한

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
현재 수정에서 `focus().then(c => c.navigate(appUrl))`을 사용하지만, `navigate()`가 실패할 경우(예: 서비스 워커가 페이지를 제어하지 않는 경우) catch 처리가 없다.

### 수정 방안

```typescript
return (client as WindowClient).focus().then((focusedClient) => {
    return focusedClient.navigate(appUrl);
}).catch(() => {
    // navigate 실패 시 새 창으로 fallback
    return sw.clients.openWindow(appUrl);
});
```

### 작업 항목
- [ ] `navigate()` 실패 시 `openWindow()` fallback 추가
- [ ] FCM 서비스 워커에도 동일 패턴 적용

---

## Issue 5: `?memo=` 파라미터 처리 시 `memosStore` 미초기화 대기 로직 개선

### 상태: LOW — 동작하지만 개선 가능

### 현상
현재 `setTimeout(tryOpenMemo, 200)` 으로 폴링하며 `memosStore` 초기화를 기다린다. 최대 재시도 횟수가 없고, `memosStore.initialized`가 `true`인데 메모를 못 찾는 경우(삭제된 메모)에 대한 사용자 피드백이 없다.

### 수정 방안
- 최대 재시도 횟수 제한 (예: 15회 = 3초)
- 메모를 찾을 수 없는 경우 토스트 메시지 표시

### 작업 항목
- [ ] 폴링 최대 횟수 제한 추가
- [ ] 메모 미발견 시 "해당 메모를 찾을 수 없습니다" 토스트 표시
- [ ] `memosStore.initialized` 상태를 Promise 기반으로 대기하는 방식 검토

---

## 우선순위 정리

| 순위 | Issue | 심각도 | 난이도 |
|------|-------|--------|--------|
| 1 | Capacitor 알림 클릭 리스너 미연결 | CRITICAL | 낮음 |
| 2 | 포그라운드 `window.open()` 중복 | MEDIUM | 낮음 |
| 3 | `navigate()` 실패 시 fallback | LOW | 낮음 |
| 4 | `?memo=` 폴링 로직 개선 | LOW | 낮음 |
| 5 | iOS PWA 제한 대응 | LOW | 높음 (플랫폼 제한) |
