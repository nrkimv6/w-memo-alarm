# memo-alarm - 완료된 작업

> 이 파일은 memo-alarm 프로젝트에서 완료된 작업을 기록합니다.

## 2026-02-13: 빠른 메모 추가 (FAB)
- [x] 완료 — [archive](archive/2026-02-12_quick-add-fab.md)
- **Phase 1**: FAB 버튼 HTML 추가 (`src/routes/+page.svelte`)
- **Phase 2**: FAB 호버/액티브 애니메이션 추가
- **Phase 3**: 스크롤 방향 감지 로직 추가 (아래 스크롤 시 숨기기, 위로 스크롤 시 표시)
- **Phase 4**: 빌드 성공 확인
- **기능**: 홈 화면 우하단 플로팅 버튼으로 어디서든 빠른 메모 작성 가능

## 2026-02-11: Android PWA 알림 클릭 수정 검증
- [x] 완료 — [수정 보고서](plan/2026-02-04_fix-report-android-pwa-notification-click.md)
- **코드 검증**: service-worker.ts 외부 URL 처리 로직 구현 완료
- **빌드**: 성공
- **수동 작업**: Android PWA 실기기 테스트 필요 → MANUAL_TASKS.md

## 2026-02-11: 알림 시스템 잔여 이슈 수정
- [x] 완료 — [archive](archive/2026-02-04_followup-plan-notification-issues.md)
- **Issue 1**: Capacitor 네이티브 알림 클릭 리스너 연결 (`+layout.svelte`)
- **Issue 2**: 포그라운드 window.open() 중복 제거 (`notifications.svelte.ts`, `service-worker.ts`)
- **Issue 4**: navigate() 실패 시 fallback 추가 (`service-worker.ts`, `firebase-messaging-sw.js`)
- **Issue 5**: ?memo= 파라미터 폴링 로직 개선 (`+page.svelte`)
- **빌드**: 성공

## 2026-02-11: 메모 공유 URL null 문제 수정
- [x] 완료 — [archive](archive/2026-02-10_fix-memo-share-url-null.md)
- **share.ts 수정**: formatMemoForShare() 주석 명확화, getFacebookShareUrl()/getKakaoShareUrl() URL 없으면 빈 문자열 반환, shareToSNS() 빈 URL 처리 및 toast 안내, getTwitterShareUrl() content 포함
- **ShareModal.svelte 수정**: Facebook/Kakao 버튼 조건부 비활성화 (memo.url 없을 때)
- **빌드**: 성공 (기존 타입 에러 있으나 빌드 통과)

## 2026-02-10: Todo 기능 강화
- [x] 완료 — [archive](archive/2026-02-10_todo-enhancement-features.md)
- **메모↔할일 전환 개선**: MemoDetailModal에 "할일로" 버튼 추가, TodoForm에 확인 다이얼로그 추가
- **Todo URL 속성**: TodoUrl 타입 정의, DB 마이그레이션(010), TodoForm URL 입력 UI, TodoCard 클립 아이콘 표시
- **펑(Pung) 자동삭제**: autoPung/pungDelay 필드 추가, executePung() 구현, 앱 접속 시 체크, TodoForm 펑 설정 UI, TodoCard 펑 표시
- **빌드**: 성공 (31.79s)
- **수동 작업**: Supabase 마이그레이션 실행 필요 (`data/migrations/010_todo_urls_and_pung.sql`)

## 2026-02-10: Svelte 5 $derived 패턴 오류 수정
- [x] 완료 — [archive](archive/2026-02-04_derived-pattern-fix.md)
- 5개 파일에서 `$derived(() => {...})` → `$derived.by(() => {...})` 변경
- 호출부 괄호 제거 (`filteredHistories()` → `filteredHistories`)
- 영향 파일: `settings/+page.svelte`, `+page.svelte`, `notifications/+page.svelte`
- 커밋: `1c8ad9a`

## 2026-02-10: 할일 빈 상태 미리보기 기능
- [x] 완료 — [archive](../../common/docs/archive/2026-02-10_todo-empty-state-hint.md)
- 설정: `showUpcomingOnEmpty` 토글 추가 (기본값: 켜짐)
- 로직: 현재 필터에 할일이 없을 때 다가오는 할일 2개 미리보기
- UI: 빈 상태 영역에 "다가오는 할일" 섹션 렌더링
- 빌드: 성공 (타입 에러 1개 수정 - `formatDueDate` 인수)

## 2026-02-10: 400 에러 및 메모 저장 버그 수정
- [x] 완료 — [보고서](../../common/docs/plan/2026-02-10_memo-alarm-400-error-fix.md)
- DB 마이그레이션: `reminders`, `priority` 컬럼 추가
- 타임스탬프 형식 수정: `createdAt`/`updatedAt` toDb 변환 추가
- ID 덮어쓰기 버그 수정: 객체 스프레드 순서 변경
- 커밋: `3ad4a54`

## 2026-02-06: 메모/할일 버그 수정
- [x] 완료 — [archive](archive/2026-02-05_fix-memo-todo-bugs.md)
- 로그인 후 메모가 표시되지 않는 버그 수정 (reinit 경쟁 상태 해결)
- Todo가 메모 페이지에 표시되는 버그 수정 (memoType 필터 추가)

## 2026-02-05: 하단 네비게이션 꿈틀거림 수정
- [x] 완료 — [archive](archive/2026-02-05_bottom-nav-flickering-fix.md)
- `app.css` - html에 `scrollbar-gutter: stable` 추가 (스크롤바 유무에 따른 뷰포트 폭 변동 방지)
- `BottomNav.svelte` - `view-transition-name: bottom-nav` 제거 (cross-fade 시 위치 차이 노출 방지)
- `app.css` - View Transition에서 scale 애니메이션 제거, fade만 유지 (0.35s→0.25s)

## 2026-02-04: 로그인 후 메모 미표시 버그 수정 (Phase 1 + 2)

**상태**: Phase 1 + 2 완료 (100%)

**완료 사항**:

### Phase 1: 기본 수정 (완료)
- `memos.svelte.ts` - `reinit()` 메서드 추가
- `folders.svelte.ts` - `reinit()` 메서드 추가
- `auth.svelte.ts` - `SIGNED_IN` 핸들러에서 `reinit()` 호출
- `auth/callback/+page.svelte` - `finishLogin()`에서 스토어 초기화 보장
- `+layout.svelte` - auth callback 경로 시 조기 초기화 방지

### Phase 2: 추가 수정 (완료)
- `memos.svelte.ts` - `reinit()` 동시 실행 방지 가드 추가
- `folders.svelte.ts` - `reinit()` 동시 실행 방지 가드 추가
- `auth/callback/+page.svelte` - `initFCM()` 호출 추가
- `docs/guides/auth-store-race-condition-guide.md` - 개발자 가이드 작성

**아카이브**: [docs/archive/2026-02-04_fix-memo-display-after-login.md](archive/2026-02-04_fix-memo-display-after-login.md)

**관련 커밋**: 8fd01bd, b2c67e8 등

---

## 2026-02-04: 로그아웃 시 메모/알림 미정리 버그 수정

**상태**: 완료 (100%)

**완료 사항**:
- `memos.svelte.ts` - cleanup() 보강
- `folders.svelte.ts` - cleanup() 보강
- `notifications.svelte.ts` - cleanup() 메서드 추가
- `auth.svelte.ts` - SIGNED_OUT 핸들러 보강

**아카이브**: [docs/archive/2026-02-04_fix-logout-memo-bug.md](archive/2026-02-04_fix-logout-memo-bug.md)

**관련 커밋**: 45c8184

---

## 기타 Plan 파일

다음 항목들은 아직 계획 단계이거나 미완료입니다:

- `2026-02-04_fix-memo-deletion-logout.md` - 메모 삭제 시 캐시 정리
- `2026-02-04_fix-report-android-pwa-notification-click.md` - Android PWA 알림 클릭 이슈
- `2026-02-04_fix-scrollbar-issues.md` - 스크롤바 문제 해결
- `2026-02-04_followup-plan-notification-issues.md` - 알림 관련 후속 계획
- `2026-02-04_idea_future-features.md` - 미래 기능 아이디어
- `2026-02-04_idea_future-improvements.md` - 미래 개선 사항

---

*마지막 업데이트: 2026-02-10*
