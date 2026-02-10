# Memo Alarm - TODO

> 완료된 작업: [DONE.md](docs/DONE.md)
> 현재 Phase: **Phase 1-8 완료 ✅**

---

## In Progress

- [ ] **알림 시스템 잔여 이슈** ([plan](docs/plan/2026-02-04_followup-plan-notification-issues.md))
  - **CRITICAL**: Capacitor 네이티브 알림 클릭 리스너 미연결 (Issue 1)
  - **MEDIUM**: 포그라운드 window.open() 중복 호출 (Issue 2)
  - **LOW**: navigate() 실패 시 fallback (Issue 3)
  - **LOW**: ?memo= 폴링 로직 개선 (Issue 4)
  - **LOW**: iOS PWA 제한 대응 (Issue 5)

## Pending

- [ ] [Todo 기능 강화](docs/plan/2026-02-10_todo-enhancement-features.md) — 메모↔할일 전환 개선 + Todo URL + 펑(Pung) 자동삭제
   - 세부 계획: `docs/plan/todo-feature/phase-4-native-group-stats.md`
   - 진행률: 60% (Web 완료, Native 진행 중)
- [ ] [메모 공유 URL null 수정](docs/plan/2026-02-10_fix-memo-share-url-null.md) — SNS 공유 시 URL null 문제 수정

---

## 관련 계획서

- [Todo 기능 강화 계획서](docs/plan/2026-02-10_todo-enhancement-features.md)
- [메모 공유 URL null 수정 계획서](docs/plan/2026-02-10_fix-memo-share-url-null.md)

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
