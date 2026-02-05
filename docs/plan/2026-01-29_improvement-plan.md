# memo-alarm 개선 계획

> 작성일: 2026-01-29
> 최종 업데이트: 2026-02-03
> 난이도: ⭐ 쉬움 | ⭐⭐ 보통 | ⭐⭐⭐ 어려움

## 요약

총 12개 개선 항목 (High: 1, Medium: 5, Low: 6)
- 완료: 10개
- 미처리: 2개 (백그라운드 알림 아키텍처, 컴포넌트 aria-label)

---

## TODO

### 🔴 High Priority

- [ ] **백그라운드 알림 아키텍처 검토** ⭐⭐⭐
  - 현재 문제: setInterval 기반 알림이 앱 백그라운드/브라우저 유휴 시 동작 안함
  - 해결 방법: (장기 과제)
    1. 서버 사이드 FCM/Web Push 구현
    2. 또는 현재 한계 사용자에게 안내
  - 참고: MEMO_NOTIFICATION_FIX_PLAN.md 문서 참조
  - 관련 파일:
    - `src/lib/stores/notifications.svelte.ts`
    - `src/service-worker.ts`

### 🟡 Medium Priority

- [x] **빈 catch 블록 에러 로깅 추가** ⭐ ✅ 2026-02-03 검토 완료
  - 검토 결과: 대부분 의도된 빈 catch (localStorage 파싱, 동적 import, URL 파싱 등)
  - console.error 추가가 오히려 노이즈 유발하므로 현행 유지 적절

- [x] **프로덕션 console 정리** ⭐ ✅ 2026-02-03 완료
  - 25건 디버그 console.log 제거 (10개 파일)
  - console.error/warn만 유지

- [x] **타입 변환 함수 통합** ⭐⭐ ✅ 2026-02-05 완료
  - MEMO_FIELD_MAPPINGS 매핑 설정 객체 기반으로 supabaseToMemo/memoToSupabase 리팩토링
  - 29개 필드 매핑을 선언적 배열로 통합, toMemo/toDb 변환 함수 지원
  - 관련 파일: `src/lib/stores/memos.svelte.ts`

- [x] **시간 포맷 유틸리티 추출** ⭐⭐ ✅ 2026-02-03 완료
  - `src/lib/utils/timeUtils.ts` 생성
  - `getCurrentTimeHHMM()`, `getTodayDateISO()` 함수 추출
  - notifications.svelte.ts 4곳, service-worker.ts 1곳 중복 제거

- [x] **Button 컴포넌트 접근성 개선** ⭐ ✅ 2026-02-05 완료
  - `[key: string]: any` → `HTMLButtonAttributes` 타입으로 교체
  - aria-label 포함 모든 네이티브 button 속성에 정확한 타입 지원
  - 관련 파일: `src/lib/components/ui/Button.svelte`

### 🟢 Low Priority

- [ ] **컴포넌트 aria-label 추가** ⭐
  - 현재 문제: 30개 컴포넌트에 aria-label 8개만 있음
  - 해결 방법: 아이콘 버튼, 삭제/수정 버튼 등에 레이블 추가
  - 관련 파일: `src/lib/components/memo/*.svelte`

- [x] **MemoCard URL sanitize** ⭐⭐ ✅ 2026-02-05 완료
  - `safeHref()` 함수 추가: http/https만 허용, 그 외 `#` 반환
  - `getDomain()`에도 프로토콜 검증 추가
  - `href={memo.url}` 2곳을 `href={safeHref(memo.url)}`로 교체
  - 관련 파일: `src/lib/components/memo/MemoCard.svelte`

- [x] **알림 체크 최적화** ⭐⭐ ✅ 2026-02-05 완료
  - `activeReminderMemos` $derived 스토어 추가: 활성 리마인더 메모만 사전 필터링
  - `checkAndTriggerReminders`, `getTodayReminders`, `registerRemindersToServiceWorker` 3곳 적용
  - 관련 파일: `src/lib/stores/notifications.svelte.ts`

- [x] **MemoForm tag 제안 debounce** ⭐ ✅ 2026-02-05 완료
  - 제목/내용 변경 시 $effect + setTimeout 300ms debounce 자동 태그 제안
  - 기존 수동 "추천" 버튼도 유지
  - 관련 파일: `src/lib/components/memo/MemoForm.svelte`

- [x] **SW 메시지 타입 상수화** ⭐ ✅ 2026-02-03 완료
  - `src/lib/constants/swMessages.ts` 생성
  - 8개 메시지 타입을 `SW_MSG` 상수 객체로 중앙 관리
  - Main Thread 측 하드코딩 교체 완료

- [x] **reminder.time 형식 검증** ⭐ ✅ 2026-02-05 완료
  - ReminderCard에 TIME_REGEX(`/^([01]\d|2[0-3]):([0-5]\d)$/`) 검증 추가
  - time input onchange에서 유효한 HH:MM 형식만 onUpdate 호출
  - 관련 파일: `src/lib/components/memo/ReminderCard.svelte`

---

## 작업 순서 권장 (업데이트)

~1. 프로덕션 console 정리~ ✅ 완료
~2. 빈 catch 블록 에러 로깅 추가~ ✅ 검토 완료 (현행 유지)
~3. 시간 포맷 유틸리티 추출~ ✅ 완료
~4. Button 컴포넌트 접근성 개선~ ✅ 완료
~5. 타입 변환 함수 통합~ ✅ 완료
6. 백그라운드 알림은 장기 과제로 별도 계획
