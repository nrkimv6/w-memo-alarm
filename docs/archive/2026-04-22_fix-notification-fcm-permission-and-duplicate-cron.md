# FCM 권한 오류 및 중복 cron으로 인한 notification 미발생 수정

> 작성일시: 2026-04-22 11:24
> 기준커밋: 34b8d3a
> 대상 프로젝트: memo-alarm, gifticon-manager
> 상태: 구현완료
> 진행률: 6/6 (100%) — Phase 5(운영 secret 교체) lineminder-23489 방향은 후속 plan `2026-04-22_realign-fcm-to-wservice-crossnoti`(wservice-cross-noti 방향 재정렬, 구현완료)에 의해 대체됨
> 대체 근거: 2026-04-23 사용자 배포 검증 — Cloudflare env 7종 정합 + Firebase 도메인 승인 + 새 토큰 등록 후 실제 알림 수신 확인 → realign plan으로 FCM 파이프라인 정상화 완료
> 요약: 2026-04-22 운영 DB와 `notification_logs`, `cron.job` 실조회 결과 현재 알림 미발생의 주원인은 브라우저 Firebase key가 아니라 `send-notifications` Edge Function의 FCM 권한 부재와 중복 cron 호출이다. 서버 자격증명 정합성, cron 단일화, 앱 내 진단 노출을 함께 정리해 같은 오진이 반복되지 않도록 한다.
>
> **실행 TODO:**
> - [gifticon-manager: Phase 1~2, R, 5](./2026-04-22_fix-notification-fcm-permission-and-duplicate-cron_todo-1.md) — child, 선행조건 없음
> - [memo-alarm: Phase 3~4, R, 5](./2026-04-22_fix-notification-fcm-permission-and-duplicate-cron_todo-2.md) — parent, 선행조건: `2026-04-22_fix-notification-fcm-permission-and-duplicate-cron_todo-1.md`

---

## 개요

2026-04-22 조사 기준 운영 `notification_logs`의 `memo-alarm/failed` 503건은 모두 `cloudmessaging.messages.create` 권한 거부로 수렴한다. 마지막 성공 발송은 2026-02-05 23:16 KST, 마지막 실패는 2026-04-22 08:25 KST이며, 현재 운영 DB에는 `alarm_schedules`, `user_devices`, `notification_logs`만 존재해 이전에 의심했던 `ma_*` 테이블 불일치는 실제 원인이 아니다.

같은 시점의 `cron.job`에는 `send-notifications`를 매분 호출하는 job이 2개(`send-fcm-notifications-every-minute`, `send-notifications-every-minute`) 활성화되어 있었고, 과거 `send-push` legacy job도 남아 있었다. 이 상태에서는 FCM 권한을 복구해도 중복 발송이 재발할 수 있으므로, 서버 자격증명 수정과 cron 정리를 하나의 작업 묶음으로 관리해야 한다.

또한 현재 [`src/routes/settings/+page.svelte`](../../src/routes/settings/+page.svelte)는 `user_devices`, `alarm_schedules`, 클라이언트 env 상태만 보여주고 서버측 `notification_logs`의 실패 원인과 최근 success/failed 흐름은 노출하지 않는다. 그래서 실제 장애가 서버 권한 문제여도 다시 "key 문제"로 오판하기 쉽다.

## 기술적 고려사항

- `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`는 `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`를 읽지만, 현재 로그는 "env 존재 여부"만 남기고 어떤 프로젝트/서비스 계정으로 발송하려 했는지 충분히 드러내지 않는다.
- `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`은 canonical job 하나만 관리하지만, 운영 DB에는 동일 endpoint를 치는 중복 job이 별도로 남아 있다. 마이그레이션/운영 정리 둘 다 idempotent하게 설계해야 한다.
- `src/routes/settings/+page.svelte`의 `checkFCMStatus()`는 사용자 단위 `user_devices`와 `alarm_schedules`는 읽을 수 있으므로, 같은 범위의 `notification_logs`까지 묶으면 클라이언트 등록 상태와 서버 발송 실패를 한 화면에서 대조할 수 있다.
- 현재 권한 오류에서는 `NotRegistered` 분기까지 도달하지 못하므로 active 토큰 정리 로직이 작동하지 않는다. 토큰 정리는 부수 이슈이며, 우선순위는 FCM 권한 복구와 cron 중복 제거가 더 높다.

### 재검토 보강 (2026-04-22, /review-plan)

- 🟡 **멀티 레포 범위**: 본 plan은 `memo-alarm` 레포의 UI 파일과 `gifticon-manager` 레포의 Edge Function/migration을 함께 수정한다. 커밋은 각각의 레포에서 분리 수행하며, 실행 순서는 `gifticon-manager`(Phase 1, 2) → `memo-alarm`(Phase 3, 4) → 운영 검증(Phase 5). Phase 3/4 구현은 서버 배포를 기다리지 않아도 되지만, Phase 5 검증은 Phase 1, 2 배포 이후에만 의미가 있다.
- 🟡 **기존 migration 재편집 리스크**: `010_fcm_pg_cron.sql`은 이미 배포된 파일이다. Supabase CLI는 동일 `migration_name`의 재실행을 건너뛰므로, 기존 파일 body 수정만으로는 운영 DB에 반영되지 않는다. 두 경로 중 하나를 선택한다 — (a) 운영 DB에 SQL을 직접 실행(우선 순위 높음), (b) 후속 migration(`011_*.sql`)을 신규 생성해 `unschedule` 블록 추가. Phase 2는 두 경로 모두 포함한다.
- 🟡 **legacy hourly job 잔존 가능성**: `004_pg_cron_push.sql`이 `send-push-notifications-hourly`(매시간)를 활성화해 `/send-push` 엔드포인트를 호출하도록 기록한다. plan 조사 시점의 "중복 job 2개" 외에도 이 hourly job이 남아 있을 수 있어, Phase 2 검증 쿼리에 hourly job까지 포함한다.
- 🟡 **로그 민감정보 경계**: Edge Function 응답/`notification_logs.error_message`에는 `client_email` 전체 값을 넣지 않는다. project_id와 client_email의 도메인부(`@...iam.gserviceaccount.com`) 또는 해시 접두부까지만 노출해 service account 식별자 노출을 최소화한다.
- 🟡 **notification_logs RLS**: settings UI에서 Supabase 클라이언트로 `notification_logs`를 SELECT 하려면 RLS가 본인 `user_id` 행만 허용해야 한다. 본 plan 구현 전 `notification_logs`의 RLS 정책을 확인해 미설정이면 Phase 3에서 보강한다.
- 🟢 **Phase T1~T5 미적용 사유**: 본 plan은 TypeScript Edge Function + SQL + Svelte UI만 수정하며 Python/FastAPI 백엔드 변경이 없으므로 expand-todo의 5-Phase 테스트 블록은 필수 대상이 아니다. 대신 Phase 5 수동 검증을 유지한다.
- 🟢 **main drift**: 기준커밋 `34b8d3a` 이후 memo-alarm 레포의 코드 변경은 없으며, plan/TODO 문서만 추가됨. gifticon-manager 레포의 동일 기간 드리프트는 수정 직전 `git status`로 추가 확인한다.

---

## TODO

### Phase 1: Edge Function 진단 강화 (레포: gifticon-manager)

1. - [ ] **FCM 자격증명 파싱·로깅을 표준화한다**
   - [ ] `gifticon-manager/supabase/functions/send-notifications/index.ts`: `ServiceAccount` 파싱 직후 `parsedProjectId = serviceAccount.project_id`, `parsedClientEmailDomain = serviceAccount.client_email.split('@')[1]`를 추출해 `console.log("[FCM] service account", { parsedProjectId, parsedClientEmailDomain })`로 기록한다.
   - [ ] `gifticon-manager/supabase/functions/send-notifications/index.ts`: `parsedProjectId !== firebaseProjectId`이면 `console.error("[FCM] project_id mismatch", { env: firebaseProjectId, serviceAccount: parsedProjectId })`를 발생시키고, 이어서 발송 루프를 스킵한 뒤 응답 body에 `{ error: "FCM_PROJECT_ID_MISMATCH", env_project_id, service_account_project_id }`를 포함한다.
   - [ ] `gifticon-manager/supabase/functions/send-notifications/index.ts`: `client_email` 원문 전체는 로그·응답·`notification_logs`에 기록하지 않고 도메인부만 기록 — 민감정보 최소 노출 원칙을 주석(`// masked for privacy: client_email domain only`) 한 줄로 명시한다.

2. - [ ] **권한 오류 문자열을 정규화해 클라이언트/로그에서 동일 키워드로 검색 가능하게 한다**
   - [ ] `gifticon-manager/supabase/functions/send-notifications/index.ts`: FCM 응답 처리부(현 `if (fcmResponse.ok) { ... } else { ... }`)에서 `normalizeFcmError(rawMessage: string): { code: 'PERMISSION_DENIED' | 'INVALID_ARGUMENT' | 'UNREGISTERED' | 'UNKNOWN'; message: string }` 함수를 추가한다. 핵심 로직: `raw.includes('cloudmessaging.messages.create')` 또는 `raw.includes('PermissionDenied')` → `PERMISSION_DENIED`, `raw.includes('not found')` → `PROJECT_NOT_FOUND`, `raw.includes('UNREGISTERED')` → `UNREGISTERED`, 외 `UNKNOWN`.
   - [ ] `gifticon-manager/supabase/functions/send-notifications/index.ts`: `deviceResults.push({ success: false, error: fcmResult.error?.message })`를 `{ success: false, error: normalized.message, code: normalized.code }`로 변경하고, 이어 `errors.join("; ")`에서 `"[${code}] ${message}"` 형식으로 직렬화해 `notification_logs.error_message`에 기록한다.
   - [ ] `gifticon-manager/supabase/functions/send-notifications/index.ts`: Access token 발급 실패 경로(`Failed to authenticate with FCM`)도 `code: "FCM_AUTH_FAILED"`로 정규화하고 응답·로그에서 동일 키워드를 사용한다.

### Phase 2: 중복 cron 정리 (레포: gifticon-manager)

3. - [ ] **canonical job 1개만 남기는 idempotent cleanup SQL을 migration으로 정의한다**
   - [ ] `gifticon-manager/supabase/migrations/010_fcm_pg_cron.sql`: 기존 `cron.unschedule('send-fcm-notifications-every-minute')` 블록 아래에 legacy/중복 3종 제거 블록 추가 — `DO $$ BEGIN PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('send-notifications-every-minute', 'send-push-notifications-every-minute', 'send-push-notifications-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;` 형태로 이미 없어도 실패하지 않도록 한다.
   - [ ] `gifticon-manager/supabase/migrations/010_fcm_pg_cron.sql`: 파일 하단 주석 쿼리(`-- SELECT * FROM cron.job;`)를 활성화된 canonical 기준으로 교체 — `SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname IN ('send-fcm-notifications-every-minute','send-notifications-every-minute','send-push-notifications-every-minute','send-push-notifications-hourly') ORDER BY jobid;`. 이 쿼리는 재점검 시 바로 복붙할 수 있도록 블록 주석으로 감싼다.

4. - [ ] **운영 DB에 반영할 경로를 명시한다 (기존 migration 재실행은 Supabase CLI에서 스킵됨)**
   - [ ] `gifticon-manager/supabase/migrations/010_fcm_pg_cron.sql`: 파일 상단에 한 줄 주석 추가 — `-- 주의: 이 파일은 이미 배포됨. 재실행 불가. 운영 반영은 아래 쿼리를 Supabase SQL editor에 붙여넣어 직접 실행한다.`
   - [ ] `gifticon-manager/supabase/migrations/010_fcm_pg_cron.sql`: 직접 실행용 블록을 파일 하단에 블록 주석(`/* DIRECT-RUN ... */`)으로 추가. 내용: 위 3종 `unschedule` + `send-fcm-notifications-every-minute` 재생성(신규 service role key 사용 가정) — Phase 5에서 실제 실행.

### Phase 3: 설정 페이지 서버측 상태 노출 (레포: memo-alarm)

5. - [ ] **`checkFCMStatus()`에 `notification_logs` 조회를 추가한다**
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: `fcmStatus` 상태 객체(현 L80~L100)에 `notificationLogs: Array<{status: string; error_message: string | null; sent_at: string}>`, `lastSuccessAt: string | null`, `lastFailedAt: string | null`, `lastErrorMessage: string | null` 필드를 추가한다.
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: `checkFCMStatus()` 함수(현 L225)에서 `alarm_schedules` 조회 직후 `supabase.from('notification_logs').select('status, error_message, sent_at').eq('user_id', authStore.user.id).eq('app_name', 'memo-alarm').order('sent_at', { ascending: false }).limit(10)` 실행, 결과를 `fcmStatus.notificationLogs`에 저장하고 첫 `status==='success'` 행의 `sent_at`을 `lastSuccessAt`, 첫 `status==='failed'` 행의 `sent_at`·`error_message`를 `lastFailedAt`·`lastErrorMessage`에 저장한다.
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: 조회 실패 시 `fcmStatus.error`에 `"notification_logs 조회 실패: " + error.message`를 설정, RLS 거부 메시지(`permission denied`)를 감지하면 추가 안내 문자열 `"notification_logs RLS 정책이 user_id 매칭 SELECT를 허용해야 합니다."`를 표시한다.

6. - [ ] **"서버측 FCM 상태" 섹션을 devMode UI에 추가한다**
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: 기존 "FCM 웹 푸시 상태" 섹션(현 L1449~L1573) 마지막 `{#if fcmStatus.error}` 직전에 `<div class="text-xs space-y-1 p-2 rounded bg-muted">` 블록으로 "서버측 FCM 상태" 카드 추가 — 내용: `마지막 성공: {fcmStatus.lastSuccessAt ?? '없음'}`, `마지막 실패: {fcmStatus.lastFailedAt ?? '없음'}`, `마지막 오류: {fcmStatus.lastErrorMessage ?? '없음'}`.
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: 동일 카드 아래에 최근 10건 로그를 `{#each fcmStatus.notificationLogs as log}` 루프로 렌더 — 각 행에 `status==='success'`이면 `CheckCircle`, `failed`이면 `XCircle` 아이콘을 표시, `error_message`는 `normalizeFcmError` 결과의 `[CODE]` 접두어를 그대로 표시해 서버 Phase 1 포맷과 대조 가능하게 한다.

### Phase 4: 클라이언트/서버 진단 정합성 맞춤 (레포: memo-alarm)

7. - [ ] **`getFCMConfigStatus()`가 서버 비교에 쓸 식별자를 반환하도록 확장한다**
   - [ ] `memo-alarm/src/lib/fcm.ts`: `getFCMConfigStatus()` 반환 타입에 `envProjectId: string | null`(= `PUBLIC_FIREBASE_PROJECT_ID`)와 `messagingSenderId: string | null`(= `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`) 필드를 추가한다. 기존 `projectId` 필드는 하위 호환 유지.
   - [ ] `memo-alarm/src/lib/fcm.ts`: 함수 상단 주석에 `// 반환값은 settings devMode UI에서 서버측 notification_logs.error_message에 기록된 project_id와 대조하기 위한 식별자만 포함 (키 원문 미노출)`을 추가한다.

8. - [ ] **UI에서 "브라우저 key 문제"와 "서버 권한 문제"를 시각적으로 구분한다**
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: "환경 변수" 카드(현 L1466) 아래에 "클라이언트 ↔ 서버 Project ID 비교" 줄 추가 — `fcmStatus.projectId` vs `fcmStatus.lastErrorMessage` 내 `project_id` 문자열을 단순 비교해 일치하면 녹색 배지, 불일치하면 주황색 배지와 `"서버 발송이 다른 프로젝트로 시도되고 있을 수 있습니다."` 힌트 문구를 출력한다.
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: `fcmStatus.lastErrorMessage`가 `"[PERMISSION_DENIED]"`로 시작하면 "클라이언트 key가 아니라 서버 서비스 계정 권한이 원인" 안내 박스(파랑)를 노출, `"[FCM_PROJECT_ID_MISMATCH]"`면 빨강 박스로 "env와 service account 프로젝트 불일치"를 노출한다.
   - [ ] `memo-alarm/src/routes/settings/+page.svelte`: 활성 토큰 수(`fcmStatus.userDevices.filter(d => d.is_active).length`)를 비교 카드에 함께 표시해 "토큰 없음 vs 권한 오류"를 혼동하지 않게 한다.

### Phase R: 재발 경로 분석 (fix: plan 필수)

9. - [ ] **수정 대상 함수/변수/cron 이름의 모든 참조 경로 열거**
   - [ ] `gifticon-manager` 전 경로에서 `Grep "send-notifications"`, `Grep "send-push"`, `Grep "cron.schedule"` 실행 결과를 표(경로 | 목적 | 방어여부)로 기록한다. 경로별로 "본 plan 이후에도 동일 권한 오류 또는 중복 호출이 재발할 수 있는가?" 판정을 붙인다.
   - [ ] `memo-alarm` 전 경로에서 `Grep "notification_logs"`, `Grep "FIREBASE_PROJECT_ID"`, `Grep "getFCMConfigStatus"` 실행 결과를 동일 표로 기록해, UI 외 다른 코드에서 `notification_logs`를 조회하거나 Firebase 설정을 분기 없이 사용하는지 확인한다.
   - [ ] Supabase Edge Functions 디렉토리(`gifticon-manager/supabase/functions/*`)에 `send-notifications` 외 `FIREBASE_SERVICE_ACCOUNT`를 읽는 함수가 더 있는지 `Grep "FIREBASE_SERVICE_ACCOUNT" --path functions` 검색해, 있으면 같은 service account 교체의 영향을 받는 함수 목록을 정리한다.

10. - [ ] **미방어 경로에 대한 방어 조치 적용**
    - [ ] Phase R 9에서 식별된 미방어 경로별 처리 계획을 기술적 고려사항에 추가 또는 해당 Phase에 하위 체크박스로 추가 — 각 경로가 `normalizeFcmError`, `project_id mismatch 검사`, `cron cleanup 쿼리` 중 어느 조치로 방어되는지 명시한다.
    - [ ] 모든 경로 방어 완료 후 "전체 방어 완료" 라인을 본 plan 하단 `## 검증`에 한 줄 추가. "근본 수정" 표현 사용 금지 — 방어된 경로 수/총 경로 수로 수치 표기.

### Phase 5: 운영 반영 후 재검증 (레포: gifticon-manager + memo-alarm)

11. - [ ] **Supabase Edge Function secret 교체 및 직접 SQL 실행**
    - [ ] Supabase 대시보드 > Edge Functions > `send-notifications` > Secrets 에서 `FIREBASE_SERVICE_ACCOUNT` JSON을 `lineminder-23489`(또는 현 운영 project_id) 대상 `cloudmessaging.messages.create` 권한 보유 service account로 교체하고, `FIREBASE_PROJECT_ID`가 해당 service account의 `project_id`와 일치하는지 확인한다.
    - [ ] Supabase SQL editor에서 Phase 2의 DIRECT-RUN 블록(3종 `unschedule` + canonical 재생성)을 직접 실행하고, `SELECT jobid, jobname, active FROM cron.job WHERE jobname LIKE 'send-%' ORDER BY jobid;`로 활성 job이 `send-fcm-notifications-every-minute` 1건인지 확인한다.
    - [ ] Edge Function 콘솔 로그에서 다음 분(mm+1) 호출 시 `[FCM] service account` 라인이 교체된 `project_id`/`client_email_domain`으로 찍히는지 확인, `project_id mismatch` 에러가 0건인지 확인한다.

12. - [ ] **앱 내 진단으로 서버 발송 회복을 수동 검증**
    - [ ] `memo-alarm/src/routes/settings/+page.svelte` 개발자 모드에서 `lastFailedAt`이 운영 반영 시각 이후로 멈추고 `lastSuccessAt`이 갱신되는지 확인한다.
    - [ ] 최근 10건 로그에서 `[PERMISSION_DENIED]` 접두어가 사라지고 `status='success'` 비율이 회복되는지 확인한다.
    - [ ] 활성 토큰 수 ≥ 1이고 "클라이언트 ↔ 서버 Project ID 비교"가 녹색 배지인 상태에서 실제 스케줄이 걸린 시각에 푸시 알림이 수신되는지 디바이스에서 확인한다.

---

## 검증

### 운영 확인 쿼리

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'send-fcm-notifications-every-minute',
  'send-notifications-every-minute',
  'send-push-notifications-every-minute',
  'send-push-notifications-hourly'
)
order by jobid;
```

- 기대 결과: 활성 job은 canonical 이름(`send-fcm-notifications-every-minute`) 1개만 남음

```sql
select app_name, status, error_message, sent_at
from notification_logs
where app_name = 'memo-alarm'
order by sent_at desc
limit 20;
```

- 기대 결과: 최근 행에 `[PERMISSION_DENIED]` 접두어가 반복되지 않고 `status='success'`가 다시 기록됨. `error_message`가 있으면 Phase 1의 `normalizeFcmError` 포맷(`[CODE] message`)과 일치해야 함.

```sql
select jobname, count(*) as run_count,
       sum(case when status='succeeded' then 1 else 0 end) as ok,
       sum(case when status='failed'    then 1 else 0 end) as fail
from cron.job_run_details
where start_time > now() - interval '1 hour'
  and jobname like 'send-%'
group by jobname;
```

- 기대 결과: `send-fcm-notifications-every-minute`만 1시간 60회 수준, 다른 jobname은 0건.

### 수동 확인

- 설정 페이지 개발자 모드에서 `user_devices`, `alarm_schedules`, `notification_logs`를 한 번에 확인할 수 있어야 한다.
- 브라우저 Firebase env가 정상이어도 서버 권한 오류가 별도 배지/메시지로 드러나야 한다.
- cron 중복 제거 후 같은 시각의 debug/success/failed 로그가 쌍으로 반복되지 않아야 한다.
- Phase R에서 식별한 모든 참조 경로가 `방어됨`으로 판정되어야 한다 ("방어 N/N" 형태로 기록).

---

## 영향 파일

| 파일 | 역할 | 레포 |
|------|------|------|
| `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts` | FCM 서비스 계정 진단, 권한 오류 정규화, 운영 secret 검증 기준 | gifticon-manager |
| `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql` | 중복 cron 정리와 canonical job 유지 + DIRECT-RUN 쿼리 보관 | gifticon-manager |
| `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts` | 클라이언트 FCM config status 정리(envProjectId/messagingSenderId 노출) | memo-alarm |
| `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte` | 서버측 알림 상태/로그 + 클라이언트 vs 서버 프로젝트 비교 UI | memo-alarm |

---

## Phase 요약

- Phase 1: Edge Function 진단 강화 — 2개 상위 작업 / 6개 원자 작업
- Phase 2: 중복 cron 정리 — 2개 상위 작업 / 4개 원자 작업
- Phase 3: 설정 페이지 서버측 상태 노출 — 2개 상위 작업 / 5개 원자 작업
- Phase 4: 클라이언트/서버 진단 정합성 — 2개 상위 작업 / 5개 원자 작업
- Phase R: 재발 경로 분석 — 2개 상위 작업 / 5개 원자 작업
- Phase 5: 운영 반영 후 재검증 — 2개 상위 작업 / 6개 원자 작업

총 12개 상위 작업 / 31개 원자 작업

*상태: 구현중 | 진행률: 5/6 (83%)*
