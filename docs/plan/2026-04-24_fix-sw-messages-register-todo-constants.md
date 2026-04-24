# fix: swMessages.ts에 REGISTER/REMOVE_TODO_NOTIFICATIONS 상수 추가

> 작성일시: 2026-04-24
> 기준커밋: 5a01690
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/0 (0%)
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

---

## TODO

### Phase 1: 상수 추가 및 메인 스레드 교체

1. - [ ] **`swMessages.ts`에 두 상수를 추가하고 `todoNotifications.ts`에서 사용한다**
   - [ ] `src/lib/constants/swMessages.ts`: `REGISTER_TODO_NOTIFICATIONS: 'REGISTER_TODO_NOTIFICATIONS'`를 todo 관리 섹션에 추가한다
   - [ ] `src/lib/constants/swMessages.ts`: `REMOVE_TODO_NOTIFICATIONS: 'REMOVE_TODO_NOTIFICATIONS'`를 같은 섹션에 추가한다
   - [ ] `src/lib/utils/todoNotifications.ts`: `SW_MSG` import를 추가하고, `type: 'REGISTER_TODO_NOTIFICATIONS'` raw string을 `type: SW_MSG.REGISTER_TODO_NOTIFICATIONS`로 교체한다 (L315)
   - [ ] `src/lib/utils/todoNotifications.ts`: `type: 'REMOVE_TODO_NOTIFICATIONS'` raw string을 `type: SW_MSG.REMOVE_TODO_NOTIFICATIONS`로 교체한다 (L333)
   - [ ] `src/service-worker.ts`: SW 수신 측은 raw string 유지 (`import` 불가 정책) — 주석으로 `// matches SW_MSG.REGISTER_TODO_NOTIFICATIONS`를 추가해 연결을 명시한다

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] T4/T5 해당 없음 재판정 (TypeScript-only 변경, 테스트 인프라 없음)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거

## 작업 수 요약

- Phase 1: 상수 추가 및 교체 (5개 체크박스)
- Phase Z: Post-Merge Cleanup (5개 체크박스)
- 총 10개 체크박스

*상태: 검토완료 | 진행률: 0/10 (0%)*
