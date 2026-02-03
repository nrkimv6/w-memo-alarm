# Android 하단 네비게이션 바 영역 겹침 수정 계획서

> **상태: 완료** (2026-02-03)

## 1. 현상

Android 기기에서 앱 하단 네비게이터(BottomNav) 아래, 안드로이드 네이티브 시스템 바(뒤로/홈/최근앱) 영역으로 앱 화면이 비쳐 보이는 현상이 간헐적으로 발생합니다.

```
┌──────────────────────┐
│     앱 콘텐츠 영역     │
│                      │
├──────────────────────┤
│   BottomNav (홈/메모/설정)  │  ← 앱 하단 네비
├──────────────────────┤
│  ◁    ○    □         │  ← 시스템 네비바 (이 영역에 앱 콘텐츠가 비침)
└──────────────────────┘
```

---

## 2. 원인 분석

### 2.1 직접 원인: `safe-bottom` CSS 클래스 미정의

`BottomNav.svelte:13`에서 `safe-bottom` 클래스를 사용하고 있지만, **이 클래스가 `app.css` 어디에도 정의되어 있지 않았습니다.**

### 2.2 근본 원인: viewport-fit=cover + 미보상

`app.html:6`에서 `viewport-fit=cover`를 설정하여 콘텐츠가 시스템 바 영역까지 확장되지만, `env(safe-area-inset-*)` CSS 보정이 누락되어 있었습니다.

### 2.3 Android 네이티브 레벨 미설정

- `styles.xml`에 `android:navigationBarColor` 미설정
- `capacitor.config.ts`에 StatusBar/NavigationBar 플러그인 미사용

### 2.4 PWA이기 때문인가?

부분적으로 맞습니다. 이 앱은 **Capacitor를 통한 네이티브 래핑 앱**이므로 WebView 안에서 동작하며, Capacitor WebView는 기본적으로 시스템 네비바 영역을 별도 관리하지 않습니다.

---

## 3. 수정 완료 목록

| 상태 | 수정 | 파일 | 내용 |
|------|------|------|------|
| DONE | A | `src/app.css` | `safe-bottom`, `safe-top` 유틸리티 클래스 정의 |
| DONE | B | `src/lib/components/BottomNav.svelte` | `env(safe-area-inset-bottom)` 패딩 직접 적용 |
| DONE | C | `src/routes/+layout.svelte` | `pb-20` → `calc(5rem + env(safe-area-inset-bottom))` |
| DONE | D | `android/.../values/styles.xml` | `android:navigationBarColor` → `#faf8f5` |
| DONE | E | `src/app.html` | body inline `background-color` + 다크모드 flash 방지 스크립트 |
| DONE | F | `src/app.css` | FAB `bottom: calc(5.5rem + env(...))` |
| DONE | G | `src/lib/components/SyncStatusBanner.svelte` | `bottom: calc(5rem + env(...))` |
| DONE | H | `src/lib/components/ui/Toast.svelte` | `bottom: calc(5.5rem + env(...))` |
| DONE | I | `android/.../values-night/styles.xml` | 다크모드 `navigationBarColor` → `#1c1714` |
| DONE | J | `src/routes/settings/+page.svelte` | 루트 레이아웃과 중복된 `pb-24` 제거 |

---

## 4. 검증 결과

- [x] `safe-bottom`/`safe-top` 유틸리티 클래스가 `@layer utilities`에 정의됨
- [x] BottomNav가 `env(safe-area-inset-bottom)` inline style로 패딩 적용
- [x] 루트 레이아웃 `padding-bottom`이 `calc(5rem + env(...))` 으로 동적 계산
- [x] FAB, Toast, SyncStatusBanner 모두 safe area 기반 위치 보정 적용
- [x] Android 라이트 모드 네비바 색상 `#faf8f5` 적용
- [x] Android 다크 모드 네비바 색상 `#1c1714` 적용 (`values-night/`)
- [x] body 다크모드 flash 방지 inline 스크립트 동작 확인
- [x] 설정 페이지 중복 패딩 제거 확인

---

## 5. 참고

- CSS `env(safe-area-inset-bottom)`: [MDN 문서](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- `viewport-fit=cover`와 함께 사용해야 `env()` 값이 0이 아닌 실제 값을 반환함
- Android API 35+ (Android 15)부터 edge-to-edge가 기본 강제 적용되므로, safe area 대응은 향후 필수 사항
