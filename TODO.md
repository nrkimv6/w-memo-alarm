# Memo Alarm - TODO

> 완료된 작업: [DONE.md](docs/DONE.md)
> 현재 Phase: **Phase 1-8 완료 완료**

---

## In Progress

- [ ] **메모→할일 전환 시 URL이 할일 UI에서 사라지는 이슈 수정** — [plan](docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md) (45/71, 63%) 머지대기

- [ ] **브라우저 cold load 설정 토글 상태 디싱크 수정** — [plan](docs/plan/2026-04-24_fix-settings-state-desync-on-cold-load.md) (35/58, 60%) 머지대기

- [ ] **foreground 경로 동일 시간대 알림 병합 누락 수정** — [plan](docs/plan/2026-04-24_fix-notification-merge-in-foreground.md) (43/60, 72%) 머지대기

## Pending
- [ ] **FCM 알림 덮어쓰기 + 6개 미전송 원인 수정** — [plan](docs/plan/2026-04-23_fix-fcm-notification-tag-and-missing-sends.md) (0/73, 0%)
- [ ] **북마크 필터에서 할일 카드 렌더링 개선** — [plan](docs/plan/2026-03-30_bookmark-filter-todo-card.md) (0/6, 0%)
- [x] **메모↔할일 전환 시 북마크 소실 재발 이슈 수정** — [plan](docs/plan/2026-04-07_fix-bookmark-disappear-recurrence.md) — 구현완료 (Phase 6 수동 검증 별도)

---

## 관련 계획서

- [메모 공유 URL null 수정 계획서](docs/plan/2026-02-10_fix-memo-share-url-null.md)

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
