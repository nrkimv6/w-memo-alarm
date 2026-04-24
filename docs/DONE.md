# memo-alarm - 완료된 작업

> 이전 기록: [DONE-2026-03.md](archive/DONE-2026-03.md) | [DONE-2026-04-early.md](archive/DONE-2026-04-early.md)

- [x] 2026-04-24: swMessages.ts REGISTER/REMOVE_TODO_NOTIFICATIONS 상수 추가 — 메인 스레드 발신 측 raw string → SW_MSG 상수 교체, SW 수신 측 주석 보강 — [archive](archive/2026-04-24_fix-sw-messages-register-todo-constants.md)
- [x] 2026-04-24: todo 알림 click 라우팅 + SW 메시지 계약 정리 — SW notificationclick todo-* → /todos, TODO_NOTIFICATION_SENT consumer + NotificationHistory 타입/DB 제약 확장, HistoryCard sw-todo 라벨/클릭 동선 — [archive](archive/2026-04-24_fix-todo-notification-click-and-sw-messages.md)
- [x] 2026-04-24: Settings 페이지 재디자인 — 1929줄 단일 파일 → Hub+서브페이지(notifications, developer) 구조 분리, 9개 신규 컴포넌트(NavRow/NavGroup/Row/Section/GroupLabel/ImpactNote/SegmentedControl/Pill/SubPageShell), settings-* CSS 네임스페이스 — [archive](archive/2026-04-24_redesign-settings-page.md)
- [x] 2026-04-24: svelte-check 21개 에러 수정 (`__APP_VERSION__`, VoiceInput, Modal/EmojiPicker/Icon props, QuickMemoInput/notifications, Onboarding/TodoCard, public env 경로 보정) — [archive](archive/2026-04-24_fix-svelte-check-errors.md)
- [x] 2026-04-24: foreground 경로 동일 시간대 알림 병합 추가 (collect→merge→dispatch, SW 로직과 대칭, buildMergedTitle/Body 유틸) — [archive](archive/2026-04-24_fix-notification-merge-in-foreground.md)
- [x] 2026-04-24: SW `checkTodoNotifications` 동일 시간대 할일 알림 병합 (개별 폭주 → 1건 병합 알림, `todo-batch-{HH:MM}`, 클릭 시 `/todos`) — [archive](archive/2026-04-24_fix-todo-notification-merge-in-sw.md)
