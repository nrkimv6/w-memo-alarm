# Memo Alarm - TODO

> 현재 Phase: **모든 Phase 완료!** 🎉

---

## Phase 1: 기반 구축 (완료)

### 1.1 프로젝트 초기화
- [x] SvelteKit 2 프로젝트 생성
- [x] TypeScript 5 설정
- [x] Tailwind CSS 4 설정
- [x] 프로젝트 디렉토리 구조 생성

### 1.2 색상 테마 통합
- [x] app.css 생성 (gentle-notes + v0-bookmark 믹스)
- [x] CSS 변수 정의 (라이트 모드)
- [x] CSS 변수 정의 (다크 모드)

### 1.3 공통 UI 컴포넌트
- [x] Button.svelte
- [x] Input.svelte
- [x] Modal.svelte
- [x] Card.svelte
- [x] Badge.svelte (태그용)
- [x] Toggle.svelte (활성/비활성)

### 1.4 타입 정의
- [x] src/lib/types/memo.ts (Memo 인터페이스)

### 1.5 데이터 스토어
- [x] src/lib/stores/memos.svelte.ts (CRUD 로직)
- [x] src/lib/stores/filter.svelte.ts (필터 상태)
- [x] localStorage 연동

### 1.6 레이아웃
- [x] Header.svelte
- [x] +layout.svelte (기본 레이아웃)
- [x] +page.svelte (메인 페이지)

---

## Phase 2: 메모 핵심 (완료)

### 2.1 메모 CRUD
- [x] MemoForm.svelte (생성/수정 모달)
- [x] DeleteConfirmDialog.svelte

### 2.2 메모 카드
- [x] MemoCard.svelte
- [x] 호버 액션 버튼
- [x] 핀/즐겨찾기 토글

### 2.3 태그 시스템
- [x] TagInput.svelte (자동완성)
- [x] TagFilter.svelte

### 2.4 검색/필터
- [x] SearchBar.svelte
- [x] 필터 탭 UI (FilterTabs.svelte)

### 2.5 뷰 모드
- [x] 그리드/리스트 전환

---

## Phase 3: 북마크 속성 (완료)

- [x] URL 입력 UI
- [x] 이모지 피커 (EmojiPicker.svelte)
- [x] 열람 추적 (openCount)
- [x] 카드에 URL 표시

---

## Phase 4: 알림 시스템 (완료)

- [x] 알림 설정 UI (ReminderSettings.svelte)
- [x] PWA 푸시 알림 (notificationStore)
- [x] 오늘의 알림 섹션 (TodayReminders.svelte)
- [x] 자동 URL 열기

---

## Phase 5: Capacitor (완료)

- [x] Capacitor 설정
- [x] 네이티브 알림 (@capacitor/local-notifications)
- [x] Android 빌드 (app-debug.apk)

---

## Phase 6: 마무리 (완료)

- [x] 다크 모드 (themeStore + 토글)
- [x] 데이터 내보내기/가져오기 (SettingsModal)
- [x] PWA 설정 (manifest.json)

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
