# fix: FCM 알림 merge window 구현 (memo-alarm)

> 계획서: [2026-04-23_fix-fcm-notification-tag-and-missing-sends.md](./2026-04-23_fix-fcm-notification-tag-and-missing-sends.md)
> 대상 프로젝트: memo-alarm
> 실행순서: 1
> 선행조건: 없음
> 상태: 구현완료
> 반영일시: 2026-04-23 21:21
> 머지커밋: 9b94bc6
> 진행률: 35/42 (83%)

---

### Phase 0: Worktree 준비

1. - [x] **worktree 생성 또는 재개**
   - [x] `git worktree add .worktrees/impl-fix-fcm-notification-tag-and-missing-sends -b impl/fix-fcm-notification-tag-and-missing-sends` 실행
   - [x] plan 헤더 `> branch:`, `> worktree:`, `> worktree-owner:` 기록 확인
   - [x] 이후 모든 구현을 worktree cwd에서 진행

### Phase 1: firebase-messaging-sw.js FCM merge window 구현

2. - [x] **module-level pending buffer 및 timer 변수 추가**
   - [x] `static/firebase-messaging-sw.js`: 파일 최상단 `firebase.initializeApp(...)` 호출 위에 아래 두 변수 선언
     ```
     let _fcmPending = [];
     let _fcmMergeTimer = null;
     ```

3. - [x] **`_flushFcmNotifications()` 헬퍼 함수 추가**
   - [x] `static/firebase-messaging-sw.js`: `messaging.onBackgroundMessage` 바로 위에 함수 정의
   - [x] 함수 동작: `_fcmPending`를 splice로 꺼내 개수에 따라 분기
     - 1개: `tag: 'memo-alarm-{schedule_id}'` (schedule_id = `payload.data?.schedule_id || String(Date.now())`)로 단일 알림 표시
     - 2개 이상: 제목 목록 `"• {title}\n• {title}..."` + `tag: 'memo-alarm-merged-{merge_key}'` + `data: { memoIds: [...], type: 'merged' }`로 병합 알림 표시
       - merge_key: 첫 payload의 `schedule_id` 또는 `Date.now()` 기반 (고정 tag로 인한 교체 방지)
       - memoIds: 각 payload의 `payload.data?.memo_id || payload.data?.memoId`로 수집 (snake_case 우선)
   - [x] 함수 종료 후 `_fcmPending = []; _fcmMergeTimer = null;` 리셋

4. - [x] **`_flushFcmNotifications()` 예외 방어**
   - [x] `static/firebase-messaging-sw.js`: `_flushFcmNotifications()` 내부 로직을 `try/catch`로 감싸고, catch에서 `console.error('[firebase-messaging-sw.js] flush error:', e)` 로그

5. - [x] **`messaging.onBackgroundMessage` 핸들러 교체**
   - [x] `static/firebase-messaging-sw.js`: 기존 `showNotification` 직접 호출 코드 제거
   - [x] `_fcmPending.push(payload)` → `clearTimeout(_fcmMergeTimer)` → `_fcmMergeTimer = setTimeout(...)` 800ms debounce 방식으로 교체
   - [x] 핸들러가 반환하는 Promise: 타이머 완료(flush 실행)까지 resolve를 보류해 SW keepalive 보장

6. - [x] **`fcm.ts` 포그라운드 알림 tag 수정**
   - [x] `src/lib/fcm.ts` L196: `setupForegroundMessageListener` 내 `new Notification(...)` 호출의 `tag: 'memo-alarm-notification'` 수정
   - [x] FCM payload에 `schedule_id`가 포함되어 있으므로 `tag: 'memo-alarm-' + (payload.data?.schedule_id || 'fg')` 로 교체 (포그라운드도 개별 tag 사용)

7. - [x] **`notificationclick` 핸들러에 merged type 분기 추가**
   - [x] `static/firebase-messaging-sw.js`: 기존 `const memoId = event.notification.data?.memoId;` 라인 수정
   - [x] 단일 알림: `memoId = data.memo_id || data.memoId`로 읽고 `appUrl = memoId ? '/?memo=' + memoId : '/'`
   - [x] merged 알림: `firstMemoId = data.memoIds?.[0] || data.memo_ids?.[0] || data.memo_id || data.memoId`로 읽고 `appUrl` 결정

### Phase R: 재발 경로 분석 (fix: plan 필수)

8. - [x] **수정 대상의 모든 호출/참조 경로 열거**
   - [x] `firebase-messaging-sw.js`를 참조하는 모든 파일 Grep 확인 (`importScripts`, `firebase-messaging-sw` 키워드)
   - [x] `_fcmPending`, `_flushFcmNotifications`, `_fcmMergeTimer` 심볼이 다른 파일에서 충돌하는지 확인 (SW global scope)
   - [x] 각 경로별 "동일 버그(tag 덮어쓰기)가 발생할 수 있는가?" 판정

9. - [x] **미방어 경로 수정**
   - [x] 단일 알림 경로: schedule_id 없을 때 `Date.now()` fallback → tag 중복 없음 확인
   - [x] 병합 알림 경로: `_fcmPending`가 0이면 early return → 빈 알림 표시 방지 확인
   - [x] `onBackgroundMessage`가 동시에 여러 번 호출될 때: `_fcmPendingResolves[]` 배열로 모든 handler Promise를 flush 시 일괄 resolve — V4 결함 수정 완료
   - [x] 모든 경로 방어 완료 표로 기록 (경로 \| 방어여부 \| 근거)

### Phase T: 통합 테스트

> T1~T2 해당 없음: memo-alarm은 단위 테스트 프레임워크가 구성되어 있지 않다(Glob (node_modules 제외) `memo-alarm/src/**/*.test.ts` 0건, `memo-alarm/tests/**/*` 0건, `package.json`에 `"test"` 스크립트 없음). Service Worker 병합 동작은 실브라우저 알림 생명주기에 의존해 Node mock으로 재현 가치가 낮다.
> T3 재현 TC 해당 없음: SW `onBackgroundMessage` 동작은 브라우저 FCM push가 필요하며, 동일 분 N건 push 시나리오는 deploy 후 수동 재현으로만 검증 가능하다. 자동화된 integration 테스트 하네스가 프로젝트에 없다.
> T4 E2E 해당 없음: 프로젝트에 Playwright/e2e 하네스 없음. (Glob (node_modules 제외) `**/*e2e*`, `**/*integration*` 매칭은 문서 파일만 존재)
> T5 HTTP 해당 없음: SvelteKit FE 프로젝트로 send-notifications 같은 HTTP 서버를 이 레포에 호스팅하지 않는다. Glob `**/*http*`, `**/*api*` 결과 node_modules 외 0건.

10. - [ ] **수동 브라우저 검증 시나리오 기록** — 배포 후 `/merge-test` 또는 main deploy 직후 수행
    - [ ] 동일 분에 예약된 메모 2건 이상 등록 후, 앱을 백그라운드로 두고 FCM push 수신 → "N개의 메모 알림" 1건만 표시되는지 확인
    - [ ] 단일 FCM push 수신 → 개별 tag `memo-alarm-{schedule_id}`로 표시, 이전 알림과 교체되지 않는지 확인
    - [ ] 병합 알림 클릭 → `memoIds[0]` 메모 상세로 네비게이트 확인
    - [ ] 개별 알림 클릭 → 기존 `memoId` 경로 유지 확인
    - [ ] 시나리오별 결과를 `docs/DONE.md` 또는 plan 말미에 기록

### Phase Z: Post-Merge Cleanup (/merge-test owner)

11. - [x] **main merge + 정리**
   - [x] `/merge-test`로 main 머지
   - [x] worktree remove + branch remove
   - [x] plan 헤더 meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:`)

> merge resolve: 충돌 발생 시 `static/firebase-messaging-sw.js` 기준으로 수동 해결
> stash-pop resolve: root dirty 있을 경우 `/merge-test` 절차에 따라 처리

---

*상태: 구현완료 | 진행률: 35/42 (83%)*
