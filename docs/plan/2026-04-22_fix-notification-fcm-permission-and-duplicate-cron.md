# FCM 권한 오류 및 중복 cron으로 인한 notification 미발생 수정

> 작성일시: 2026-04-22 11:24
> 기준커밋: 34b8d3a
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/5 (0%)
> 요약: 2026-04-22 운영 DB와 `notification_logs`, `cron.job` 실조회 결과 현재 알림 미발생의 주원인은 브라우저 Firebase key가 아니라 `send-notifications` Edge Function의 FCM 권한 부재와 중복 cron 호출이다. 서버 자격증명 정합성, cron 단일화, 앱 내 진단 노출을 함께 정리해 같은 오진이 반복되지 않도록 한다.

---

## 개요

2026-04-22 조사 기준 운영 `notification_logs`의 `memo-alarm/failed` 503건은 모두 `cloudmessaging.messages.create` 권한 거부로 수렴한다. 마지막 성공 발송은 2026-02-05 23:16 KST, 마지막 실패는 2026-04-22 08:25 KST이며, 현재 운영 DB에는 `alarm_schedules`, `user_devices`, `notification_logs`만 존재해 이전에 의심했던 `ma_*` 테이블 불일치는 실제 원인이 아니다.

같은 시점의 `cron.job`에는 `send-notifications`를 매분 호출하는 job이 2개(`send-fcm-notifications-every-minute`, `send-notifications-every-minute`) 활성화되어 있었고, 과거 `send-push` legacy job도 남아 있었다. 이 상태에서는 FCM 권한을 복구해도 중복 발송이 재발할 수 있으므로, 서버 자격증명 수정과 cron 정리를 하나의 작업 묶음으로 관리해야 한다.

또한 현재 [`src/routes/settings/+page.svelte`](src/routes/settings/+page.svelte)는 `user_devices`, `alarm_schedules`, 클라이언트 env 상태만 보여주고 서버측 `notification_logs`의 실패 원인과 최근 success/failed 흐름은 노출하지 않는다. 그래서 실제 장애가 서버 권한 문제여도 다시 "key 문제"로 오판하기 쉽다.

## 기술적 고려사항

- `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`는 `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`를 읽지만, 현재 로그는 "env 존재 여부"만 남기고 어떤 프로젝트/서비스 계정으로 발송하려 했는지 충분히 드러내지 않는다.
- `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`은 canonical job 하나만 관리하지만, 운영 DB에는 동일 endpoint를 치는 중복 job이 별도로 남아 있다. 마이그레이션/운영 정리 둘 다 idempotent하게 설계해야 한다.
- `src/routes/settings/+page.svelte`의 `checkFCMStatus()`는 사용자 단위 `user_devices`와 `alarm_schedules`는 읽을 수 있으므로, 같은 범위의 `notification_logs`까지 묶으면 클라이언트 등록 상태와 서버 발송 실패를 한 화면에서 대조할 수 있다.
- 현재 권한 오류에서는 `NotRegistered` 분기까지 도달하지 못하므로 active 토큰 정리 로직이 작동하지 않는다. 토큰 정리는 부수 이슈이며, 우선순위는 FCM 권한 복구와 cron 중복 제거가 더 높다.

---

## TODO

### Phase 1: Edge Function 진단 강화

1. - [ ] **FCM 자격증명과 권한 오류를 조기 식별 가능하게 만든다**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `FIREBASE_SERVICE_ACCOUNT`에서 `project_id`, `client_email`을 안전한 형태로 파싱해 `FIREBASE_PROJECT_ID`와 함께 로그/응답에 남기고, 둘이 불일치하면 발송 전에 경고를 표준화한다.
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: `PermissionDenied`, `cloudmessaging.messages.create`, `project not found` 류 오류를 공통 포맷으로 정규화해 `notification_logs.error_message`와 함수 응답에서 같은 문자열을 보게 만든다.

### Phase 2: 중복 cron 정리

2. - [ ] **매분 호출 job을 canonical 이름 하나로 수렴한다**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: `send-fcm-notifications-every-minute`, `send-notifications-every-minute`, `send-push-notifications-every-minute` 정리 전략을 반영해 배포 후 활성 job이 1개만 남도록 idempotent cleanup 절차를 보강한다.
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql`: 운영 재점검용 `cron.job`, `cron.job_run_details` 확인 쿼리를 최신 canonical job 기준으로 정리해 이후 중복 등록 여부를 빠르게 판별할 수 있게 한다.

### Phase 3: 설정 페이지 서버측 상태 노출

3. - [ ] **앱 안에서 최근 서버 발송 상태를 직접 확인할 수 있게 한다**
   - [ ] `src/routes/settings/+page.svelte`: `checkFCMStatus()`에 `notification_logs` 조회를 추가해 현재 사용자 + `memo-alarm` 범위의 최근 success/failed 시각, 마지막 오류, 최근 10건 상태를 함께 읽는다.
   - [ ] `src/routes/settings/+page.svelte`: 기존 `user_devices`, `alarm_schedules` 개발자 카드 아래에 "서버측 FCM 상태" 영역을 추가해 최근 실패 사유와 마지막 성공 여부를 표기한다.

### Phase 4: 클라이언트/서버 진단 정합성 맞춤

4. - [ ] **클라이언트 key 상태와 서버 권한 상태를 한 번에 비교 가능하게 만든다**
   - [ ] `src/lib/fcm.ts`: 개발자용 `getFCMConfigStatus()` 결과를 정리해 클라이언트 env 누락과 서버 발송 실패를 구분해서 보여줄 수 있는 프로젝트 식별 정보만 노출한다.
   - [ ] `src/routes/settings/+page.svelte`: `PUBLIC_FIREBASE_PROJECT_ID`, 최근 `notification_logs.error_message`의 프로젝트 문자열, 활성 토큰 수를 함께 보여 "브라우저 key 문제"와 "서버 권한 문제"를 UI에서 즉시 구분하게 한다.

### Phase 5: 운영 반영 후 재검증

5. - [ ] **secret 교체와 cron 정리 후 실제 발송 회복을 검증한다**
   - [ ] `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts`: 현재 env contract(`FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`)를 기준으로 Supabase Edge Function secret이 `lineminder-23489`에 발송 권한을 가진 서비스 계정으로 교체되었는지 확인한다.
   - [ ] `src/routes/settings/+page.svelte`: 설정 페이지 진단값과 `notification_logs`를 사용해 "permission denied failed -> success 전환", "중복 실패 로그 소멸", "최근 성공 시각 갱신"을 수동 검증한다.

---

## 검증

### 운영 확인 쿼리

```sql
select jobid, jobname, active
from cron.job
where jobname in (
  'send-fcm-notifications-every-minute',
  'send-notifications-every-minute',
  'send-push-notifications-every-minute'
)
order by jobid;
```

- 기대 결과: 활성 job은 canonical 이름 1개만 남음

```sql
select app_name, status, error_message, sent_at
from notification_logs
where app_name = 'memo-alarm'
order by sent_at desc
limit 20;
```

- 기대 결과: 최근 행에 `cloudmessaging.messages.create denied`가 반복되지 않고 `success`가 다시 기록됨

### 수동 확인

- 설정 페이지 개발자 모드에서 `user_devices`, `alarm_schedules`, `notification_logs`를 한 번에 확인할 수 있어야 한다.
- 브라우저 Firebase env가 정상이어도 서버 권한 오류가 별도 배지/메시지로 드러나야 한다.
- cron 중복 제거 후 같은 시각의 debug/success/failed 로그가 쌍으로 반복되지 않아야 한다.

---

## 영향 파일

| 파일 | 역할 |
|------|------|
| `D:\work\project\tools\gifticon-manager\supabase\functions\send-notifications\index.ts` | FCM 서비스 계정 진단, 권한 오류 정규화, 운영 secret 검증 기준 |
| `D:\work\project\tools\gifticon-manager\supabase\migrations\010_fcm_pg_cron.sql` | 중복 cron 정리와 canonical job 유지 |
| `src/lib/fcm.ts` | 클라이언트 FCM config status 정리 |
| `src/routes/settings/+page.svelte` | 서버측 알림 상태/로그를 포함한 개발자 진단 UI |

---

*상태: 초안 | 진행률: 0/5 (0%)*
