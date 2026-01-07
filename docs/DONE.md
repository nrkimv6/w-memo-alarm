# DONE (최근 20개)

- [x] 2026-01-07: Phase 3-6 완료 및 Android 빌드
  - Phase 3: URL 입력, 이모지 피커, 열람 추적
  - Phase 4: 알림 설정 UI, PWA 알림, 오늘의 알림 섹션
  - Phase 5: Capacitor 설정, 네이티브 알림, Android APK 빌드
  - Phase 6: 다크 모드, 데이터 내보내기/가져오기, PWA manifest

- [x] 2026-01-07: Phase 2 메모 핵심 완료
  - MemoForm.svelte (생성/수정 모달)
  - MemoCard.svelte (호버 액션, 핀/즐겨찾기)
  - DeleteConfirmDialog.svelte
  - TagInput.svelte (자동완성)
  - TagFilter.svelte
  - SearchBar.svelte
  - FilterTabs.svelte (필터 탭 + 그리드/리스트 뷰 모드)
  - types/memo.ts (Memo 인터페이스)
  - stores/memos.svelte.ts (CRUD + localStorage)
  - stores/filter.svelte.ts (필터 상태)

- [x] 2026-01-07: Phase 1 기반 구축 완료
  - SvelteKit 2 프로젝트 초기화
  - TypeScript 5, Tailwind CSS 4 설정
  - 공통 UI 컴포넌트 (Button, Input, Modal, Card, Badge, Toggle)
  - 레이아웃 (Header, +layout.svelte)
  - app.css 색상 테마

## 생성된 파일 목록

### 타입 & 스토어
- `src/lib/types/memo.ts`
- `src/lib/stores/memos.svelte.ts`
- `src/lib/stores/filter.svelte.ts`
- `src/lib/stores/notifications.svelte.ts`
- `src/lib/stores/theme.svelte.ts`

### 컴포넌트 (memo)
- `src/lib/components/memo/MemoForm.svelte`
- `src/lib/components/memo/MemoCard.svelte`
- `src/lib/components/memo/DeleteConfirmDialog.svelte`
- `src/lib/components/memo/TagInput.svelte`
- `src/lib/components/memo/TagFilter.svelte`
- `src/lib/components/memo/SearchBar.svelte`
- `src/lib/components/memo/EmojiPicker.svelte`
- `src/lib/components/memo/ReminderSettings.svelte`
- `src/lib/components/memo/TodayReminders.svelte`

### 컴포넌트 (layout)
- `src/lib/components/layout/Header.svelte`
- `src/lib/components/layout/FilterTabs.svelte`
- `src/lib/components/layout/SettingsModal.svelte`

### 유틸리티
- `src/lib/utils/capacitor.ts`
- `src/lib/utils/data.ts`

### PWA & Capacitor
- `static/manifest.json`
- `capacitor.config.ts`

## 빌드 결과
- Web: `build/`
- Android: `android/app/build/outputs/apk/debug/app-debug.apk`
