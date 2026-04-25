# memo-alarm 완료 기록 — 2026-04 후반

- [x] 2026-04-24: 알림 기본설정 계정단위 전환 및 기기 간 동기화 — [archive](2026-04-24_clarify-default-reminder-settings.md) (수동검증: MANUAL_TASKS)
- [x] 2026-04-24: 북마크 필터 todo 카드 렌더링 개선 — memos 페이지에서 `memoType === 'todo'` 항목을 `TodoCard`로 렌더링 — [archive](2026-03-30_bookmark-filter-todo-card.md)
- [x] 2026-04-24: settings/developer 페이지 컴포넌트 분할 리팩토링 — 827줄 단일 파일 → 섹션 컴포넌트화(`src/lib/components/settings/dev/*`), `+page.svelte` 500줄 이하 달성 — [archive](2026-04-24_refactor-settings-developer-page.md)
- [x] 2026-04-24: swMessages.ts REGISTER/REMOVE_TODO_NOTIFICATIONS 상수 추가 — 메인 스레드 발신 측 raw string → SW_MSG 상수 교체, SW 수신 측 주석 보강 — [archive](2026-04-24_fix-sw-messages-register-todo-constants.md)
- [x] 2026-04-24: todo 알림 click 라우팅 + SW 메시지 계약 정리 — SW notificationclick todo-* → /todos, TODO_NOTIFICATION_SENT consumer + NotificationHistory 타입/DB 제약 확장, HistoryCard sw-todo 라벨/클릭 동선 — [archive](2026-04-24_fix-todo-notification-click-and-sw-messages.md)
- [x] 2026-04-24: Settings 페이지 재디자인 — 1929줄 단일 파일 → Hub+서브페이지(notifications, developer) 구조 분리, 9개 신규 컴포넌트(NavRow/NavGroup/Row/Section/GroupLabel/ImpactNote/SegmentedControl/Pill/SubPageShell), settings-* CSS 네임스페이스 — [archive](2026-04-24_redesign-settings-page.md)
- [x] 2026-04-24: svelte-check 21개 에러 수정 (`__APP_VERSION__`, VoiceInput, Modal/EmojiPicker/Icon props, QuickMemoInput/notifications, Onboarding/TodoCard, public env 경로 보정) — [archive](2026-04-24_fix-svelte-check-errors.md)
- [x] 2026-04-24: foreground 경로 동일 시간대 알림 병합 추가 (collect→merge→dispatch, SW 로직과 대칭, buildMergedTitle/Body 유틸) — [archive](2026-04-24_fix-notification-merge-in-foreground.md)
- [x] 2026-04-24: SW `checkTodoNotifications` 동일 시간대 할일 알림 병합 (개별 폭주 → 1건 병합 알림, `todo-batch-{HH:MM}`, 클릭 시 `/todos`) — [archive](2026-04-24_fix-todo-notification-merge-in-sw.md)
- [x] 2026-04-24: Google 로그인 회귀 최소 수정 — callback 토큰 비노출 진단 로그 + SW에서 navigation 문서 및 `/auth/*` 캐시 예외 처리 — [archive](2026-04-24_fix-google-login-regression.md)
