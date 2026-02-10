# memo-alarm - 완료된 작업

> 이 파일은 memo-alarm 프로젝트에서 완료된 작업을 기록합니다.

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

- `2026-02-04_derived-pattern-fix.md` - Svelte Runes $derived 패턴 수정
- `2026-02-04_fix-memo-deletion-logout.md` - 메모 삭제 시 캐시 정리
- `2026-02-04_fix-report-android-pwa-notification-click.md` - Android PWA 알림 클릭 이슈
- `2026-02-04_fix-scrollbar-issues.md` - 스크롤바 문제 해결
- `2026-02-04_followup-plan-notification-issues.md` - 알림 관련 후속 계획
- `2026-02-04_idea_future-features.md` - 미래 기능 아이디어
- `2026-02-04_idea_future-improvements.md` - 미래 개선 사항

---

*마지막 업데이트: 2026-02-05*
