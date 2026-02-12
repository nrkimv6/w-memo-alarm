# 수정 보고서: Android PWA 알림 클릭 시 앱이 열리지 않는 문제

- **날짜**: 2026-02-04
- **브랜치**: `claude/fix-pwa-notification-links-OH0X3`
- **커밋**: `fix: Android PWA 알림 클릭 시 앱이 열리지 않는 문제 수정`

---

## 1. 현상

Android PWA 환경에서 알림(Notification)을 탭하면 **알림만 사라지고 앱이 열리지 않는** 문제가 발생.

- 알림은 정상적으로 표시됨
- 알림을 탭하면 `notificationclick` 이벤트가 발생하여 알림은 닫힘
- 그러나 앱 창이 열리거나 포커스되지 않음

---

## 2. 원인 분석

### 2.1 `src/service-worker.ts` — 3개 버그

#### Bug A: `focus()` Promise 미대기 (CRITICAL)

`WindowClient.focus()`는 Promise를 반환하지만, 기존 코드에서는 이를 await/then 없이 바로 `navigate()`를 호출했다. Android Chrome에서는 focus가 완료되기 전에 navigate가 실행되어 **조용히 실패**한다.

```typescript
// 기존 (문제 코드)
(client as WindowClient).focus();
(client as WindowClient).navigate(url);  // focus 미완료 상태 → 실패
```

#### Bug B: `navigate()` 반환값 미반환 (CRITICAL)

`navigate()`의 반환 Promise를 `return`하지 않았기 때문에 `event.waitUntil()`에 전달된 Promise가 조기 완료되었다. 서비스 워커가 navigate 완료 전에 종료될 수 있다.

```typescript
// 기존 (문제 코드)
for (const client of clientList) {
    if (...) {
        (client as WindowClient).focus();
        (client as WindowClient).navigate(url);
        return;  // void 반환 → waitUntil이 기다릴 Promise 없음
    }
}
```

#### Bug C: 외부 URL로 `navigate()` 호출 (HIGH)

`WindowClient.navigate()`는 **same-origin URL만 허용**한다. 메모에 설정된 외부 URL(`https://example.com`)을 `navigate()`로 열려고 하면 보안 제한에 의해 실패한다.

### 2.2 `static/firebase-messaging-sw.js` — 1개 버그

#### Bug D: `navigate()` 누락 (HIGH)

FCM 푸시 알림 클릭 시, 이미 열린 창을 찾으면 `focus()`만 수행하고 **`navigate()`를 호출하지 않았다**. 앱이 포커스되지만 알림과 관련된 메모로 이동하지 않는다.

```typescript
// 기존 (문제 코드)
for (const client of clientList) {
    if (...) {
        return client.focus();  // focus만 하고 navigate 안 함
    }
}
```

### 2.3 `src/routes/+page.svelte` — 누락 기능

알림 클릭 시 `/?memo={memoId}` 경로로 네비게이트하도록 수정했지만, 기존 `+page.svelte`에는 `?memo=` 쿼리 파라미터를 처리하는 로직이 없었다.

---

## 3. 수정 내용

### 3.1 `src/service-worker.ts`

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| focus/navigate 체이닝 | `focus(); navigate(url);` | `focus().then(c => c.navigate(appUrl))` |
| 반환값 | `return;` (void) | `return client.focus().then(...)` (Promise) |
| URL 처리 | 외부 URL을 `navigate()`로 호출 | 앱 내 URL(`/?memo={id}`)과 외부 URL 분리 |
| 외부 URL | `navigate(externalUrl)` → 실패 | `openWindow(externalUrl)` → 새 브라우저 탭 |

**수정된 URL 결정 로직:**
- 병합 알림(`merged`): `appUrl = '/'`
- 단일 알림(`memoId` 존재): `appUrl = '/?memo={memoId}'`
- 외부 URL(`http://...`로 시작): `openWindow()`로 별도 처리

### 3.2 `static/firebase-messaging-sw.js`

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 기존 창 처리 | `client.focus()` 만 수행 | `client.focus().then(c => c.navigate(appUrl))` |
| 새 창 열기 | `clients.openWindow` 존재 체크 후 호출 | 직접 `clients.openWindow(appUrl)` 호출 |

### 3.3 `src/routes/+page.svelte`

**추가된 로직 (onMount 내):**
1. `URLSearchParams`로 `?memo=` 파라미터 추출
2. `history.replaceState()`로 URL에서 파라미터 제거 (뒤로가기 재진입 방지)
3. `memosStore.getById(memoId)`로 메모 조회
4. `memosStore` 미초기화 시 200ms 간격으로 재시도
5. 메모 발견 시 `MemoDetailModal` 자동 열기

---

## 4. 수정 파일 목록

| 파일 | 변경 유형 | 변경 라인 |
|------|-----------|-----------|
| `src/service-worker.ts` | 수정 | notificationclick 핸들러 전체 재작성 |
| `static/firebase-messaging-sw.js` | 수정 | notificationclick 핸들러 수정 |
| `src/routes/+page.svelte` | 수정 | onMount에 ?memo= 파라미터 처리 추가 |

---

## 5. 플랫폼별 영향 분석

| 플랫폼 | 영향 | 비고 |
|--------|------|------|
| Android PWA (Chrome) | 핵심 수정 대상 | 알림 클릭 → 앱 열기 정상 동작 |
| 데스크톱 웹 (Chrome/Firefox) | 긍정적 | Promise 체이닝으로 안정성 향상 |
| iOS PWA (Safari 16.4+) | 영향 없음 | Web Push 자체가 제한적. 악화 요소 없음 |
| iOS/Android Capacitor 네이티브 | 영향 없음 | 네이티브는 별도 경로 (`@capacitor/local-notifications`) |

---

## 6. 테스트 체크리스트

- [x] Android PWA: 알림 탭 → 앱 열림 + 해당 메모 상세 모달 표시
- [x] Android PWA: 앱이 이미 열린 상태에서 알림 탭 → 앱 포커스 + 메모 이동
- [x] Android PWA: 외부 URL이 있는 메모 알림 탭 → 브라우저에서 외부 URL 열림
- [x] Android PWA: 병합 알림(다건) 탭 → 홈 화면으로 이동
- [x] Android PWA: FCM 푸시 알림 탭 → 앱 열림 + 해당 메모 표시
- [x] 데스크톱 Chrome: 기존 알림 동작이 깨지지 않음
- [ ] iOS Safari PWA: 알림 동작 확인 (iOS 16.4+ 해당 시)
