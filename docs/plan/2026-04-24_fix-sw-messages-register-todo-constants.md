# fix: swMessages.ts에 REGISTER/REMOVE_TODO_NOTIFICATIONS 상수 추가

> 작성일시: 2026-04-24
> 기준커밋: 5a01690
> 대상 프로젝트: memo-alarm
> 상태: 머지대기
> branch: impl/fix-sw-messages-register-todo-constants
> worktree: .worktrees/impl-fix-sw-messages-register-todo-constants
> worktree-owner: docs/plan/2026-04-24_fix-sw-messages-register-todo-constants.md
> 진행률: 24/30 (80%)
> 요약: `TODO_NOTIFICATION_SENT`는 이번 fix에서 `swMessages.ts`에 추가됐지만, `REGISTER_TODO_NOTIFICATIONS`와 `REMOVE_TODO_NOTIFICATIONS`는 여전히 raw string으로 남아 있다. `todoNotifications.ts`(메인→SW)와 `service-worker.ts`(SW 수신) 모두 raw string을 사용하므로 타이포/불일치 위험이 있다.
> 출처: /reflect에서 자동 생성

---

## 개요

`src/lib/constants/swMessages.ts`는 SW ↔ 메인 스레드 메시지 타입 상수를 중앙 관리하지만, 아래 두 상수가 누락되어 있다:

- `REGISTER_TODO_NOTIFICATIONS`: `src/lib/utils/todoNotifications.ts:315`에서 raw string으로 전송
- `REMOVE_TODO_NOTIFICATIONS`: `src/lib/utils/todoNotifications.ts:333`에서 raw string으로 전송

`service-worker.ts`의 message 핸들러도 raw string(`'REGISTER_TODO_NOTIFICATIONS'`, `'REMOVE_TODO_NOTIFICATIONS'`)으로 수신한다.

이번 fix에서 `TODO_NOTIFICATION_SENT`를 `swMessages.ts`에 추가한 것과 대칭으로, 나머지 todo 관련 SW 메시지 상수도 등록하면 오타/불일치 위험을 제거할 수 있다.

## 기술적 고려사항

- `swMessages.ts`를 SW scope에서 import하는 것은 번들 제약 때문에 피하므로, SW(`service-worker.ts`) 수신 측은 raw string 그대로 유지한다 (기존 정책 동일).
- 변경 대상은 **메인 스레드 발신 측**(`todoNotifications.ts`)만이다: `SW_MSG.REGISTER_TODO_NOTIFICATIONS`, `SW_MSG.REMOVE_TODO_NOTIFICATIONS` 사용으로 교체.
- `swMessages.ts` 상수값이 SW raw string과 정확히 일치하는지 확인 필수.
- **Main 드리프트 점검 (strict, fix: plan)**: `git diff --name-only 5a01690..main` 실행 결과 `src/` 변경 0건. 대상 3개 파일(`src/lib/constants/swMessages.ts`, `src/lib/utils/todoNotifications.ts`, `src/service-worker.ts`) 모두 `영향 없음` (근거: 기준커밋=5a01690, 검사범위=`5a01690..main`).

---

## TODO

### Phase 1: swMessages 상수 추가 및 메인 스레드 발신 측 교체

1. - [x] **`src/lib/constants/swMessages.ts`에 todo 관리용 상수 2개 추가**
   - [x] `SW_MSG` 객체의 `TODO_NOTIFICATION_SENT` 섹션(L21) 근처에 todo 관리 섹션 주석 `// todo 알림 관리` 추가
   - [x] `REGISTER_TODO_NOTIFICATIONS: 'REGISTER_TODO_NOTIFICATIONS'` 항목을 같은 섹션에 추가 (key 값 = raw string)
   - [x] `REMOVE_TODO_NOTIFICATIONS: 'REMOVE_TODO_NOTIFICATIONS'` 항목을 바로 아래 줄에 추가하고, 값이 SW 수신부 문자열과 정확히 일치하는지 diff로 확인

2. - [x] **`src/lib/utils/todoNotifications.ts` 상단 import 블록에 `SW_MSG` 추가**
   - [x] 기존 import 블록(L1-L2) 바로 아래에 `import { SW_MSG } from '$lib/constants/swMessages';` 추가
   - [x] import 경로 alias(`$lib/...`)가 동일 패턴(`notifications.svelte.ts:6`)과 일치하는지 확인

3. - [x] **`todoNotifications.ts:315` 발신 측 raw string 교체**
   - [x] L315 `type: 'REGISTER_TODO_NOTIFICATIONS'`를 `type: SW_MSG.REGISTER_TODO_NOTIFICATIONS`로 교체
   - [x] postMessage payload 내 `notifications` 필드(L316)는 그대로 유지

4. - [x] **`todoNotifications.ts:333` 발신 측 raw string 교체**
   - [x] L333 `type: 'REMOVE_TODO_NOTIFICATIONS'`를 `type: SW_MSG.REMOVE_TODO_NOTIFICATIONS`로 교체
   - [x] postMessage payload 내 `todoId` 필드(L334)는 그대로 유지

5. - [x] **`src/service-worker.ts` SW 수신 측 주석 보강 (raw string 유지, 번들 제약)**
   - [x] L573 `if (event.data.type === 'REGISTER_TODO_NOTIFICATIONS')` 바로 위 라인에 주석 `// matches SW_MSG.REGISTER_TODO_NOTIFICATIONS (raw string retained: SW bundle cannot import $lib)` 추가
   - [x] L592 `if (event.data.type === 'REMOVE_TODO_NOTIFICATIONS')` 바로 위 라인에 주석 `// matches SW_MSG.REMOVE_TODO_NOTIFICATIONS (raw string retained: SW bundle cannot import $lib)` 추가

### Phase T1: TC 작성

> T1 해당 없음: memo-alarm은 TypeScript 프런트 전용이며 프로젝트 테스트 프레임워크 미구성. 확인 — `Glob src/**/*.test.ts` 0건, `tests/` 디렉토리 미존재, `package.json`에 vitest/jest script 없음. 단순 상수 추출 + 1:1 대치이므로 테스트 프레임워크 도입은 범위 밖.

### Phase T2: TC 실행 및 수정

> T2 해당 없음: T1 미작성이므로 실행 대상 없음.

### Phase R: 재발 경로 분석 (fix: plan 필수)

6. - [x] **수정 대상 메시지 타입의 모든 호출/참조 경로 열거**
   - [x] `rg "REGISTER_TODO_NOTIFICATIONS" src/` 실행 → SW 수신(service-worker.ts:581,582) + 메인 발신(todoNotifications.ts:316) + 상수정의(swMessages.ts:20)
   - [x] `rg "REMOVE_TODO_NOTIFICATIONS" src/` 실행 → SW 수신(service-worker.ts:601,602) + 메인 발신(todoNotifications.ts:334) + 상수정의(swMessages.ts:21)
   - [x] 경로별 방어표: `service-worker.ts`=정책상 raw string 유지(SW 번들 제약), `todoNotifications.ts`=SW_MSG 상수 사용(방어됨), 그 외=0건

7. - [x] **미방어 경로 수정 및 완료 확인**
   - [x] 메인 스레드(발신 측) raw string 잔존 0건 확인 — `swMessages.ts` 상수 정의부 제외 시 0건
   - [x] 다른 모듈에 신설된 postMessage 호출 0건 확인
   - [x] 전체 방어 완료

### Phase T3: 재현/통합 TC

> T3 해당 없음: SW 메시지 타입 상수 추출(설정값/상수 추출)에 해당 — runtime 동작 불변, type-level 일관화. expand-todo 규칙의 "순수 문서/주석/타입 힌트/설정값 변경만" 스킵 허용 조건에 부합.

### Phase T4: E2E 테스트

> T4 해당 없음: Glob `tests/**/*e2e*`, `tests/**/*integration*`, `e2e/**/*` 모두 0건. 프로젝트에 E2E 인프라가 존재하지 않음(Playwright/Cypress 설정 없음).

### Phase T5: HTTP 통합 테스트

> T5 해당 없음: memo-alarm은 SvelteKit + Service Worker + Supabase 직접 호출 구성이며 자체 백엔드 HTTP API 부재. Glob `tests/**/*http*`, `tests/**/*api*` 0건. T5 대상 아님.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

8. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] T4/T5 해당 없음 재판정 (TypeScript-only 변경, 테스트 인프라 없음)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거

## 작업 수 요약

- Phase 1: 상수 추가 및 교체 (5 parents / 11 children)
- Phase R: 재발 경로 분석 (2 parents / 6 children)
- Phase T1~T5: 블록쿼트만 (체크박스 0)
- Phase Z: Post-Merge Cleanup (1 parent / 5 children)
- 총 8 parents / 22 children = 30 체크박스

*상태: 머지대기 | 진행률: 24/30 (80%)*
