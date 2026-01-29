# memo-alarm 개선 계획

> 작성일: 2026-01-29
> 난이도: ⭐ 쉬움 | ⭐⭐ 보통 | ⭐⭐⭐ 어려움

## 요약

총 12개 개선 항목 (High: 1, Medium: 5, Low: 6)

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

- [ ] **빈 catch 블록 에러 로깅 추가** ⭐
  - 현재 문제: 여러 곳에서 에러를 무시하고 있어 디버깅 어려움
  - 해결 방법: console.error 또는 에러 리포팅 서비스로 기록
  - 관련 파일:
    - `src/lib/stores/memos.svelte.ts` (54-61줄)
    - `src/lib/stores/settings.svelte.ts` (34-36줄)
    - `src/lib/stores/notifications.svelte.ts` (46-60줄)

- [ ] **프로덕션 console 정리** ⭐
  - 현재 문제: 77개 console.log/error 호출이 남아있음
  - 해결 방법:
    1. 디버그용 로그 제거
    2. 에러 로그만 조건부로 남기기
  - 관련 파일: 17개 파일 전반

- [ ] **타입 변환 함수 통합** ⭐⭐
  - 현재 문제: supabaseToMemo, memoToSupabase 코드가 반복적
  - 해결 방법: 매핑 설정 객체 기반 변환 함수로 리팩토링
  - 관련 파일: `src/lib/stores/memos.svelte.ts` (73-111줄)

- [ ] **시간 포맷 유틸리티 추출** ⭐⭐
  - 현재 문제: 시간 포맷/비교 로직이 3곳에 중복
  - 해결 방법: `src/lib/utils/timeUtils.ts` 생성
  - 관련 파일: `src/lib/stores/notifications.svelte.ts` (168, 328, 338줄)

- [ ] **Button 컴포넌트 접근성 개선** ⭐
  - 현재 문제: aria-label prop 지원 안함
  - 해결 방법: aria-label prop 추가하고 {...$$restProps} 전달
  - 관련 파일: `src/lib/components/ui/Button.svelte`

### 🟢 Low Priority

- [ ] **컴포넌트 aria-label 추가** ⭐
  - 현재 문제: 30개 컴포넌트에 aria-label 8개만 있음
  - 해결 방법: 아이콘 버튼, 삭제/수정 버튼 등에 레이블 추가
  - 관련 파일: `src/lib/components/memo/*.svelte`

- [ ] **MemoCard URL sanitize** ⭐⭐
  - 현재 문제: getDomain() 함수에서 URL 검증 미흡
  - 해결 방법: URL 생성자로 유효성 검사 추가
  - 관련 파일: `src/lib/components/memo/MemoCard.svelte` (47-52줄)

- [ ] **알림 체크 최적화** ⭐⭐
  - 현재 문제: checkAndTriggerReminders()마다 전체 memos 필터링
  - 해결 방법: 활성 리마인더만 별도 derived 스토어로 관리
  - 관련 파일: `src/lib/stores/notifications.svelte.ts` (194-197줄)

- [ ] **MemoForm tag 제안 debounce** ⭐
  - 현재 문제: 매 렌더마다 태그 제안 계산
  - 해결 방법: 입력 300ms 후 계산
  - 관련 파일: `src/lib/components/memo/MemoForm.svelte` (45-51줄)

- [ ] **SW 메시지 타입 상수화** ⭐
  - 현재 문제: 'REGISTER_MEMO_REMINDERS' 등 문자열 하드코딩
  - 해결 방법: `src/lib/constants/swMessages.ts` 생성
  - 관련 파일:
    - `src/lib/stores/notifications.svelte.ts`
    - `src/service-worker.ts`

- [ ] **reminder.time 형식 검증** ⭐
  - 현재 문제: HH:MM 형식 검증 없음
  - 해결 방법: 정규식으로 형식 검사 추가
  - 관련 파일: `src/lib/components/memo/ReminderSettings.svelte`

---

## 작업 순서 권장

1. 프로덕션 console 정리 (간단하고 코드 정리 효과)
2. 빈 catch 블록 에러 로깅 추가 (디버깅 용이성)
3. 시간 포맷 유틸리티 추출
4. Button 컴포넌트 접근성 개선
5. 백그라운드 알림은 장기 과제로 별도 계획
