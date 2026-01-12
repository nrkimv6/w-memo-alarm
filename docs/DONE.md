# DONE (최근 20개)

- [x] 2026-01-12: **Phase 7: Online-First 아키텍처 전환 완료** ✅
  - **아키텍처**: D1 + localStorage (offline-first) → Supabase (online-first)
  - **Phase 1**: Supabase 마이그레이션
    - `data/migrations/004_supabase_online_first.sql` 생성
    - `memos`, `folders` 테이블 + RLS 정책 + 인덱스
    - 버전 기반 충돌 감지 (자동 version 증가 트리거)
  - **Phase 2**: Store 리팩토링
    - `memos.svelte.ts`: Supabase CRUD + Realtime 구독 + 버전 충돌 감지
    - `folders.svelte.ts`: Supabase CRUD + Realtime 구독
    - 오프라인 폴백 (localStorage 캐시)
  - **Phase 3**: 알림 스케줄링 통합 (이미 완료)
  - **Phase 4**: D1 제거
    - `wrangler.toml`: D1 바인딩 제거
    - `sync.svelte.ts`, `api/sync/+server.ts` 삭제
    - 설정 페이지: D1 동기화 UI 제거
  - **Phase 5**: 빌드 검증
    - 빌드 성공 (경고만, 에러 없음)
    - Capacitor 모듈 외부화 (vite.config.ts)
    - 접근성 개선 (aria-label)
  - **참고**: `common/docs/archive/2026-01-12_memo-alarm-online-first.md`
  - **커밋**: 7개 커밋 (3ad7e09...c956ff2)

- [x] 2026-01-10: TODO 정리 - Phase 1-6 완료 항목 아카이빙
  - Phase 1: 기반 구축 (프로젝트 초기화, 색상 테마, UI 컴포넌트, 타입 정의, 스토어, 레이아웃)
  - Phase 2: 메모 핵심 (CRUD, 메모 카드, 태그 시스템, 검색/필터, 뷰 모드)
  - Phase 3: 북마크 속성 (URL 입력, 이모지 피커, 열람 추적, 카드에 URL 표시)
  - Phase 4: 알림 시스템 (알림 설정 UI, PWA 푸시 알림, 오늘의 알림 섹션, 자동 URL 열기)
  - Phase 5: Capacitor (Capacitor 설정, 네이티브 알림, Android 빌드)
  - Phase 6: 마무리 (다크 모드, 데이터 내보내기/가져오기, PWA 설정)

- [x] 2026-01-10: AdSense & SEO 준비 완료
  - `/about` 페이지 대폭 확장 (2500+ 단어)
    - 싱글 태스킹의 힘 (700+ 단어)
    - 기억 보조 도구로서의 메모 알람 (700+ 단어) 섹션 추가
  - `/contact` 페이지 FAQ 확장 (8개 → 10개 Q&A: 배터리 최적화 설정, 무료 서비스 등 추가)
  - Footer 업데이트 (서비스 소개, 문의하기, Woory.day 포털 링크 추가)
  - SEO 메타태그 대폭 개선 (한글 title/description, keywords, OG tags, Twitter Card, canonical)

- [x] 2026-01-09: P1 MemoCard 모바일 시인성 개선
  - Ultra compact 모드 아이콘/폰트 개선 (h-3.5→h-4, text-xs→text-sm)
  - Hover 액션 버튼 터치 타겟 44px로 확대 (p-1.5→min-h-11 min-w-11)
  - 액션 아이콘 크기 확대 (w-4 h-4→w-5 h-5)
  - Footer 폰트 크기 개선 (text-xs→text-sm)
  - 체크리스트 진행률 폰트/아이콘 개선
  - 참고: common/docs/plan/2026-01-09_mobile-readability-overview.md

- [x] 2026-01-09: 설정 메뉴 통합 (상단 톱니바퀴 + 하단 네비)
  - Header.svelte: 설정 톱니바퀴 버튼 제거 (테마 토글은 유지)
  - /settings 페이지: 모든 설정 기능 통합
    - 테마 선택 (라이트/다크/시스템)
    - 클라우드 동기화
    - 기본 알림 설정
    - 데이터 관리 (백업/복원)
    - 위험 영역 (데이터 삭제)
    - 앱 정보
  - SettingsModal.svelte 삭제 (더 이상 사용하지 않음)

- [x] 2026-01-08: P2 Web Push 서버 발송 구현 (memo-alarm-notification.md)
  - `data/migrations/002_push_subscriptions.sql`: push_subscriptions 테이블
  - `src/lib/server/web-push.ts`: Web Push 발송 (VAPID JWT, 암호화)
  - `src/routes/api/cron/send-push/+server.ts`: Cron API 엔드포인트
  - `src/app.d.ts`: 환경변수 타입 추가
  - `wrangler.toml`: 환경변수 템플릿 추가
  - 설정 필요: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET

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
