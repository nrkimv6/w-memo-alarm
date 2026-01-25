# DONE (최근 20개)

- [x] 2026-01-25: **기본알림/사용자 지정알림 구분 기능** ✅
  - **Phase 1**: 데이터 모델 변경
    - `types/memo.ts`: Reminder 인터페이스에 `isDefault?: boolean` 추가
    - `memos.svelte.ts`: 메모 생성 시 `autoReminderOnCreate`가 true이면 `isDefault: true` 자동 설정
  - **Phase 2**: UI 구현
    - `ReminderSettings.svelte`: "기본알림 사용" 토글 추가, 기본알림 선택 시 시간/요일 입력 비활성화
    - `MemoCard.svelte`: 알림 표시에 기본/커스텀 구분 (기본: "기본", 커스텀: 시간 표시)
  - **Phase 3**: 일괄 업데이트
    - `memos.svelte.ts`: `updateDefaultReminderMemos()` 함수 추가 (isDefault인 메모들 일괄 업데이트)
    - `settings.svelte.ts`: 기본알림 시간/요일 변경 시 자동으로 일괄 업데이트 호출
    - `settings/+page.svelte`: 영향받는 메모 개수 경고 메시지 표시
  - **효과**: 기본알림 시간 변경 시 해당 메모들의 알림 시간 자동 갱신
  - **참고**: `common/docs/plan/2026-01-25_memo-alarm-default-custom-reminder.md`

- [x] 2026-01-25: **Phase 7-12 완료 (누락 기능 추가 완료)** ✅
  - **Phase 7**: 핵심 누락 기능 (P1)
    - 폴더/카테고리 시스템 (Folder 타입, folderId, FolderSelector, 사이드바/탭 네비게이션)
    - 정렬 옵션 UI (SortDropdown, 최신순/오래된순/제목순/수정일순)
    - 상세 보기 모달 (MemoDetailModal, 전체 내용, 편집/삭제/공유, 메타 정보)
    - 공유 기능 (네이티브 Share API, 클립보드 복사, MemoCard/MemoDetailModal 버튼)
    - Toast 알림 시스템 (성공/에러/경고, 메모 저장/삭제 피드백)
  - **Phase 8**: 사용성 개선 (P2)
    - 활성/비활성 토글 (isActive 필드, 흐리게 표시, 필터 숨기기)
    - 컴팩트 뷰 모드 (grid/list/compact, 한 줄 표시)
    - 열람 이력 (openHistory: Date[], 최근 10개, 마지막 열람 표시)
    - 키보드 단축키 (N: 새 메모, /: 검색, Esc: 닫기, Ctrl+S: 저장)
    - 자동 URL 열기 개선 (백그라운드 1분 체크, 알림+URL 동시 열기)
  - **Phase 9**: 마무리 (P3)
    - 샘플 데이터/온보딩 (첫 실행 시 예시 메모 3개, 기능 소개 모달 4단계)
    - 상대 시간 개선 (date-fns v4.1.0, formatDistanceToNow, 한국어 로케일)
    - 태그 필터 개선 (AND/OR 토글, 태그 색상 지원)
  - **Phase 10**: 빠른 입력 + 자동 알림
    - 기본 알림 시간 설정 (설정에서 기본 시간/요일 지정, localStorage 저장)
    - 빠른 메모 작성 (헤더 인라인 입력, Enter 저장, 자동 알림 적용)
  - **Phase 11**: 알림 관리 강화
    - 알림 등록 리스트 (예정 알림 목록, 시간순 정렬, 개별 취소, 일괄 활성화/비활성화)
    - 알림 개선 (1회성/반복 알림, 스누즈 5분/10분/1시간, 알림 그룹핑)
  - **Phase 12**: 체크리스트 & 태스크
    - 체크리스트 기능 (아이템 추가, [ ]/[x] 토글, 진행률, 완료 항목 숨기기, 순서 변경)
    - 태스크 모드 (메모 타입: note/bookmark/task, 마감일, 우선순위, 오늘 할 일 위젯)
  - **참고**: `memo-alarm/docs/archive/2026-01-07_memo-alarm-missing-features.md`

- [x] 2026-01-24: **Optimistic UI 패턴 적용** ✅
  - **P0 구현**:
    - `memo.ts`: `SyncStatus` 타입, `syncStatus`, `localId` 필드 추가
    - `memos.svelte.ts`: `add()` 즉시 UI 반영 + 백그라운드 동기화
    - `MemoCard.svelte`: 동기화 상태 아이콘 (🔄 pending, ⚠️ failed)
    - 동기화 실패 시 토스트 알림
  - **P1 구현**:
    - `syncQueue.ts`: 동기화 큐 클래스 (지수 백오프: 1초→2초→4초→8초→16초, 최대 5회)
    - 수동 재시도 버튼 (retrySync 함수 + UI)
  - **P2 구현**:
    - `networkStatus.ts`: 네트워크 상태 감지 (navigator.onLine)
    - 온라인 복구 시 자동 동기화 재개
  - **효과**: 메모 추가 시 즉시 UI 반영, 네트워크 문제 시 자동 재시도
  - **참고**: `common/docs/plan/2026-01-23_memo-alarm-optimistic-ui.md`

- [x] 2026-01-23: **UI/UX 추가 개선** ✅
  - **전체메모 탭 빠른추가 제거**: 홈에만 유지
  - **페이지 전환 깜빡임 수정**: Header/BottomNav에 view-transition-name 추가
  - **검색 토글 시 빠른추가 숨김**: 검색 모드일 때 QuickMemoInput 숨김
  - **모달 히스토리 연동**: back 버튼으로 모달 닫기 지원
  - **핀 버튼 잘림 버그 수정**: SwipeableCard에 pt-3 추가로 overflow 문제 해결
  - **설정 페이지 헤더 추가**: 다른 페이지와 동일한 헤더 구조 적용
  - **로그인 버튼 개선**: Google/Kakao 아이콘 추가, 테마 버튼과 동일한 스타일 적용
  - **수정 파일**: SwipeableCard.svelte, Modal.svelte, settings/+page.svelte, +page.svelte

- [x] 2026-01-23: **홈/전체메모 탭 분리** ✅
  - **하단 네비게이션**: "전체 메모" 탭 추가 (홈, 전체 메모, 설정)
  - **홈 탭 리디자인**: 대시보드 스타일로 변경
    - 검색창 숨김 → 검색 아이콘 클릭 시 노출
    - 고정된 메모, 즐겨찾기, 알림 예정, 최신 메모 섹션별 표시
  - **전체 메모 페이지**: /memos 라우트 신규 생성
  - **수정 파일**: BottomNav.svelte, +page.svelte, memos/+page.svelte
  - **참고**: docs/2026-01-23_home-allmemos-separation.md

- [x] 2026-01-23: **Notes UI 개선** ✅
  - **동기화 용어 변경**: "Supabase 동기화" → "클라우드 보관"
  - **백업 가져오기**: `accept="*/*"` + JS 검증으로 안드로이드 호환성 해결
  - **빠른메모 + 버튼 제거**: Enter로 저장 가능하므로 불필요한 버튼 제거
  - **검색/필터 분리**: 검색 영역과 필터 영역 사이 구분선 추가
  - **빈 상태 높이 축소**: py-20 → py-8, 스크롤 없이 볼 수 있도록 개선
  - **카카오 이메일 숨김**: `@kakao.local` 이메일 표시 안 함
  - **수정 파일**: settings/+page.svelte, QuickMemoInput.svelte, +page.svelte, user.ts
  - **참고**: docs/2026-01-23_notes-ui-improvements.md

- [x] 2026-01-23: **Capacitor SSR 빌드 에러 수정** ✅
  - **문제**: vite.config.ts에 `ssr.external` 설정 누락으로 SSR 빌드 시 Capacitor 패키지 에러 발생
  - **해결**: `ssr.external`에 Capacitor 패키지 추가
    ```typescript
    ssr: {
        noExternal: [],
        external: ['@capacitor/browser', '@capacitor/core', '@capacitor/local-notifications']
    }
    ```
  - **영향 패키지**:
    - `@capacitor/browser` - 브라우저 열기 기능
    - `@capacitor/core` - Capacitor 핵심 모듈
    - `@capacitor/local-notifications` - 로컬 알림 기능
  - **결과**: SSR 빌드 시 Capacitor 패키지가 번들링에서 제외되어 Cloudflare Workers 호환성 확보
  - **관련 파일**: vite.config.ts
  - **참고**: sacred-hours, line-minder와 동일한 설정 적용
  - **커밋**: (이전 커밋에서 이미 수정됨)

- [x] 2026-01-20: **Auth 동기화 수정 (user_data 테이블 제거)** ✅
  - **문제**: auth.svelte.ts가 존재하지 않는 `user_data` 테이블 사용으로 동기화 실패
  - **해결**: Realtime 자동 동기화로 전환
  - **수정 내용**:
    - `auth.svelte.ts`: 수동 동기화 로직 완전 제거
      - `checkAndSyncData()`, `uploadToServer()`, `downloadFromServer()`, `sync()` 함수 제거
      - SIGNED_IN 시 Store init만 호출
      - SIGNED_OUT 시 Store cleanup 호출
    - `settings/+page.svelte`: "지금 동기화" 버튼 제거
      - "데이터는 자동으로 동기화됩니다" 안내 추가
  - **빌드**: 성공 (경고만 존재)
  - **참고**: `common/docs/plan/2026-01-20_memo-alarm-auth-fix.md`
  - **커밋**: 2829592 (문서), memo-alarm 리포지토리 별도 커밋 필요

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
  - **참고**: `memo-alarm/docs/archive/2026-01-12_memo-alarm-online-first-refactor.md, 2026-01-09_memo-alarm-login-implementation.md`
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
