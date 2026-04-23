# FCM 권한 오류 및 중복 cron으로 인한 notification 미발생 수정 — TODO 1

> 계획서: [plan](./2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md)
> 대상 프로젝트: gifticon-manager
> 실행순서: 1
> 선행조건: 없음
> 테스트명령: Supabase SQL editor + Edge Function 로그 + `cron.job`/`notification_logs` 확인
> 상태: 구현중
> 진행률: 26/34 (76%)
> branch: impl/fix-notification-fcm-permission-and-duplicate-cron
> worktree: D:/work/project/tools/gifticon-manager/.worktrees/impl-fix-notification-fcm-permission-and-duplicate-cron
> worktree-owner: D:\work\project\service\wtools\memo-alarm\docs\plan\2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md
> 요약: `send-notifications` Edge Function의 서비스 계정 진단과 FCM 오류 정규화를 추가하고, 중복 cron job 정리 및 운영 반영 절차를 명시한다.

## Phase 1: Edge Function 진단 강화

1. - [x] **서비스 계정 파싱 결과를 안전하게 로그/응답에 노출한다**
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `ServiceAccount` 파싱 직후 `parsedProjectId`, `parsedClientEmailDomain`를 추출하는 헬퍼 상수 추가. `parsedClientEmailDomain`은 `serviceAccount.client_email.split('@')[1] ?? null`로 계산하고, `client_email` 원문 전체는 보관하지 않는다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: 기존 `console.log("[FCM] Service Account parsed, private_key length:", ...)`를 `{ parsedProjectId, parsedClientEmailDomain, hasPrivateKey: boolean }` 구조 로그로 교체해 실제 project 식별이 가능하도록 수정한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `// masked for privacy: client_email domain only` 주석을 추가해 민감정보 비노출 의도를 코드에 남긴다.

2. - [x] **env project와 service account project 불일치를 조기 실패로 바꾼다**
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `parsedProjectId`와 `firebaseProjectId`가 모두 존재하고 값이 다르면 `return new Response(JSON.stringify({ error: 'FCM_PROJECT_ID_MISMATCH', env_project_id: firebaseProjectId, service_account_project_id: parsedProjectId }), { status: 500, ... })`로 조기 반환하는 가드 추가.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: 위 mismatch 분기에서 `console.error("[FCM] project_id mismatch", { envProjectId: firebaseProjectId, serviceAccountProjectId: parsedProjectId })`를 남겨 운영 로그 검색 키를 고정한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: mismatch 시 디버그 `notification_logs`와 발송 루프가 추가로 실행되지 않도록 가드 위치를 `createClient()` 이후, 스케줄 조회 전으로 고정한다.

3. - [x] **FCM 에러를 코드화해 `notification_logs`와 응답 포맷을 통일한다**
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `type NormalizedFcmErrorCode = 'PERMISSION_DENIED' | 'PROJECT_NOT_FOUND' | 'INVALID_ARGUMENT' | 'UNREGISTERED' | 'FCM_AUTH_FAILED' | 'UNKNOWN'`와 `normalizeFcmError(rawMessage: string | undefined) -> { code: NormalizedFcmErrorCode; message: string }` 헬퍼 추가.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `fcmResponse.ok === false` 분기에서 `fcmResult.error?.message`를 바로 저장하지 말고 `normalizeFcmError()`를 거쳐 `deviceResults.push({ success: false, code, error: message })` 형식으로 저장하도록 수정한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `errors.join("; ")` 직렬화를 `[${code}] ${message}` 패턴으로 변경해 `notification_logs.error_message`와 UI 검색 키를 고정한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `getAccessToken()` 실패 catch 경로도 `FCM_AUTH_FAILED` 코드로 감싸고, 응답 body와 콘솔 로그에 같은 코드 문자열을 사용한다.

## Phase 2: 중복 cron 정리

4. - [x] **중복 job 정리 SQL을 idempotent하게 작성한다**
   - [x] `D:\work\project\tools\gifticon-manager\supabase\migrations\013_fix_duplicate_notification_crons.sql`: `send-notifications-every-minute`, `send-push-notifications-every-minute`, `send-push-notifications-hourly`를 이름 기준으로 제거하는 실행 가능한 cleanup migration 추가. fresh DB에서는 010이 canonical job을 만들고, 013이 legacy job만 정리한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: 013 cleanup migration과 DIRECT-RUN 블록을 참조하도록 주석을 보강하고, canonical job `send-fcm-notifications-every-minute`를 유지해야 한다는 의도를 명시한다.

5. - [x] **운영 재점검용 쿼리와 직접 실행 블록을 보강한다**
   - [x] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: 파일 상단에 `-- 주의: 이미 배포된 migration이므로 운영 반영은 아래 DIRECT-RUN 블록 또는 신규 migration으로 수행` 한 줄을 추가한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: 파일 하단에 `cron.job`, `cron.job_run_details` 확인용 블록 주석과 `DIRECT-RUN` 블록을 추가해 SQL editor에서 즉시 재현 가능한 형태로 남긴다.

## Phase R: 재발 경로 분석

6. - [x] **중복 호출과 service account 참조 경로를 전수 조사한다**
   - [x] `D:\work\project\tools\gifticon-manager`: `rg -n "send-notifications|send-push|cron.schedule" supabase docs src` 결과를 표로 정리하고, 각 경로가 `중복 cron`, `legacy endpoint`, `문서 참조` 중 무엇인지 분류한다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions`: `rg -n "FIREBASE_SERVICE_ACCOUNT" .` 결과를 확인해 현재 service account env를 읽는 함수가 `send-notifications` 하나뿐인지 검증한다.
   - [x] `D:\work\project\tools\gifticon-manager\src\lib\services\fcmService.ts`: quickuse 클라이언트의 `PUBLIC_FIREBASE_PROJECT_ID` 사용이 서버 service account 계약과 무관함을 재확인하고, 이번 수정 범위 제외 근거를 표에 남긴다.

7. - [x] **미방어 경로를 운영 정리 절차로 연결한다**
   - [x] `D:\work\project\tools\gifticon-manager\supabase\migrations\004_pg_cron_push.sql`: `send-push-notifications-hourly`가 여전히 활성화될 수 있는 legacy 경로임을 표에 기록하고, Phase 2 cleanup 블록이 이 경로를 방어하도록 연결 근거를 남긴다.
   - [x] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: mismatch 가드와 정규화 에러 코드가 각각 `project 불일치`, `권한 실패`, `토큰 만료` 경로를 어떻게 방어하는지 표에 대응시킨다.

### Phase R 결과 (2026-04-22)

| 경로 | 분류 | 방어 여부 | 근거 |
|------|------|----------|------|
| `supabase/functions/send-notifications/index.ts` | live send path | 방어됨 | `parsedProjectId` mismatch 가드 + `[CODE]` 정규화 로그 추가 |
| `supabase/migrations/010_fcm_pg_cron.sql` | canonical cron 정의/운영 가이드 | 방어됨 | DIRECT-RUN 블록과 확인 쿼리 추가 |
| `supabase/migrations/013_fix_duplicate_notification_crons.sql` | executable cleanup migration | 방어됨 | legacy 3종 job 이름 제거 |
| `supabase/migrations/004_pg_cron_push.sql` | legacy hourly job 정의 | 방어됨 | 013 cleanup 대상에 포함 |
| `docs/archive/2026-01-11_fcm-background-notification.md` | 문서 참조 | 방어됨 | 구현 참고 문서이며 런타임 경로 아님 |
| `src/lib/services/fcmService.ts` | quickuse 클라이언트 env 참조 | 제외 | `PUBLIC_FIREBASE_PROJECT_ID`만 읽고 Edge Function service account와 무관 |
| `supabase/functions/*` 내 `FIREBASE_SERVICE_ACCOUNT` grep 결과 | service account env 참조 | 방어됨 | `send-notifications/index.ts` 1개 경로만 확인됨 |

## Phase 5: 운영 반영 후 재검증

8. - [ ] **운영 secret과 cron 상태를 실제로 복구한다**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: 이 파일의 env contract(`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`)를 기준으로 Supabase Edge Function `send-notifications` secret이 올바른 service account/project_id 조합인지 대조한다.
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: `DIRECT-RUN` 블록을 Supabase SQL editor에서 실행해 legacy/duplicate job을 제거하고 canonical job 1개만 남긴다.
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: 실행 직후 `cron.job`, `cron.job_run_details` 확인 쿼리로 `send-fcm-notifications-every-minute`만 활성인지 검증한다.

9. - [ ] **운영 로그에서 권한 오류 소멸을 확인한다**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: 다음 분 호출 로그에서 `[FCM] service account`가 기대 project/domain으로 찍히는지 확인한다.
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `project_id mismatch` 로그가 0건인지 확인한다.
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `notification_logs.error_message` 최근 20건에서 `[PERMISSION_DENIED]` 반복이 멈추고 `status='success'`가 다시 생기는지 확인한다.

---

*상태: 구현중 | 진행률: 26/34 (76%)*
