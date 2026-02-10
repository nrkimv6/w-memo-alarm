# Memo Alarm - TODO

> 완료된 작업: [DONE.md](docs/DONE.md)
> 현재 Phase: **Phase 1-8 완료 ✅**

---

## In Progress

- [x] [400 에러 수정](../common/docs/plan/2026-02-10_memo-alarm-400-error-fix.md) - DB `reminders` 컬럼 추가 마이그레이션 ✅
  - 마이그레이션 완료: `008_add_reminders_column.sql`
  - [ ] 동작 확인 필요 (메모 추가/수정 테스트)

## Pending

- [ ] [Todo 기능 강화](docs/plan/2026-02-10_todo-enhancement-features.md) — 메모↔할일 전환 개선 + Todo URL + 펑(Pung) 자동삭제
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
