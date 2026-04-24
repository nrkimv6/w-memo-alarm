# 알림 기본설정 계정단위 전환 및 기기 간 동기화

> 작성일시: 2026-04-24 22:27
> 기준커밋: 945bf4d
> 대상 프로젝트: memo-alarm
> 상태: 완료
> 구현커밋: 303095a
> 머지커밋: 6c1d438
> 반영일시: 2026-04-24 22:54
> 진행률: 7/7 (100%)
> 요약: 기본알림(메모)과 할일 기본 알림시간/자동알림(분)을 **로그인 시 계정단위로 동기화**하고, **비로그인 시에는 localStorage(기기단위) fallback**으로 유지한다.

---

## 결론 (정책)

- **계정단위(동기화)**: 기본알림(시간/요일/자동열기), 새 메모 자동알림, 할일 기본 알림시간, 할일 자동알림(분)
- **기기단위(비동기화)**: 테마/권한/FCM 토큰/개발 진단/표시 옵션(예: markdown, overdue/progress/upcoming 표시) 등 기기 종속 값

---

## 구현 요약

- 저장소
  - local: `localStorage`의 `memo-alarm-settings` 유지
  - remote: Supabase `ma_user_settings.notification_defaults`(JSONB)
- 동기화 방식
  - 로그인 상태: `settingsStore.init()`에서 remote fetch 후 local에 merge 저장
  - 다른 기기 변경: Supabase realtime(`postgres_changes`) 구독으로 즉시 반영
  - 충돌: `notification_defaults` 시그니처 기반 last-write-wins
- 런타임 연쇄 업데이트
  - 기본알림 변경 시: 기존 `isDefault` 메모 알림 갱신 로직 유지
  - 할일 전역 기본값 변경 시: memos store의 전역 remind/autoAlert 갱신을 지연 큐로 처리 후, 메모 초기 로드 완료 시 `flushPendingRuntimeSync()`로 1회 보정

---

## DB 마이그레이션 (적용 완료)

- 실행 파일: `data/migrations/012_account_scoped_notification_settings.sql`
- 적용 완료: 2026-04-24 (테이블/정책/트리거 + `supabase_realtime` publication 포함)

---

## 남은 작업

- [x] 코드 반영 및 머지 (303095a, 6c1d438)
- [x] 정적 검증: `npm run check` (2026-04-24)
- [x] 정적 검증: `npm run build` (2026-04-24)
- [x] worktree/branch 정리: `impl/clarify-default-reminder-settings` 삭제 (2026-04-24)
- [x] Supabase에 `012_account_scoped_notification_settings.sql` 적용 (테이블/정책/트리거 생성) (2026-04-24)
- [x] Supabase Realtime publication(`supabase_realtime`)에 `public.ma_user_settings` 추가 (2026-04-24)
- 수동검증 체크리스트: `MANUAL_TASKS.md`의 `2026-04-24: 알림 기본설정 계정단위 동기화 수동 검증` 섹션 참고
- [x] TODO/DONE 정리 및 plan 종료 처리 (/done) (2026-04-24)

---

*상태: 완료 | 진행률: 7/7 (100%)*
