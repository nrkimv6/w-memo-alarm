# memo-alarm FCM 토큰 등록 Race Condition 수정

> 작성일: 2026-01-22
> 대상 프로젝트: memo-alarm
> 우선순위: P0 (긴급 - 기능 불가)
> 상태: ✅ 완료 (2026-01-22)

---

## 문제 요약

**파일**: `src/routes/+layout.svelte` (44-54줄)

**문제**: `authStore.initialize()`가 비동기인데 1초만 기다리고 FCM 초기화 시도

**결과**: FCM 토큰이 등록되지 않아 **백그라운드 알림 작동 안 함**

---

## 원인 분석

### Race Condition 발생

```typescript
onMount(() => {
    authStore.initialize();  // ❌ 비동기 함수인데 await 없음

    // 1초 후 FCM 초기화 시도
    setTimeout(() => {
        initFCM();  // authStore.initialize() 완료 전에 실행될 수 있음
    }, 1000);
});
```

### 실제 동작 흐름

```
t=0ms:   onMount 실행
t=0ms:   authStore.initialize() 시작 (비동기)
t=1000ms: initFCM() 실행
           ↓
        if (authStore.isAuthenticated) {  // ❌ false (아직 초기화 안 됨)
            registerFCMToken();  // 실행 안 됨!
        }
t=1500ms: authStore.initialize() 완료 (너무 늦음)
```

### 문제점

1. **하드코딩된 딜레이**: 1초가 충분하다는 보장 없음
2. **초기화 상태 무시**: auth 초기화 완료를 기다리지 않음
3. **네트워크 지연 시**: auth 초기화가 1초 이상 걸리면 실패

---

## 해결 방법

### await로 순서 보장

```typescript
onMount(async () => {  // ✅ async 추가
    themeStore.init();
    settingsStore.init();
    notificationStore.init();

    // authStore 초기화 완료 후 FCM 등록
    await authStore.initialize();  // ✅ 완료 대기
    initFCM();  // ✅ auth 초기화 후 실행
});
```

### 수정 후 동작 흐름

```
t=0ms:    onMount 실행
t=0ms:    authStore.initialize() 시작
          (await로 완료 대기)
t=1500ms: authStore.initialize() 완료
t=1500ms: initFCM() 실행
           ↓
        if (authStore.isAuthenticated) {  // ✅ true
            registerFCMToken();  // ✅ 정상 실행
        }
```

---

## 구현 내용

### 수정 파일

**파일**: `src/routes/+layout.svelte`

```diff
- onMount(() => {
+ onMount(async () => {
      themeStore.init();
      settingsStore.init();
      notificationStore.init();
-     authStore.initialize();
-
-     // authStore 초기화 후 FCM 등록 (약간의 딜레이)
-     setTimeout(() => {
-         initFCM();
-     }, 1000);
+
+     // authStore 초기화 완료 후 FCM 등록
+     await authStore.initialize();
+     initFCM();
  });
```

---

## 개선 효과

### Before (Race Condition)

| 시나리오 | 결과 |
|---------|------|
| Auth 초기화 < 1초 | ✅ 정상 작동 (운 좋음) |
| Auth 초기화 > 1초 | ❌ FCM 등록 실패 (백그라운드 알림 안 됨) |
| 네트워크 느림 | ❌ FCM 등록 실패 |

### After (순서 보장)

| 시나리오 | 결과 |
|---------|------|
| Auth 초기화 < 1초 | ✅ 정상 작동 |
| Auth 초기화 > 1초 | ✅ 정상 작동 (기다림) |
| 네트워크 느림 | ✅ 정상 작동 (기다림) |

---

## 테스트 시나리오

### 1. 정상 로그인
- [x] 로그인 → auth 초기화 완료 → FCM 토큰 등록 성공

### 2. 네트워크 지연
- [x] 느린 네트워크 환경 → auth 초기화 2초 소요 → FCM 토큰 정상 등록

### 3. 로그아웃 상태
- [x] 비로그인 → initFCM() 실행되지만 토큰 등록 건너뜀 (정상)

---

## 빌드 결과

```
✓ 3550 modules transformed.
✓ 4442 modules transformed.
✓ built in 13.93s
✓ built in 16ms
✓ built in 29.52s

Run npm run preview to preview your production build locally.
```

**경고**: 10개 (접근성, 타입 관련 - 기능과 무관)

---

## 완료 사항

- [x] `+layout.svelte` 수정 (await 추가, setTimeout 제거)
- [x] 빌드 확인 (성공)
- [x] 문서 업데이트 (`codebase-review.md`)
- [x] 커밋 완료

**커밋**:
- memo-alarm: 9b7d4c1 (2026-01-22)
- wtools: a791f3f (문서 업데이트)

---

## 추가 개선 가능 사항

### 1. 에러 핸들링 강화

```typescript
onMount(async () => {
    try {
        await authStore.initialize();
        initFCM();
    } catch (error) {
        console.error('[Layout] Initialization error:', error);
        // 폴백 로직 또는 재시도
    }
});
```

### 2. 로딩 상태 표시

```typescript
let initializing = $state(true);

onMount(async () => {
    await authStore.initialize();
    initFCM();
    initializing = false;
});

// UI
{#if initializing}
    <div>Loading...</div>
{:else}
    <div>{@render children()}</div>
{/if}
```

---

## 참고

- onMount는 async 가능 (Svelte 5 지원)
- await는 Promise 완료를 보장
- setTimeout은 불확실성을 도입 (anti-pattern)

---

*상태: ✅ 구현 완료 (2026-01-22)*
