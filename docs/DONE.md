# DONE (최근 20개)

- [x] 2026-01-07: Phase 13-15 완료 + 버그 수정 + D1 배포
  - Phase 13: 소셜 & 공유 (ShareModal, QR 코드, 이미지 내보내기)
  - Phase 14: 클라우드 동기화 (D1 데이터베이스, 6자리 동기화 코드)
  - Phase 15: AI 기능 (자동 태그 추천, 관련 메모 추천)
  - 버그 수정: 모바일 보기옵션 UI 반응형 개선
  - 버그 수정: 알림 권한 요청 배너 추가
  - D1 데이터베이스 생성 및 마이그레이션 적용 완료
    - database_id: c670a00b-db20-4046-aaf6-8ddaf0553a88

- [x] 2026-01-07: Phase 12 체크리스트 개선
  - 완료 항목 숨기기/보기 토글
  - 항목 순서 변경 (위/아래 버튼)
  - 숨겨진 완료 항목 개수 표시

- [x] 2026-01-07: Phase 11 스누즈 기능 추가
  - 스누즈 알림 저장/로드 (localStorage)
  - snooze(memoId, minutes) 함수 (5, 10, 30, 60분)
  - 백그라운드 체크에서 스누즈된 알림 처리
  - 스누즈 알림 구분 표시 (⏰ prefix)

- [x] 2026-01-07: Phase 10 빠른 입력 + 자동 알림 (이미 구현됨)
  - QuickMemoInput 자동 알림 토글
  - SettingsModal 기본 알림 시간/요일 설정
  - MemoForm 기본 알림 자동 적용

- [x] 2026-01-07: Phase 9 샘플 데이터 + 태그 필터 개선
  - 태그 필터 AND/OR 모드 토글 추가
  - 샘플 데이터 (첫 실행 시 예시 메모 3개) - 이미 구현됨

- [x] 2026-01-07: Phase 8 자동 열기 개선 완료
  - 백그라운드 1분마다 알림 체크 (setInterval)
  - 알림 시간 도달 시 자동 알림 + URL 열기
  - 마지막 알림 시간 기록 (중복 방지)
  - 일회성 알림 자동 비활성화

- [x] 2026-01-07: Phase 7 키보드 단축키 완료
  - N: 새 메모, /: 검색 포커스, Esc: 모달 닫기, Ctrl+S: 저장
  - ScheduledRemindersModal 버튼 중첩 버그 수정

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
- `src/lib/types/sync.ts` (Phase 14)
- `src/lib/stores/memos.svelte.ts`
- `src/lib/stores/filter.svelte.ts`
- `src/lib/stores/notifications.svelte.ts`
- `src/lib/stores/theme.svelte.ts`
- `src/lib/stores/sync.svelte.ts` (Phase 14)

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
- `src/lib/utils/share.ts` (Phase 13)
- `src/lib/utils/qrcode.ts` (Phase 13)
- `src/lib/utils/export-image.ts` (Phase 13)
- `src/lib/utils/ai.ts` (Phase 15)

### API 라우트
- `src/routes/api/sync/+server.ts` (Phase 14)

### D1 마이그레이션
- `data/migrations/001_init.sql` (Phase 14)

### PWA & Capacitor
- `static/manifest.json`
- `capacitor.config.ts`

## 빌드 결과
- Web: `build/`
- Android: `android/app/build/outputs/apk/debug/app-debug.apk`
