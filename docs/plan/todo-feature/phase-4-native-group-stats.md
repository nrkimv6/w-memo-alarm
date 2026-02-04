# Phase 4: Native 강화 + 그룹 + 통계

> **목표**: Native Fullscreen Alert, 전용 TodoGroup, 완료 통계, 대량 처리
> **PRD 참조**: 8.3, 8.4, 8.6, 10.1, 10.2 — [docs/prd/2026-02-04_todo-note-prd.md](../../prd/2026-02-04_todo-note-prd.md)
> **선행 조건**: Phase 1~3 완료

---

## 1. Native Fullscreen Alert (Android)

> PRD 참조: 8.3 Native App 상세, 8.4 플랫폼별 전략, 8.6 Native Fullscreen Alert UI

### 1-1. Capacitor 커스텀 플러그인 프로젝트 셋업

- [ ] Android 네이티브 플러그인 구조 생성 (Capacitor 커스텀 플러그인)
- [ ] Java/Kotlin으로 FullscreenAlarmActivity 구현
  - setShowWhenLocked, setTurnScreenOn, requestDismissKeyguard
  - PRD 8.3의 "구현 방법 (Android)" 참고

### 1-2. Fullscreen Alert UI 구현

- [ ] 전체화면 레이아웃 (Android Native XML)
  - 벨 아이콘 + "지금 해야 해요!" + 할일 제목 + 기한
  - [완료] [미루기] [닫기] 버튼
  - PRD 8.6 참고
- [ ] 완료/미루기/닫기 액션 처리
  - 완료 → todoStatus='completed' + Activity 종료
  - 미루기 → 앱 내 PostponeSheet 열기 + Activity 종료
  - 닫기 → Activity 종료만

### 1-3. 플러그인 ↔ JS 브릿지

- [ ] Capacitor 브릿지로 JS에서 fullscreen alert 트리거
  - showFullscreenAlert(todoId, title, dueDate)
  - 콜백: onComplete, onPostpone, onDismiss

### 1-4. Alert 채널 분리

- [ ] Android Notification Channel 생성
  - "할일 알람" 채널: 높은 우선순위, 커스텀 소리, 진동
  - "할일 상기" 채널: 기본 우선순위
  - 기존 알림 채널과 분리

### 1-5. Fullscreen Alert 트리거 연동

- [ ] Phase 2의 알람 발송 로직에서 Native 환경 분기
  - Capacitor → Fullscreen Alert
  - PWA → 기존 requireInteraction 푸시
  - PRD 8.4의 플랫폼별 전략 표 참고

---

## 2. Native Ongoing 노티피케이션

> PRD 참조: 8.3 고정 노티피케이션

### 2-1. Ongoing 노티피케이션 구현

- [ ] Capacitor 커스텀 플러그인에 ongoing 노티피케이션 기능 추가
  - setOngoing(true) — 스와이프 제거 불가
  - 남은 시간 표시 (예: "우유 사기 - 3시간 남음")
- [ ] 업데이트 주기 설정 (매 분 또는 매 시간 남은 시간 갱신)
- [ ] 기한 도달 시 "기한 초과" 표시 변경
- [ ] 완료 시 ongoing 노티피케이션 자동 해제

---

## 3. 배터리 최적화 해제 안내

> PRD 참조: 11.1 배터리 옵티마이저 연동

### 3-1. 배터리 최적화 상태 감지

- [ ] Capacitor 플러그인으로 배터리 최적화 상태 확인
  - PowerManager.isIgnoringBatteryOptimizations() 호출

### 3-2. 해제 안내 다이얼로그

- [ ] 할일 기능 첫 사용 시 안내 표시
  - "정확한 알림을 위해 배터리 최적화를 해제해 주세요"
  - [해제하기] → OS 설정 화면 이동
  - [나중에] / [다시 보지 않기]
  - PRD 11.1 참고

### 3-3. 설정 페이지 경고 배너

- [ ] 배터리 최적화 미해제 시 설정 페이지에 경고 표시
  - "⚠️ 배터리 최적화가 활성화되어 알림이 지연될 수 있습니다" + [설정으로 이동]

---

## 4. 태그/폴더 기반 그룹핑

> PRD 참조: 10.1 그룹핑에 대한 의견

### 4-1. 기존 태그/폴더로 할일 그룹핑

- [ ] 할일 전용 뷰에서 태그별 필터 강화 — 태그 클릭 시 해당 태그 할일만 표시
- [ ] 폴더별 할일 표시 — 폴더 내 할일만 필터링

### 4-2. 전용 TodoGroup 도입 여부 판단

- [ ] 태그/폴더로 충분한지 사용자 피드백 기반 검증 (PRD 10.1 참고)
- [ ] 필요 시: ma_todo_groups 테이블 활용 (Phase 1에서 DB 이미 생성됨)
- [ ] 필요 시: TodoGroup CRUD (생성, 수정, 삭제, 할일 할당/해제)
- [ ] 필요 시: 그룹 진행률 표시 — "출장 준비: 2/3 완료 (67%)"

---

## 5. 할일 진행률 표시 강화

> PRD 참조: 5.3 할일 전용 뷰의 진행률 바

- [x] 일간/주간 진행률 동시 표시: "📊 오늘: 1/3 (33%) | 이번 주: 2/8 (25%)"
- [ ] 홈 화면 위젯에도 진행률 바 추가

---

## 6. 완료 통계

> PRD 참조: 10.2 항목 5 — 완료 통계/스트릭

### 6-1. 기본 통계

- [ ] 일간/주간/월간 완료율 계산 및 표시

### 6-2. 스트릭 (연속 완료)

- [ ] 연속 완료 일수 계산: 매일 할일을 모두 완료한 연속 일수 표시 ("🔥 N일 연속 완료!")

### 6-3. 미루기 통계

- [ ] 가장 많이 미룬 할일 Top 3 (postponeInfo.count 기준)

### 6-4. 통계 페이지/섹션

- [ ] 할일 전용 뷰에 통계 탭/섹션 추가 (또는 설정 > 통계 페이지)

---

## 7. 대량 처리 (Batch Actions)

> PRD 참조: 10.2 항목 2

### 7-1. 다중 선택 모드

- [ ] 할일 목록에서 길게 누르기 → 다중 선택 모드 활성화
- [ ] 체크박스로 여러 할일 선택

### 7-2. 일괄 액션

- [ ] 일괄 완료: 선택한 할일 모두 'completed' 변경
- [ ] 일괄 미루기: 선택한 할일 모두 같은 날짜로 미루기 (PostponeSheet 활용)
- [ ] 일괄 삭제: 선택한 할일 모두 삭제 (확인 다이얼로그)

### 7-3. overdue 일괄 처리

- [ ] overdue 섹션에 "모두 내일로 미루기" 또는 "모두 완료" 빠른 버튼

---

## 8. 할일 ↔ 메모 전환

> PRD 참조: 10.2 항목 6

### 8-1. 메모 → 할일 전환

- [ ] 메모 상세 > 더보기 > "할일로 전환"
  - memoType='todo', todoStatus='pending', 기존 내용/태그 유지

### 8-2. 할일 → 메모 전환

- [ ] 할일 상세 > 더보기 > "메모로 전환"
  - memoType='note', 완료 기록 유지 (참고용)

### 8-3. 체크리스트 → 할일 변환

- [ ] 체크리스트 항목을 개별 할일로 변환하는 기능 (선택적, 사용자 요청 시)

---

## 완료 기준

Phase 4가 "완료"되려면 아래 시나리오가 모두 동작해야 한다:

1. Android Native에서 잠금화면 위에 전체화면 알람이 표시된다
2. Fullscreen 알람에서 완료/미루기/닫기가 동작한다
3. 알람 채널이 분리되어 별도 소리/진동 설정이 가능하다
4. 배터리 최적화 해제 안내가 표시된다
5. 태그/폴더로 할일을 그룹핑하여 볼 수 있다
6. 일간/주간/월간 완료 통계가 표시된다
7. 여러 할일을 선택하여 일괄 완료/미루기/삭제할 수 있다
8. 메모 ↔ 할일 전환이 가능하다

**Phase 4에서 동작하지 않는 것 (Phase 5 이후):**
- 캘린더 뷰
- 자연어 입력
- 서브태스크
- Android 위젯
- 알림 피로도 관리
- On-Device AI 연동
