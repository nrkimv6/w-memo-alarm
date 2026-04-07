# Memo Alarm - TODO

> 완료된 작업: [DONE.md](docs/DONE.md)
> 현재 Phase: **Phase 1-8 완료 완료**

---

## In Progress

*현재 없음*

## Pending

- [ ] **북마크 필터에서 할일 카드 렌더링 개선** — [plan](docs/plan/2026-03-30_bookmark-filter-todo-card.md) (0/6, 0%)
- [ ] **메모↔할일 전환 시 북마크 소실 재발 이슈 수정** — [plan](docs/plan/2026-04-07_fix-bookmark-disappear-recurrence.md) (0/14, 0%) — fire-and-forget race + 매퍼 undefined→null + cleanup 통합 (기존 03-31 두 plan 흡수)
- [ ] **fire-and-forget update() race condition 방지** — [plan](docs/plan/2026-03-31_fire-and-forget-update-race.md) (0/3, 0%) — ⚠️ 04-07 plan이 흡수
- [ ] **할일→메모 전환 시 할일 전용 필드 클리어 누락 수정** — [plan](docs/plan/2026-03-31_fix-todo-to-memo-field-cleanup.md) (0/3, 0%) — ⚠️ 04-07 plan이 흡수 (매퍼 수정 누락 보강)

---

## 관련 계획서

- [메모 공유 URL null 수정 계획서](docs/plan/2026-02-10_fix-memo-share-url-null.md)

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
