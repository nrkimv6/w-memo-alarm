# 알림 기본설정 계정단위 전환 및 기기 간 동기화

> 작성일시: 2026-04-24 22:27
> 기준커밋: 945bf4d
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/18 (0%)
> 요약: 현재 기본알림과 할일 기본 알림시간은 `localStorage` 기반이라 기기마다 달라질 수 있다. 이번 계획은 알림 기본설정을 Supabase의 계정 설정으로 승격하고, 다른 기기 변경도 자동 반영되도록 스토어와 초기화 순서를 재구성하는 데 목적이 있다.

---

## 개요

현재 `settingsStore`는 `memo-alarm-settings`를 `localStorage`에서만 읽고 쓰므로, 로그인한 동일 계정이라도 기기마다 `defaultReminder`, `autoReminderOnCreate`, `todoDefaults.remind.time`, `todoDefaults.autoAlert.minutesBefore`가 서로 다른 값을 가질 수 있다. 반면 기본알림을 사용하는 메모 자체는 `ma_memos`와 `alarm_schedules`로 동기화되기 때문에, “기본 정책은 기기별로 다르고 결과 데이터는 계정 전체에 공유되는” 비대칭 구조가 생긴다.

이 구조는 사용자가 기대하는 “내 계정의 기본 알림 정책”과 어긋난다. 따라서 이번 작업은 UI 설명만 정리하는 수준을 넘어서, 알림 기본설정의 저장 범위를 기기에서 계정으로 이동시키고, 다른 기기에서 변경한 설정도 현재 기기에 재반영되도록 만드는 구조 변경이 필요하다.

이번 계획의 핵심은 다음 세 가지다.

- 알림 기본설정의 저장소를 `localStorage`에서 계정별 Supabase row로 전환한다.
- 알림 기본설정과 기기 고유 설정을 분리해, 동기화 대상과 비동기화 대상을 명확히 나눈다.
- 설정 변경 시 기존 `isDefault` 메모/전역 할일 알림에 대한 연쇄 업데이트는 유지하되, 다른 기기에서는 서버 변경을 구독해 동일한 설정값을 보게 한다.

## 기술적 고려사항

- `src/lib/stores/settings.svelte.ts`는 현재 모든 설정을 단일 `AppSettings`로 묶어 `localStorage`에 저장한다. 계정단위 전환 시 `defaultReminder`, `autoReminderOnCreate`, `todoDefaults.remind`, `todoDefaults.autoAlert`와 같은 정책성 설정을 별도 서버 모델로 분리해야 한다.
- `src/routes/+layout.svelte`는 `settingsStore.init()`을 `authStore.initialize()`보다 먼저 호출한다. 계정 설정을 서버에서 읽으려면 초기화 순서를 바꾸거나, settings store 자체가 auth 상태 확정 후 서버 fetch/realtime subscribe를 수행하도록 설계해야 한다.
- `src/lib/stores/auth.svelte.ts`, `src/lib/stores/memos.svelte.ts`, `src/lib/stores/folders.svelte.ts`는 이미 로그인/로그아웃 시 `reinit()`와 cleanup 패턴을 사용한다. settings도 같은 패턴으로 맞추는 편이 현재 구조와 일관적이다.
- 기본알림 시간 변경 시 `src/lib/stores/memos.svelte.ts`의 `updateDefaultReminderMemos()`가 `isDefault === true` 메모를 일괄 갱신하고, 로그인 상태에서는 그 결과가 `ma_memos`와 `alarm_schedules`에 반영된다. 계정 설정 전환 이후에도 이 연쇄 효과는 유지되어야 한다.
- `src/lib/utils/data.ts`는 현재 기본알림 관련 설정을 백업 파일에 포함한다. 계정 설정이 서버 원본이 되면, 로그인 상태에서 백업 import가 계정 설정을 덮어쓸지, 로컬 복원 전용으로 제한할지 정책을 명시해야 한다.
- 동기화 범위는 최소화해야 한다. 테마, 알림 권한, FCM 토큰, 개발자 모드, Service Worker/브라우저 상태처럼 기기 고유인 값은 계속 로컬/기기 단위로 남겨야 한다.
- archive `docs/archive/2026-01-25_memo-alarm-default-custom-reminder.md`는 `isDefault` 기반 기본알림 추종 모델을 이미 정착시켰다. 이번 작업은 그 모델을 폐기하지 않고, 그 모델이 참조하는 “기본값 원천”만 계정단위로 옮겨야 한다.
- archive `docs/archive/2026-04-24_fix-settings-state-desync-on-cold-load.md`는 `settingsStore` 값을 컴포넌트 로컬 `$state`로 복사하는 안티패턴을 금지한다. 계정 설정 fetch/realtime 반영 이후에도 `settings/+page.svelte`, `QuickMemoInput.svelte` 같은 소비처는 `$derived` 기반 단일 원천을 유지해야 한다.
- archive `docs/archive/2026-04-24_redesign-settings-page.md`는 settings 허브 재디자인 범위에서 API/데이터 모델 확장을 의도적으로 제외했다. 이번 plan은 그 제한을 넘는 별도 후속 작업이므로, UI 수정은 서버 동기화 구조 변경을 설명하는 최소 범위로만 다루어야 한다.
- `src/lib/stores/settings.svelte.ts` 안의 `useMarkdown`, `todoDefaults.showOverdue`, `todoDefaults.showProgress`, `todoDefaults.showUpcomingOnEmpty`는 현재 기본알림과 같은 저장소에 섞여 있지만 성격은 상대적으로 기기 로컬에 가깝다. 어떤 필드를 account/device 어느 쪽에 둘지 표 형태로 먼저 확정하지 않으면 구현 중 scope drift가 발생한다.

---

## TODO

### Phase 0: Worktree 준비

- [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 계정 설정 스키마와 범위 정의

- [ ] **동기화 대상 필드를 계정/기기 두 그룹으로 확정한다** — scope drift 방지용 기준표를 먼저 만든다
  - [ ] `src/lib/stores/settings.svelte.ts`: `defaultReminder`, `autoReminderOnCreate`, `todoDefaults.remind`, `todoDefaults.autoAlert`, `useMarkdown`, `todoDefaults.showOverdue/showProgress/showUpcomingOnEmpty`의 현재 저장 구조를 표로 정리한다
  - [ ] `src/routes/settings/+page.svelte`: 계정 설정으로 승격할 UI 항목과 로컬에 남길 UI 항목을 섹션 단위로 매핑한다
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: 위 매핑을 기준으로 “계정단위/기기단위” 경계가 구현 중 바뀌지 않도록 기술적 고려사항에 반영한다

- [ ] **계정 설정 테이블 스키마 초안을 고정한다** — store 구현 전에 DB 계약을 명확히 한다
  - [ ] `data/migrations/`: 신규 파일 `012_account_scoped_notification_settings.sql` 이름과 생성 위치를 확정한다
  - [ ] `data/migrations/`: 새 마이그레이션에 `ma_user_settings` 또는 동등한 테이블의 컬럼/JSON 구조, `user_id` PK, `created_at`, `updated_at` 필드를 정의한다
  - [ ] `data/migrations/`: 새 마이그레이션의 `update_updated_at_column()` 재사용 또는 동등한 trigger 연결 방식을 현재 `ma_alarm_schedules`/`ma_user_devices` 패턴과 맞춘다
  - [ ] `data/migrations/`: 새 마이그레이션의 `auth.uid()` 기반 RLS SELECT/INSERT/UPDATE/DELETE 정책과 service-role 정책 필요 여부를 명시한다

### Phase 2: settings store 서버 연동

- [ ] **settingsStore 타입을 account/device 이중 구조로 분해한다** — 한 저장소에 섞인 정책성/기기성 필드를 분리한다
  - [ ] `src/lib/stores/settings.svelte.ts`: 기존 `AppSettings`를 대체할 `AccountSettings`, `DeviceSettings`, 결합 뷰 모델 타입 초안을 선언한다
  - [ ] `src/lib/stores/settings.svelte.ts`: 기존 `DEFAULT_SETTINGS`를 account/device 기본값으로 분리하고, `getDefaultReminder()`가 account 설정만 읽도록 재정의한다
  - [ ] `src/lib/stores/settings.svelte.ts`: `useMarkdown`과 기기 로컬 항목이 서버 upsert payload에 섞이지 않도록 직렬화 헬퍼를 분리한다

- [ ] **서버 fetch/upsert helper를 추가한다** — setter와 init 로직이 DB 세부 구현에 직접 묶이지 않게 만든다
  - [ ] `src/lib/stores/settings.svelte.ts`: `fetchAccountSettings(userId)` 또는 동등 helper를 추가해 비로그인/로그인 fallback 규칙을 한곳에 모은다
  - [ ] `src/lib/stores/settings.svelte.ts`: `upsertAccountSettings(userId, changes)` 또는 동등 helper를 추가해 부분 업데이트 payload 생성을 일원화한다
  - [ ] `src/lib/stores/settings.svelte.ts`: fetch 실패 시 로컬 fallback, upsert 실패 시 사용자 경험(낙관적 반영 유지/롤백 여부)을 코드 주석 또는 함수 계약으로 명시한다

- [ ] **realtime 구독과 cleanup 경로를 추가한다** — 다른 기기 변경이 현재 세션에 반영되게 한다
  - [ ] `src/lib/stores/settings.svelte.ts`: `ma_user_settings` realtime channel subscribe/unsubscribe 로직을 추가한다
  - [ ] `src/lib/stores/settings.svelte.ts`: 서버에서 받은 변경이 현재 로컬 optimistic 변경과 충돌할 때 `updated_at` 기준 last-write-wins로 합치는 규칙을 넣는다
  - [ ] `src/lib/stores/settings.svelte.ts`: `cleanup()`이 subscription 해제와 account/device state reset을 함께 수행하도록 `memosStore`/`foldersStore` 패턴에 맞춘다

- [ ] **settings setter를 서버 저장 계약에 맞게 재작성한다** — side effect와 persistence를 분리된 단계로 관리한다
  - [ ] `src/lib/stores/settings.svelte.ts`: `setDefaultReminderTime`, `setDefaultReminderDays`, `setAutoReminderOnCreate`를 account 설정 갱신 + 서버 upsert + 기존 메모 연쇄 업데이트 순서로 정리한다
  - [ ] `src/lib/stores/settings.svelte.ts`: `setTodoRemindEnabled`, `setTodoRemindTime`, `setTodoAutoAlertEnabled`, `setTodoAutoAlertMinutes`를 account 설정 갱신 + 서버 upsert + todo 연쇄 업데이트 순서로 정리한다
  - [ ] `src/lib/stores/settings.svelte.ts`: `setUseMarkdown`, `setTodoShowOverdue`, `setTodoShowProgress`, `setTodoShowUpcomingOnEmpty`는 device 로컬 저장 전용으로 남길지 여부를 분기 로직에 반영한다

### Phase 3: 앱 초기화와 인증 수명주기 정렬

- [ ] **layout 초기화 순서를 계정 설정 구조에 맞게 정렬한다** — cold load에서 잘못된 기본값 flash를 막는다
  - [ ] `src/routes/+layout.svelte`: `settingsStore.init()`이 auth 이전에 호출되어도 안전한지, 아니면 `authStore.initialize()` 뒤로 이동해야 하는지 선택 기준을 확정한다
  - [ ] `src/routes/+layout.svelte`: 초기 렌더에서 device settings만 먼저 쓰고 account settings는 auth 뒤에 hydrate할지 여부를 결정한다
  - [ ] `src/routes/+layout.svelte`: `notificationStore.init()`과 settings fetch 순서가 기존 알림 등록 흐름을 깨지 않는지 영향 범위를 메모한다

- [ ] **auth lifecycle에 settings reinit/cleanup을 연결한다** — 로그인/로그아웃/세션 전환마다 같은 규칙이 적용되게 한다
  - [ ] `src/lib/stores/auth.svelte.ts`: `SIGNED_IN` 시 `memosStore.reinit()`/`foldersStore.reinit()`와 함께 settings 재초기화 호출 지점을 추가한다
  - [ ] `src/lib/stores/auth.svelte.ts`: `SIGNED_OUT` 시 settings cleanup이 필요한지 결정하고, 필요하면 같은 cleanup 블록에 포함한다
  - [ ] `src/lib/stores/settings.svelte.ts`: `initializeWithSession()` 경로 이후 일반 layout 재진입 시 settings fetch가 중복/누락되지 않는 조건을 점검한다

- [ ] **기존 localStorage 설정의 서버 seed 규칙을 고정한다** — 최초 로그인과 기존 유저를 모두 안전하게 처리한다
  - [ ] `src/lib/stores/settings.svelte.ts`: 서버 row가 없고 로컬값만 있을 때 최초 1회 seed하는 helper를 추가한다
  - [ ] `src/lib/stores/settings.svelte.ts`: 서버 row가 이미 있으면 로컬 account 설정값을 덮어쓰지 않고 device-only 값만 유지하는 규칙을 명시한다
  - [ ] `src/lib/stores/settings.svelte.ts`: seed 완료 후 legacy localStorage에서 account 필드를 제거할지, 읽기 fallback만 남길지 정리한다

### Phase 4: 기존 메모/할일 연쇄 동작 보존

- [ ] **기본알림 추종 메모 업데이트가 중복 실행되지 않게 보정한다** — setter와 realtime 수신이 같은 변경을 두 번 적용하지 않게 한다
  - [ ] `src/lib/stores/memos.svelte.ts`: `updateDefaultReminderMemos()`가 현재 기기 setter 호출과 다른 기기 realtime 수신에서 각각 어떻게 호출될지 경로를 정리한다
  - [ ] `src/lib/stores/memos.svelte.ts`: account settings 반영 시 `updateDefaultReminderMemos`, `updateGlobalRemindTodos`, `updateGlobalAutoAlertTodos` 재실행 조건을 `old vs new` 비교 기준으로 구체화한다
  - [ ] `src/lib/stores/memos.svelte.ts`: 서버 재수신만으로는 이미 반영된 메모를 다시 update하지 않도록 guard 또는 호출 위치 분리를 설계한다

- [ ] **새 메모 생성 경로가 서버 동기화된 기본값을 읽도록 유지한다** — 모든 생성 진입점이 같은 account source를 보게 한다
  - [ ] `src/lib/components/memo/QuickMemoInput.svelte`: `settingsStore.settings.autoReminderOnCreate`와 `getDefaultReminder()`가 account 설정 hydrate 이후 값을 읽는지 확인한다
  - [ ] `src/lib/components/memo/QuickMemoInput.svelte`: 빠른 입력이 `isDefault`/반복 타입 계약을 그대로 유지하는지 점검한다
  - [ ] `src/lib/components/memo/MemoForm.svelte`: 새 메모 모달 초기 reminders 생성이 account settings 기준으로 유지되는지 확인한다
  - [ ] `src/lib/stores/memos.svelte.ts`: `add()` 내부 fallback 자동알림 로직이 QuickMemo/MemoForm과 의미상 어긋나지 않는지 확인한다

### Phase 5: UI, 백업, 문구 정리

- [ ] **settings 화면에서 계정단위와 기기단위를 명확히 구분한다** — 사용자가 동기화 범위를 바로 이해할 수 있게 한다
  - [ ] `src/routes/settings/+page.svelte`: 기본알림/할일 기본 알림시간 섹션에 `계정에 동기화됨` 또는 동등한 설명을 추가한다
  - [ ] `src/routes/settings/+page.svelte`: 테마, 권한, 개발자 진단, dev unlock처럼 기기 전용인 항목과 account 설정 섹션을 시각적으로 분리한다
  - [ ] `src/routes/settings/+page.svelte`: `defaultReminderMemoCount` 영향 안내가 account settings 변경 효과와 자연스럽게 이어지도록 문구를 보정한다

- [ ] **백업 import/export 정책을 account settings 구조에 맞게 정리한다** — 서버 원본과 파일 복원의 책임 충돌을 막는다
  - [ ] `src/lib/utils/data.ts`: export 시 account settings를 포함할지, 포함해도 device settings는 제외할지 구조를 다시 정의한다
  - [ ] `src/lib/utils/data.ts`: 로그인 상태 import가 서버 account settings를 덮어쓰는지 여부를 명시하고, 그에 맞는 처리 로직을 설계한다
  - [ ] `src/routes/settings/+page.svelte`: 백업/복원 UI 설명이 “계정 설정 포함 여부”를 오해 없이 전달하도록 문구를 보정한다

- [ ] **로그인/클라우드 안내 문구를 수정한다** — 설정도 계정과 함께 동기화된다는 점을 드러낸다
  - [ ] `src/routes/settings/+page.svelte`: 현재 “로그인하면 데이터가 자동으로 클라우드에 백업됩니다” 문구를 settings까지 포함하는 표현으로 수정한다
  - [ ] `src/routes/settings/+page.svelte`: 이미 로그인한 상태의 “클라우드 동기화 활성” 라벨이 메모/폴더뿐 아니라 account settings도 포함한다는 보조 문구를 추가한다
  - [ ] `src/routes/settings/+page.svelte`: device-only 항목에는 반대로 “이 기기에만 적용” 문구가 필요한지 판단한다

### Phase 6: 검증 및 회귀 확인

- [ ] **정적 검증을 수행한다** — 타입/컴파일 오류 없이 구조 변경이 닫히는지 확인한다
  - [ ] 프로젝트 루트: `npm run check`를 실행해 settings store 타입 변경과 settings route 수정이 Svelte/TypeScript 오류 없이 통과하는지 확인한다
  - [ ] `src/lib/stores/settings.svelte.ts`, `src/routes/settings/+page.svelte`, `src/lib/utils/data.ts`: 새 타입/필드명이 빌드 경로에서 누락되지 않는지 오류 목록 기준으로 재점검한다

- [ ] **2세션 account sync 시나리오를 검증한다** — 다른 기기 변경이 실제로 반영되는지 확인한다
  - [ ] 수동 시나리오: 세션 A에서 기본알림 시간/요일, 새 메모 자동알림, 할일 기본 알림시간을 바꾼 뒤 세션 B에 같은 값이 보이는지 확인한다
  - [ ] 수동 시나리오: 세션 B가 열린 상태에서 세션 A 변경을 realtime으로 받는지, 아니면 재진입/새로고침이 필요한지 동작을 기록한다
  - [ ] 수동 시나리오: 로그인하지 않은 창에서는 기존 local fallback이 유지되고, 로그인 후에는 서버값으로 전환되는지 확인한다

- [ ] **기존 메모/할일 side effect 회귀를 검증한다** — 정책 변경이 데이터 동기화와 어긋나지 않게 한다
  - [ ] 수동 시나리오: `isDefault: true` 메모가 있는 상태에서 기본알림 시간을 바꾸면 기존 메모 알림이 예상대로 갱신되는지 확인한다
  - [ ] 수동 시나리오: `useGlobalRemind/useGlobalAutoAlert` 할일이 account settings 변경 후 예상한 시각/분 값으로 따라오는지 확인한다
  - [ ] 수동 시나리오: QuickMemoInput, MemoForm, settings 화면이 같은 account 설정값을 보고 있는지 새 메모 생성 결과로 교차 검증한다
  - [ ] 가능하면 2기기 또는 2브라우저 세션에서 중복 update/충돌 징후를 관찰하고, 남으면 follow-up으로 남긴다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

- [ ] **post-merge 정리 확인** — `/merge-test` owner
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `main merge 시도`를 owner step으로 적는다
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `root dirty stash/apply (if needed)`를 owner step으로 적는다
  - [ ] `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

*상태: 검토완료 | 진행률: 0/18 (0%)*
