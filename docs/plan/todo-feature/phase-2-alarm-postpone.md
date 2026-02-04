# Phase 2: 알림 3단계 + 미루기

> **목표**: 상기/알람/기한초과 알림을 실제로 발송하고, 미루기 기능 구현
> **PRD 참조**: 3.1, 3.3, 5.5, 5.6, 7, 8 — [docs/prd/2026-02-04_todo-note-prd.md](../../prd/2026-02-04_todo-note-prd.md)
> **선행 조건**: Phase 1 완료
> **용어 참조**: [docs/prd/2026-02-04_todo-terminology.md](../../prd/2026-02-04_todo-terminology.md) — 상기/알람/기한초과 정의

---

## 시작 전 확인 사항

결정 완료:
- **상기 범위**: 각 할일의 개별 상기 시각(remindTimes)에 개별 발송. 공통 요약 상기는 차후 고려사항 (overview 참조)
- **미루기 시 수동 알람**: 이동 안 함. autoAlertBefore만 재계산. 수동 alertTimes는 유지 (과거 시각이면 무시)

---

## 1. 상기 알림 (Remind) 발송

> PRD 참조: 3.1.1 1단계 상기, 3.1.2 설정 레이어, 3.1.3 시간축 예시

### 1-1. 상기 알림 스케줄링

- [x] 각 할일의 개별 상기 시각(remindTimes)에 알림 발송하는 로직 구현
  - useGlobalRemind=true인 할일 → 앱 설정의 remind.time 시각에 발송
  - useGlobalRemind=false인 할일 → 개별 remindTimes 배열의 각 시각에 발송
  - 기존 `src/service-worker.ts`의 알림 체크 로직 참고
- [x] Capacitor Local Notifications으로 상기 알림 스케줄 등록
  - `src/lib/utils/capacitor.ts`의 기존 알림 스케줄링 패턴 참고
- [ ] FCM으로 상기 알림 발송 (서버 트리거)

### 1-2. 상기 알림 내용 생성

- [x] 개별 상기 알림 메시지 포맷
  - 제목: "📋 할일 상기"
  - 본문: 할일 제목 + 기한 정보 (또는 "기한 없음")
  - overdue 할일은 강조 표시
  - PRD 3.1.1의 알림 내용 예시 참고

### 1-3. Todo별 개별 상기 설정 연동

- [x] remindTimes 배열에서 type별 발송 시각 계산
  - type='time': 매일 특정 시각
  - type='before_due': 기한 N분 전
  - PRD 4.1의 TodoRemindEntry 참고
- [x] 기한 없는 할일도 상기에 포함 — "(기한 없음)" 라벨 표시

---

## 2. 알람 (Alert) 발송

> PRD 참조: 3.1.1 2단계 알람, 7.2 알림 채널별 동작

### 2-1. 수동 알람 스케줄링

- [x] todoTiming.alertTimes 배열에서 각 알람 시각 읽기
  - 각 시각마다 개별 알림 스케줄 등록
  - PRD 4.1의 TodoAlertEntry 참고
- [x] Service Worker에서 알람 체크 및 발송
- [x] Capacitor 알람 스케줄링 (진동+소리 채널)
- [ ] FCM 높은 우선순위 푸시 발송

### 2-2. 자동 알람 (autoAlertBefore) 스케줄링

- [x] 기한 시각 - autoAlertBefore 분 = 알람 시각 계산
  - 기한 없는 할일에는 적용 안됨. 할일 편집 폼에서 기한 미설정 시 자동알람 토글 비활성화 + "기한 설정 시 적용됩니다" 안내
  - useGlobalAutoAlert=true이면 앱 설정값 사용
- [x] 계산된 시각에 알림 스케줄 등록

### 2-3. 알람 강조 표현

- [x] 푸시 알림에 requireInteraction: true 적용 (PRD 8.2 PWA 한계 참고)
- [x] 알람 알림 클릭 시 해당 할일로 이동
  - Service Worker의 notificationclick 이벤트에서 처리

### 2-4. Alert 앱 내 모달 오버레이 (포그라운드)

- [x] AlertModal 컴포넌트 생성
  - 앱 열려있을 때 알람 시각이 되면 전체화면 모달 표시
  - 배경 블러 + 반투명 오버레이
  - "🔔 지금 해야 해요!" + 할일 제목 + 기한
  - [완료] [미루기] [닫기] 버튼
  - PRD 8.5 참고
- [x] 앱 포그라운드에서 알람 시각 도달 감지
  - 타이머 또는 정기 체크로 현재 시각 == 알람 시각 감지

---

## 3. 기한초과 (Overdue) 앱 내 처리

> PRD 참조: 3.1.1 3단계 기한초과, 5.2 overdue 카드, 5.3 overdue 섹션

### 3-1. 앱 내 배지/강조

- [x] 하단 네비바 할일 탭에 overdue 건수 배지 표시 (빨간 원 + 숫자)
- [x] 홈 화면 "오늘의 할일" 섹션에서 overdue 항목 빨간색 표시 + 최상단 배치

### 3-2. overdue 정기 업데이트

- [x] 앱 진입 시 + 주기적으로 overdue 상태 재계산
  - 기한 지난 pending 할일 식별
  - 할일 목록 정렬 갱신

---

## 4. 미루기 기능

> PRD 참조: 3.3, 3.3.1, 5.5 미루기 바텀시트

### 4-1. 미루기 바텀시트 UI

- [x] PostponeSheet 컴포넌트 생성 (기존 바텀시트 패턴 활용)
  - 헤더: "📌 미루기 - {할일 제목}"
  - PRD 5.5 레이아웃 참고
- [x] 빠른 선택 버튼: [내일] [모레] [이번 주말] [다음 주]
  - 현재 기한 기준 날짜 계산 표시
- [x] 날짜 직접 선택 (date picker, 과거 날짜 불가)
- [x] 미루기 이력 표시: "미룬 횟수: 이전 N회" (postponeInfo.count에서 읽기)

### 4-2. 미루기 에스컬레이션 (2회차부터)

- [x] 2회째 미루기 시 경고 메시지 표시
  - "⚠️ 이 할일은 이미 N회 미뤄졌습니다."
  - 원래 기한 표시: "(원래 기한: M/D → 현재: M/D)"
  - PRD 3.3.1 참고
- [x] 미루기 횟수 제한 토글 (기본 off)
  - 토글 on 시: "앞으로 최대: [N회] 까지 허용" 프리셋 (1/2/3/5회)
  - maxAllowed 값 설정 (설정 항목이 아님 — 미루기 시점에만 입력)
  - "⚠️ 소진 시 완료/건너뛰기만 가능" 안내

### 4-3. 미루기 처리 로직

- [x] 미루기 실행 — dueDate 변경, postponeInfo 업데이트
  - postponeInfo.count 증가
  - postponeInfo.history에 기록 추가 (from, to, postponedAt)
  - 첫 미루기 시 postponeInfo.originalDueDate 저장
  - 반복 할일의 경우: postponeInfo는 Memo 레벨이므로 인스턴스가 바뀌어도 count 누적. 인스턴스별 리셋은 차후 고려사항 (overview 참조)
- [x] 미루기 가능 여부 판단
  - maxAllowed가 null이면 항상 가능
  - maxAllowed 설정 시 count < maxAllowed일 때만 가능
  - 불가 시 미루기 버튼 비활성화 + "완료 또는 건너뛰기만 가능" 안내
- [x] 미루기 시 알람 이동 처리
  - autoAlertBefore → 새 기한 기준으로 재계산
  - 수동 alertTimes → 이동 안 함. 미루기로 과거 시각이 된 alertTimes는 SW/Capacitor 스케줄에서 제거. 복원 없음 (수동 알람은 사용자가 편집에서 다시 설정)
  - 상기(remind) → 새 기한 기준으로 재계산
- [x] Supabase 동기화 — 변경된 dueDate, postponeInfo 즉시 동기화

### 4-4. 할일 카드/모달에서 미루기 진입

- [x] MemoCard의 todo 변형에 [미루기] 빠른 액션 버튼 추가 → PostponeSheet 열기
- [x] Alert 모달의 [미루기] 버튼 → PostponeSheet 열기

---

## 5. 완료 되돌리기 (Undo)

> PRD 참조: 10.2 항목 1

- [x] 완료 처리 후 토스트 표시: "✅ '{할일 제목}' 완료" + [실행 취소] 버튼 (3초간)
  - 페이지 이동 시 토스트 소멸. 다른 할일 완료 시 기존 토스트 교체 (최신 1건만 유지)
- [x] 실행 취소 → todoStatus='pending', completedAt 초기화

---

## 6. Todo별 상기/알람 개별 설정

> PRD 참조: 3.1.2 설정 레이어, 4.1 TodoTiming

### 6-1. 할일 편집 폼에서 개별 설정

- [ ] 상기 개별 추가 UI
  - "앱 기본값 사용" 토글 (useGlobalRemind)
  - 토글 off 시 개별 상기 시각 0~N개 추가: [+ 상기 추가] → 시각 또는 "기한 N분 전"
- [ ] 알람 개별 추가 UI
  - 자동알람 사용 여부 토글 (useGlobalAutoAlert)
  - 수동 알람 0~N개 추가: [+ 알람 추가] → 시각 입력

### 6-2. 알림 스케줄 갱신

- [x] 개별 설정 변경 시 해당 할일의 알림 스케줄 재등록
  - 기존 스케줄 취소 → 새 스케줄 등록 (SW, Capacitor, FCM 모두)

---

## 7. 알림 내역 연동

> PRD 참조: 7.1 할일 알림 vs 기존 알림

- [ ] 할일 알림도 기존 notificationHistoryStore에 기록
  - 상기/알람 발송 시 이력 저장
  - 할일 알림 구분 필드 추가 (예: source='todo')
- [ ] 기존 알림내역 페이지에서 할일 알림 함께 표시

---

## 완료 기준

Phase 2가 "완료"되려면 아래 시나리오가 모두 동작해야 한다:

1. 각 할일의 개별 상기 시각에 상기 알림이 발송된다
2. 사용자가 설정한 알람 시각에 강조 알림이 발송된다
3. 자동알람 (기한 N시간 전) 이 정상 발송된다
4. 앱이 열려있을 때 알람 시각에 모달 오버레이가 표시된다
5. 미루기 바텀시트에서 빠른 선택 또는 직접 입력으로 기한을 미룰 수 있다
6. 2회째 미루기부터 경고가 표시되고, 횟수 제한을 설정할 수 있다
7. 횟수 제한 초과 시 미루기가 불가능하다
8. 미루기 시 autoAlertBefore만 재계산되고 수동 alertTimes는 유지된다
9. 완료 후 3초간 "실행 취소" 토스트가 표시된다
10. Todo별로 상기/알람을 개별 설정할 수 있다
11. 할일 알림이 알림 내역에 기록된다

**Phase 2에서 동작하지 않는 것 (Phase 3 이후):**
- 건너뛰기 기능은 Phase 3 (반복 할일 전용)
- 반복 할일의 알람은 Phase 3
- Native Fullscreen Alert는 Phase 4
