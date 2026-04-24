# `ma_user_settings` 마이그레이션 적용 및 설정 동기화 검증

> 작성일시: 2026-04-24 23:20
> 기준커밋: 10acc97
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/7 (0%)
> 요약: 알림 기본설정 계정 동기화 기능은 코드 머지까지 완료됐지만, Supabase DB에 `ma_user_settings` 마이그레이션을 직접 적용해야 동기화가 활성화된다. 이 계획은 DB 반영, Realtime 활성화 여부 확인, 2세션 검증, 기본알림/할일 연쇄 업데이트 회귀 확인까지를 마무리한다.

---

## 전제

- 선행: `docs/archive/2026-04-24_clarify-default-reminder-settings.md` (머지커밋: `6c1d438`)
- 마이그레이션 파일: `data/migrations/012_account_scoped_notification_settings.sql`
- 코드 근거: `src/lib/stores/settings.svelte.ts`의 `fetchFromSupabase()`, `subscribeToRealtime()`, `upsertAccountSettings()`

---

## TODO

### Phase DB-Direct: Supabase DB에 마이그레이션 적용

- [ ] Supabase SQL Editor에서 `data/migrations/012_account_scoped_notification_settings.sql` 실행
  - [ ] 실행 전: `ma_user_settings` 테이블 존재 여부를 확인한다 (이미 있으면 중단하고 기존 정의/정책을 먼저 확인)
  - [ ] 실행 후: 테이블/인덱스/정책/트리거가 생성됐는지 확인한다
  - [ ] 실행 후: 로그인 사용자로 `ma_user_settings`에 SELECT/UPSERT가 가능한지 확인한다 (RLS 정책 검증)

- [ ] (필요 시) Supabase Realtime에서 `ma_user_settings` 변경 이벤트가 발행되도록 설정을 확인한다
  - [ ] 대시보드에서 `ma_user_settings`가 Realtime 대상 테이블에 포함되어 있는지 확인한다
  - [ ] 포함되어 있지 않으면: 운영 절차에 맞는 방법으로 테이블을 Realtime 대상에 추가한다
  - [ ] Realtime 추가 후: 세션 A에서 설정 변경 시 세션 B가 변경을 수신하는지(또는 새로고침으로라도 반영되는지) 확인한다

### Phase V: 2세션 동기화 검증

- [ ] 2브라우저(또는 2기기)로 같은 계정에 로그인한다 (세션 A/B)
  - [ ] 세션 A에서 기본알림 시간/요일을 변경한다
  - [ ] 세션 B에서 같은 값으로 반영되는지 확인한다 (realtime 또는 새로고침 포함)
  - [ ] 두 세션 모두에서 앱 재시작/새로고침 후 값이 유지되는지 확인한다 (remote fetch)

- [ ] 세션 A에서 새 메모 자동알림과 할일 기본 알림시간/자동알림(분)을 바꾼다
  - [ ] 세션 B에서 같은 값으로 반영되는지 확인한다
  - [ ] 비로그인 창에서는 localStorage fallback이 유지되는지 확인한다 (로그인 후에는 서버값 우선)

### Phase R: 연쇄 업데이트 회귀 확인

- [ ] `isDefault: true` 메모가 있는 상태에서 기본알림 시간 변경 시, 기존 메모 알림이 예상대로 갱신되는지 확인한다
  - [ ] 세션 A에서 변경 직후 `ScheduledRemindersModal` 또는 알림 리스트에서 갱신을 확인한다
  - [ ] 세션 B에서도 동일하게 갱신/표시가 맞는지 확인한다 (중복 적용/폭주 여부 포함)

- [ ] `useGlobalRemind/useGlobalAutoAlert` 할일이 account settings 변경 후 예상대로 따라오는지 확인한다
  - [ ] 세션 A에서 변경 직후 기존 할일 알림 시각/분이 보정되는지 확인한다
  - [ ] 세션 B에서도 동일하게 보정되는지 확인한다 (지연 큐 flush 포함)

### Phase Z: 종료 처리

- [ ] 검증이 끝나면 `docs/plan/2026-04-24_apply-ma-user-settings-migration-and-validate-sync.md`를 `docs/archive/`로 이동하고 DONE/TODO 정리한다 (`/done`)

---

*상태: 초안 | 진행률: 0/7 (0%)*
