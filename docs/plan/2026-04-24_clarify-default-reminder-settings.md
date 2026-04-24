# 알림 기본설정 계정단위 전환 및 기기 간 동기화

> 작성일시: 2026-04-24 22:27
> 기준커밋: 945bf4d
> 대상 프로젝트: memo-alarm
> 상태: 초안
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/6 (0%)
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

---

## TODO

### Phase 0: Worktree 준비

0. ☐ **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: 계정 설정 스키마와 범위 정의

1. ☐ **알림 기본설정의 계정단위 저장 계약을 확정** — 어떤 값이 서버 동기화 대상인지 먼저 고정한다
   - ☐ `data/migrations/`: `012_account_scoped_notification_settings.sql` 신규 마이그레이션을 추가하고, `ma_user_settings` 또는 동등한 테이블의 `user_id` PK, 알림 기본설정 JSON/컬럼, `updated_at` 트리거, RLS 정책을 정의한다
   - ☐ `src/lib/stores/settings.svelte.ts`: 서버 동기화 대상(account settings)과 로컬 전용(device settings)을 분리한 타입/기본값 구조를 설계한다
   - ☐ `src/routes/settings/+page.svelte`: 계정단위로 올라갈 값과 기기단위로 남을 값을 화면 섹션 기준으로 분리할 수 있도록 현재 렌더링 의존 항목을 식별한다

### Phase 2: settings store 서버 연동

2. ☐ **settingsStore를 Supabase 기반으로 재구성** — fetch, upsert, realtime 구독을 추가한다
   - ☐ `src/lib/stores/settings.svelte.ts`: 로그인 시 서버 설정 fetch, 비로그인 시 로컬 fallback, 로그아웃 시 cleanup이 가능한 `init/reinit/cleanup` 흐름을 추가한다
   - ☐ `src/lib/stores/settings.svelte.ts`: `setDefaultReminderTime`, `setDefaultReminderDays`, `setAutoReminderOnCreate`, `setTodoRemindTime`, `setTodoAutoAlertMinutes`가 로컬 반영 후 서버 upsert까지 수행하도록 바꾼다
   - ☐ `src/lib/stores/settings.svelte.ts`: 다른 기기 변경을 받기 위한 realtime subscription과 `updated_at` 기반 last-write-wins 반영 규칙을 넣는다

### Phase 3: 앱 초기화와 인증 수명주기 정렬

3. ☐ **settings 초기화 순서를 auth와 맞춘다** — 잘못된 로컬값 flash와 로그인 직후 불일치를 막는다
   - ☐ `src/routes/+layout.svelte`: `settingsStore.init()` 호출 순서를 재검토하고, auth 확정 전/후에 어떤 설정을 먼저 보여줄지 명시적으로 제어한다
   - ☐ `src/lib/stores/auth.svelte.ts`: `SIGNED_IN`, `SIGNED_OUT` 시점에 settings store가 memos/folders와 같은 방식으로 재초기화 또는 정리되도록 연결한다
   - ☐ `src/lib/stores/settings.svelte.ts`: 기존 `localStorage`의 알림 기본설정을 최초 로그인 시 서버로 seed할지, 서버값이 있으면 폐기할지 마이그레이션 규칙을 함수 단위로 명시한다

### Phase 4: 기존 메모/할일 연쇄 동작 보존

4. ☐ **계정 설정 변경이 기존 데이터에 미치는 효과를 유지** — 기본알림 추종 메모와 전역 할일 정책이 계속 맞물리게 한다
   - ☐ `src/lib/stores/memos.svelte.ts`: settings setter 호출 후 `updateDefaultReminderMemos`, `updateGlobalRemindTodos`, `updateGlobalAutoAlertTodos`가 기존처럼 동작하되 다른 기기 재수신 시 중복 적용되지 않는지 검토한다
   - ☐ `src/lib/components/memo/QuickMemoInput.svelte`: 계정 설정에서 읽은 기본알림 계약을 그대로 사용하도록 유지하고, 빠른 입력 경로의 `isDefault`/반복 타입 의미가 store 계약과 어긋나지 않게 확인한다
   - ☐ `src/lib/components/memo/MemoForm.svelte`: 새 메모 생성 모달이 서버 동기화된 기본값을 기준으로 초기 알림을 붙이는지 확인하고, 로컬 fallback과 로그인 경로를 함께 점검한다

### Phase 5: UI, 백업, 문구 정리

5. ☐ **사용자에게 계정단위 동기화 범위를 명확히 노출** — 무엇이 계정에 저장되고 무엇이 기기마다 다른지 드러낸다
   - ☐ `src/routes/settings/+page.svelte`: 기본알림/할일 기본 알림시간 섹션에 `계정에 동기화됨` 성격의 설명을 추가하고, 테마/권한/개발자 진단과 시각적으로 분리한다
   - ☐ `src/lib/utils/data.ts`: 백업 export/import가 계정 설정과 어떤 관계를 가지는지 맞춘다. 로그인 상태에서 import가 서버 설정을 갱신할지, 비로그인 복원 전용으로 제한할지 정책을 코드와 메시지에 반영한다
   - ☐ `src/routes/settings/+page.svelte`: 로그인 안내 문구가 “데이터만 클라우드 동기화”로 오해되지 않도록 계정 설정 동기화 범위를 함께 설명한다

### Phase 6: 검증 및 회귀 확인

6. ☐ **계정단위 동기화 시나리오를 검증** — 두 기기에서 같은 설정을 보면서 기존 알림 동작도 유지되는지 확인한다
   - ☐ 수동 시나리오: 기기 A에서 기본알림 시간/요일, 새 메모 자동알림, 할일 기본 알림시간을 바꾼 뒤 기기 B에서 동일 값으로 반영되는지 확인한다
   - ☐ 수동 시나리오: 기기 A에서 기본알림 시간을 바꾸면 `isDefault: true` 메모와 `useGlobalRemind/useGlobalAutoAlert` 할일이 서버를 통해 기기 B에서도 같은 결과를 보이는지 확인한다
   - ☐ 수동 시나리오: 로그아웃 상태에서는 로컬 fallback이 동작하고, 로그인 후에는 서버 설정이 우선하는지 확인한다
   - ☐ 검증 명령: `npm run check`를 실행해 Svelte/TypeScript 오류가 없는지 확인한다
   - ☐ 가능하면 2기기 또는 2브라우저 세션에서 realtime 반영 지연/충돌을 관찰하고, 불가하면 follow-up으로 남긴다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. ☐ **post-merge 정리 확인** — `/merge-test` owner
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `main merge 시도`를 owner step으로 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `root dirty stash/apply (if needed)`를 owner step으로 적는다
   - ☐ `docs/plan/2026-04-24_clarify-default-reminder-settings.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.

---

*상태: 초안 | 진행률: 0/6 (0%)*
