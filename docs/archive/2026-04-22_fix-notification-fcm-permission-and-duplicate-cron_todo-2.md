# FCM 권한 오류 및 중복 cron으로 인한 notification 미발생 수정 — TODO 2

> 계획서: [plan](./2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md)
> 대상 프로젝트: memo-alarm
> 실행순서: 2
> 선행조건: 2026-04-22_fix-notification-fcm-permission-and-duplicate-cron_todo-1.md
> 테스트명령: settings devMode 수동 확인 + `notification_logs` 비교 + 실제 디바이스 수신 확인
> 상태: 구현중
> 진행률: 29/33 (88%)
> branch: impl/fix-notification-fcm-permission-and-duplicate-cron
> worktree: D:/work/project/service/wtools/memo-alarm/.worktrees/impl-fix-notification-fcm-permission-and-duplicate-cron
> worktree-owner: D:\work\project\service\wtools\memo-alarm\docs\plan\2026-04-22_fix-notification-fcm-permission-and-duplicate-cron.md
> 요약: settings devMode에서 `notification_logs`와 클라이언트 Firebase 식별자를 함께 보여 서버 권한 실패와 브라우저 env 문제를 분리 진단한다.

## Phase 3: 설정 페이지 서버측 상태 노출

1. - [x] **`fcmStatus` 상태 구조에 서버측 로그 정보를 추가한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `fcmStatus` 타입에 `notificationLogs`, `lastSuccessAt`, `lastFailedAt`, `lastErrorMessage` 필드를 추가한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 초기 상태 객체에도 위 필드를 모두 채워 `devMode` 진입 전/후 타입 불일치가 없도록 맞춘다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 기존 `fcmToken` 계산은 유지하되 active token 없을 때 `null`이 명확히 들어가도록 현재 분기를 그대로 보존한다.

2. - [x] **`checkFCMStatus()`에서 `notification_logs`를 함께 조회한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `alarm_schedules` 조회 직후 `supabase.from('notification_logs').select('status, error_message, sent_at').eq('user_id', authStore.user.id).eq('app_name', 'memo-alarm').order('sent_at', { ascending: false }).limit(10)` 쿼리를 추가한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 결과 배열에서 첫 `success`/`failed` 행을 찾아 `lastSuccessAt`, `lastFailedAt`, `lastErrorMessage`를 계산하는 후처리 로직을 추가한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `notification_logs` 조회 실패 시 `fcmStatus.error`에 오류를 덮어쓰되, 기존 device/schedule 조회 실패 로그와 구분되도록 `"notification_logs 조회 실패: ..."` 접두어를 사용한다.

3. - [x] **devMode UI에 "서버측 FCM 상태" 카드를 추가한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 기존 "FCM 웹 푸시 상태" 블록 내부에 `lastSuccessAt`, `lastFailedAt`, `lastErrorMessage`를 표시하는 카드 추가.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 최근 10건 로그를 `{#each fcmStatus.notificationLogs as log}`로 렌더하고, `success`/`failed` 상태별 아이콘과 시간 표시를 추가한다.

## Phase 4: 클라이언트/서버 진단 정합성 맞춤

4. - [x] **`getFCMConfigStatus()`가 비교용 식별자를 더 반환하게 한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: 반환 객체에 `envProjectId: PUBLIC_FIREBASE_PROJECT_ID || null`, `messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID || null` 필드를 추가하고 기존 `projectId` 필드는 유지한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: 함수 상단에 settings devMode 비교용 식별자만 노출한다는 주석을 추가해 키 원문 비노출 의도를 명시한다.

5. - [x] **settings UI에서 서버 에러 코드와 클라이언트 project를 비교한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `getFCMConfigStatus()` 결과에서 `envProjectId`와 `messagingSenderId`를 상태에 반영하도록 `checkFCMStatus()` 할당부를 확장한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: "클라이언트 ↔ 서버 Project ID 비교" 줄을 추가해 `fcmStatus.projectId`와 `fcmStatus.lastErrorMessage` 내 project 식별 문자열을 비교, 일치/불일치 배지를 렌더한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: active token 수(`fcmStatus.userDevices.filter(d => d.is_active).length`)를 같은 카드에 표시해 "토큰 없음"과 "권한 실패"를 분리 진단한다.

6. - [x] **정규화된 서버 에러 코드별 안내 박스를 추가한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `lastErrorMessage`가 `[PERMISSION_DENIED]`로 시작하면 "클라이언트 key가 아니라 서버 서비스 계정 권한 문제" 안내 박스를 표시한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 바로 위 project 비교 결과가 불일치일 때 env/service account 불일치 경고 박스를 표시한다. 이 분기는 `notification_logs`에 mismatch 코드가 없더라도 동작해야 한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `notification_logs` 조회가 RLS/권한 문제로 실패할 경우 별도 힌트 문구를 표시하되, 현재 `009_fcm_notifications.sql`에 user SELECT 정책이 존재한다는 전제를 주석으로 남긴다.

## Phase R: 재발 경로 분석

7. - [x] **memo-alarm 쪽 Firebase/로그 참조 경로를 전수 조사한다**
   - [x] `D:\work\project\service\wtools\memo-alarm`: `rg -n "notification_logs|FIREBASE_PROJECT_ID|getFCMConfigStatus" src docs` 결과를 표로 정리한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: `getFCMConfigStatus()` 호출 경로가 settings 페이지 하나뿐인지 확인한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: `notification_logs`를 새로 읽는 경로가 devMode 한정인지 확인해 일반 사용자 화면 영향 범위를 제한한다.

8. - [x] **미방어 경로를 비교 UI/상태 카드로 방어한다**
   - [x] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 기존 devMode 카드가 보여주지 못했던 "서버 권한 실패" 경로를 새 카드/배지로 방어한다는 연결 근거를 표에 기록한다.
   - [x] `D:\work\project\service\wtools\memo-alarm\src\lib\fcm.ts`: 클라이언트 쪽은 env 식별자만 보여 주고 secret/키 원문은 노출하지 않는다는 점을 방어 완료 조건으로 명시한다.

### Phase R 결과 (2026-04-22)

| 경로 | 분류 | 방어 여부 | 근거 |
|------|------|----------|------|
| `src/routes/settings/+page.svelte` | live devMode diagnostic | 방어됨 | `checkFCMStatus()`가 `notification_logs`를 devMode 진입/수동 새로고침에서만 조회하고, 서버 상태 카드와 경고 박스를 함께 노출 |
| `src/lib/fcm.ts` | client env identifier helper | 방어됨 | `envProjectId`, `messagingSenderId`만 반환하고 key 원문은 계속 비노출 |
| `src/routes/settings/+page.svelte` 내 `notification_logs` grep 결과 | log 조회 경로 | 방어됨 | 조회/오류 힌트/UI 렌더링 경로가 settings 파일 1곳으로 한정 |
| `src/lib/fcm.ts` + `src/routes/settings/+page.svelte`의 `getFCMConfigStatus` grep 결과 | config status 호출 경로 | 방어됨 | helper 정의 1곳, 호출 1곳(settings)만 확인됨 |
| `docs/archive/2026-01-24_changelog-detail.md` 등 docs 내 `FIREBASE_PROJECT_ID` 참조 | 문서 참조 | 제외 | 과거 기록/설정 예시일 뿐 런타임 분기 경로 아님 |

## Phase 5: 운영 반영 후 재검증

9. - [ ] **settings devMode에서 서버 상태 회복을 확인한다**
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 운영 반영 후 `lastFailedAt`이 더 이상 갱신되지 않고 `lastSuccessAt`이 새 시각으로 갱신되는지 확인한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: 최근 10건 로그에서 `[PERMISSION_DENIED]` 접두어가 사라지고 `success` 로그가 보이는지 확인한다.
   - [ ] `D:\work\project\service\wtools\memo-alarm\src\routes\settings\+page.svelte`: active token 수가 1개 이상이고 project 비교가 녹색인 상태에서 실제 스케줄 시각 푸시가 디바이스에 도착하는지 확인한다.

---

*상태: 구현중 | 진행률: 29/33 (88%)*
