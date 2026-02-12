# Capacitor 프로젝트 Android Safe Area 통합 수정 계획서

> **⚠️ 문서 상태**: 이 문서는 프로젝트별로 분리되었습니다.
>
> **새 문서 위치**:
> - [Sacred Hours - Android Safe Area 수정](../../sacred-hours/docs/plan/2026-02-03_android-safe-area-fix.md)
> - [Line Minder - Android Safe Area 개선](../../line-minder/docs/plan/2026-02-03_android-safe-area-improvement.md)

---

> **작성일**: 2026-02-03
> **상태**: ARCHIVED (프로젝트별 분리됨)

## 1. 배경

memo-alarm에서 Android 하단 네비게이션 바 영역 겹침 문제를 수정했습니다.
동일한 문제가 다른 Capacitor 프로젝트(sacred-hours, line-minder)에서도 발생할 수 있으므로,
표준 가이드(`common/docs/guide/mobile/android-safe-area.md`)를 기반으로 모든 Capacitor 앱에 통합 적용합니다.

**참고 문서**:
- `memo-alarm/docs/fix-android-navbar-overlap.md` (완료된 수정 사항)
- `common/docs/guide/mobile/android-safe-area.md` (표준 가이드)

---

## 2. 프로젝트별 현황

| 프로젝트 | viewport-fit | safe-area CSS | BottomNav | Layout | Android styles.xml | 상태 |
|---------|-------------|--------------|-----------|--------|-------------------|------|
| memo-alarm | ✅ | ✅ | ✅ inline | ✅ calc | ✅ (#faf8f5 / #1c1714) | 완료 |
| sacred-hours | ❌ | ❌ | ❌ | ❌ | ❌ | **수정 필요** |
| line-minder | ✅ | ⚠️ @layer base | ⚠️ 클래스만 | ❌ | ❌ | **부분 수정 필요** |

### 2.1 sacred-hours 누락 사항

- [ ] `app.html:6` — `viewport-fit=cover` 추가
- [ ] `app.css` — `.safe-bottom`, `.safe-top` 유틸리티 클래스 추가 (`@layer utilities`)
- [ ] `BottomNav.svelte:16` — `padding-bottom: env(safe-area-inset-bottom)` 인라인 스타일 추가
- [ ] `+layout.svelte:95` — `padding-bottom: calc(5rem + env(safe-area-inset-bottom))` 추가
- [ ] `android/.../values/styles.xml` — `android:navigationBarColor` 추가 (라이트 모드)
- [ ] `android/.../values-night/styles.xml` — 다크모드 네비바 색상 설정 (신규 생성)
- [ ] 하단 고정 요소(FAB, Toast 등) safe area 적용 확인

**배경색**:
- 라이트: `#ffffff` (기본 흰색)
- 다크: `#191a1f` (추정, theme.svelte에서 확인 필요)

### 2.2 line-minder 개선 사항

- [x] `app.html:6` — `viewport-fit=cover` ✅ 이미 적용됨
- [x] `app.css:17-23` — `.safe-bottom`, `.safe-top` ✅ 있지만 `@layer base`에 위치
  - [ ] **권장**: `@layer utilities`로 이동 (일관성 유지)
- [x] `BottomNav.svelte:14` — `safe-bottom` 클래스 적용됨
  - [ ] **권장**: inline style로 변경 (`padding-bottom: env(safe-area-inset-bottom)`)
- [ ] `+layout.svelte:34` — `pb-24` 고정값 → `calc(5rem + env(safe-area-inset-bottom))` 변경
- [ ] `android/.../values/styles.xml` — `android:navigationBarColor` 추가 (#ffffff 또는 앱 배경색)
- [ ] 하단 고정 요소(FAB, Toast 등) safe area 적용 확인

**배경색**:
- 라이트: `#ffffff` (추정, theme-color meta 태그에서 #6366f1이지만 배경은 흰색)
- 다크: 미지원

---

## 3. 수정 우선순위

### Phase 1: sacred-hours (필수)

모든 항목이 누락되어 있으므로 전체 적용 필요.
**예상 작업 시간**: 30분

**작업 순서**:
1. `app.html` — viewport-fit=cover 추가
2. `app.css` — safe-area 유틸리티 추가
3. `BottomNav.svelte` — padding-bottom 추가
4. `+layout.svelte` — calc() 패딩 추가
5. `styles.xml` (values/) — navigationBarColor 추가
6. `styles.xml` (values-night/) — 다크모드 네비바 색상 추가
7. 빌드 테스트

### Phase 2: line-minder (개선)

일부 항목이 적용되어 있지만, 일관성과 완전성을 위해 보완.
**예상 작업 시간**: 20분

**작업 순서**:
1. `app.css` — @layer base → @layer utilities 이동 (선택)
2. `BottomNav.svelte` — 클래스 → inline style 변경 (선택)
3. `+layout.svelte` — pb-24 → calc() 변경
4. `styles.xml` — navigationBarColor 추가
5. 빌드 테스트

---

## 4. 검증 항목

각 프로젝트별 수정 후 다음을 확인:

- [ ] Android 에뮬레이터/기기에서 시스템 네비바 영역 겹침 없음
- [ ] BottomNav 아래 여백이 시스템 네비바 높이만큼 자동 확보됨
- [ ] 라이트/다크 모드 전환 시 네비바 색상 일치
- [ ] FAB, Toast 등 하단 고정 요소가 시스템 네비바와 겹치지 않음
- [ ] `npm run build` 성공
- [ ] iOS Safari에서도 정상 동작 (env() 값이 0으로 fallback되어야 함)

---

## 5. 참고 사항

### Android 15 (API 35) Edge-to-Edge 강제 적용

Android 15부터 모든 앱이 edge-to-edge UI를 기본으로 사용합니다.
safe area 대응이 없으면 콘텐츠가 시스템 바 뒤에 가려지게 됩니다.

### CSS `env()` 함수

- `viewport-fit=cover`와 함께 사용해야 실제 값(>0)을 반환합니다.
- 지원하지 않는 브라우저에서는 fallback 값(0px)을 사용합니다.
- [MDN 문서](https://developer.mozilla.org/en-US/docs/Web/CSS/env)

### 프로젝트별 배경색

정확한 배경색은 각 프로젝트의 다음 파일에서 확인:
- `src/app.css` — CSS 변수 (--background)
- `tailwind.config.js` — theme.colors.background
- `src/lib/stores/theme.svelte.ts` — 다크모드 설정

---

## 6. 완료 후 작업

- [ ] `common/docs/guide/mobile/android-safe-area.md` — 프로젝트별 배경색 테이블 업데이트
- [ ] 각 프로젝트 `TODO.md` 또는 `DONE.md`에 기록
- [ ] 각 프로젝트별 빌드 및 Android 테스트
- [ ] 필요 시 Google Play 스토어 업데이트

---

## 7. 관련 이슈

- memo-alarm: [fix-android-navbar-overlap.md](../../memo-alarm/docs/fix-android-navbar-overlap.md)
- Android 공식 문서: [Edge-to-edge UI](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
