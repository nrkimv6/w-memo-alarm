# Phase 1: 기본 할일 (MVP)

> **목표**: 할일을 만들고, 보고, 완료할 수 있는 최소 기능
> **PRD 참조**: 전체 — [docs/prd/2026-02-04_todo-note-prd.md](../../prd/2026-02-04_todo-note-prd.md)
> **선행 조건**: 없음 (첫 번째 Phase)

---

## 시작 전 확인 사항

결정 완료:
- **기존 memoType 'task' 데이터**: 사용 이력 없음. 별도 처리 없이 마이그레이션 진행

---

## 1. 데이터 모델 확장

> PRD 참조: 4.1 Todo 확장 필드, 4.3 Supabase 마이그레이션

### 1-1. 할일 관련 타입 정의

- [ ] `src/lib/types/memo.ts`에 TodoStatus 타입 추가 ('pending' | 'completed' | 'skipped')
- [ ] TodoPriority 타입 추가 ('low' | 'medium' | 'high' | 'urgent')
- [ ] TodoTiming 인터페이스 추가 (상기/알람 개별 설정 구조)
  - TodoRemindEntry, TodoAlertEntry 포함
  - PRD 4.1 참고
- [ ] Recurrence 인터페이스 추가 (Phase 3에서 사용하지만 타입은 미리 정의)
- [ ] TodoInstance 인터페이스 추가 (Phase 3에서 사용하지만 타입은 미리 정의)
- [ ] PostponeInfo, PostponeRecord 인터페이스 추가

### 1-2. Memo 인터페이스 할일 필드 추가

- [ ] memoType에 'todo' 추가 ('note' | 'bookmark' | 'todo')
- [ ] 할일 전용 필드 추가: todoStatus, todoPriority, dueTime, todoTiming
- [ ] Phase 3/4용 필드도 타입에 포함: recurrence, todoInstances, postponeInfo, todoGroupId
  - PRD 4.1 전체 Memo 인터페이스 확장 부분 참고

### 1-3. Supabase DB 마이그레이션

- [ ] 마이그레이션 SQL 파일 작성 (`data/migrations/xxx_todo_feature.sql`)
  - ma_memos 테이블에 할일 컬럼 추가 (todo_status, todo_priority, due_time, todo_timing 등)
  - 인덱스 생성 (todo_status, due_date WHERE memo_type = 'todo')
  - **ma_todo_groups 테이블도 이 마이그레이션에 포함** (사용은 Phase 4이지만 DB는 미리 생성)
  - PRD 4.3 전체 SQL 참고
- [ ] Supabase 대시보드에서 마이그레이션 적용 및 RLS 정책 검증

### 1-4. localStorage 스키마 업데이트

- [ ] `src/lib/stores/memos.svelte.ts`의 저장/불러오기 로직에서 새 필드가 누락되지 않는지 확인
- [ ] Supabase ↔ localStorage 동기화 시 새 필드 매핑 확인

---

## 2. 할일 생성/편집 폼

> PRD 참조: 5.4 할일 생성/편집 폼

### 2-1. TodoForm 컴포넌트 기본 구조

- [ ] 새 컴포넌트 생성 (예: `src/lib/components/todo/TodoForm.svelte`)
  - 또는 기존 MemoForm에 memoType='todo' 분기 추가
  - 어느 방식이든, PRD 5.4의 폼 레이아웃을 따를 것
- [ ] 제목 입력 필드 (필수)
- [ ] 메모(내용) 입력 필드 (선택)
  - 기존 MemoForm의 content 입력 재활용

### 2-2. 우선순위/태그

- [ ] 우선순위 세그먼트 버튼 구현: [낮음] [보통] [높음] [긴급]
  - 기본값: 'medium'
- [ ] 태그 입력 — 기존 태그 컴포넌트 재활용

### 2-3. 기한 설정 UI

- [ ] 기한 날짜 선택 (date picker) — dueDate 필드. 선택사항 (기한 없는 할일 가능)
- [ ] 기한 시각 선택 (time picker) — dueTime 필드 (HH:mm)
- [ ] "하루 종일" 체크박스 — 체크 시 dueTime = '23:59'로 저장, 시각 입력 비활성화
- [ ] 기한 설정 시 "알람" 섹션 자동 펼침
  - Phase 1에서는 UI 표시만, 실제 알림 발송은 Phase 2
  - PRD 5.4의 "├─── ⏰ 알람 (기한 설정 시 자동 표시)" 참고

### 2-4. 알람 설정 UI (표시만, 발송은 Phase 2)

- [ ] 상기 설정 토글 + 프리셋
  - "☑ 상기: [하루 전 ▼]" (프리셋: 1시간 전, 3시간 전, 하루 전, 3일 전)
  - useGlobalRemind 연동
  - 데이터는 todoTiming.remindTimes에 저장
- [ ] 알람 설정 토글 + 시각 입력
  - "☑ 알람: [10:00]" — 데이터는 todoTiming.alertTimes에 저장
- [ ] 기한 초과 표시 토글 (기본 켜짐)

### 2-5. 반복/그룹 자리 확보

- [ ] 반복 설정 영역 — Phase 1에서는 비활성 또는 숨김 처리 (Phase 3에서 활성화)
- [ ] 그룹 선택 영역 — Phase 1에서는 비활성 또는 숨김 처리 (Phase 4에서 활성화)

### 2-6. 저장 로직

- [ ] memoType='todo'로 설정, todoStatus='pending', todoPriority=선택값으로 저장
- [ ] dueDate, dueTime, todoTiming 저장
- [ ] 기존 memosStore의 addMemo/updateMemo에서 할일 필드 처리 추가
- [ ] Supabase 동기화 시 할일 필드 포함 확인

---

## 3. 할일 카드 표시

> PRD 참조: 5.2 할일 카드

### 3-1. MemoCard 할일 변형

- [ ] MemoCard.svelte에서 memoType === 'todo' 분기 추가
  - 왼쪽 체크박스 + 제목
  - 우선순위 배지 (긴급=빨강, 높음=주황, 보통=없음, 낮음=회색)
  - PRD 5.2의 카드 레이아웃 참고
- [ ] 기한 표시: "📅 2/5(수) 18:00" 형식
- [ ] 알림 요약 표시: "⏰ 상기: 하루 전 | 알람: 10:00" — todoTiming에서 읽어 표시
  - 다중 알림 설정 시 가장 가까운 다음 알림 1건만 카드에 표시. 상세 진입 시 전체 목록 확인
- [ ] 태그 표시 — 기존 로직 재활용

### 3-2. overdue 카드 스타일

- [ ] isOverdue(memo) 유틸 함수 구현
  - pending 상태이고 dueDate + dueTime < now이면 overdue
  - "하루 종일" 할일: dueTime='23:59'이므로 해당 날짜 23:59:59 이후부터 overdue. 즉 사실상 자정(00:00)부터 overdue 표시
  - 기한 없으면 false
  - PRD 3.4 참고 — overdue는 연산된 상태
- [ ] overdue 카드 시각 처리: 빨간 배경/테두리 + "⚠️ 기한지남" 배지 + "❌ N일 초과" 표시

### 3-3. 완료 카드 스타일

- [ ] 완료된 할일: 취소선 + 연한 색상 + "✅ 완료" 배지 + 완료 시각 표시

### 3-4. 할일 완료 체크

- [ ] 체크박스 클릭 → todoStatus='completed', completedAt 기록, 카드 스타일 즉시 반영
- [ ] 완료 취소 (체크 해제) → todoStatus='pending', completedAt 초기화

---

## 4. 할일 전용 뷰 (/todos)

> PRD 참조: 5.3 할일 전용 뷰

### 4-1. 라우트 및 페이지 생성

- [ ] `src/routes/todos/+page.svelte` 신규 생성
  - 페이지 타이틀 + 우측 상단 검색/설정/추가 버튼

### 4-2. 기간 필터 탭

- [ ] 상단 필터 탭: [오늘] [이번주] [전체] [완료됨]
- [ ] `src/lib/stores/filter.svelte.ts`에 할일 필터 로직 추가
  - "오늘": 오늘 기한 + 기한 없는 미완료 + overdue
  - "이번주": 이번 주 기한 할일
  - "전체": 미완료 전체
  - "완료됨": todoStatus === 'completed'

### 4-3. 섹션별 정렬/표시

- [ ] overdue 섹션: "⚠️ 기한 지남 (N)" 헤더, 최상단 배치
  - PRD 5.3, 9.4의 정렬 우선순위 참고
- [ ] 날짜별 섹션: "📅 오늘 2/4 (화)" 헤더, 각 섹션 내 시각 순 정렬
  - 동일 dueDate+dueTime인 할일이 여러 개일 때 생성순(createdAt ASC)으로 tiebreak
- [ ] 기한 없는 할일: "오늘" 섹션 하단에 "(기한 없음)" 라벨로 표시
- [ ] 완료된 할일: 각 날짜 섹션의 최하단, 연한 색상 + 취소선

### 4-4. 진행률 바

- [ ] 하단에 오늘 진행률 표시: "📊 오늘 진행률: ████░░░░ 1/3 (33%)"
  - 오늘 기한 할일 중 완료 비율
  - 설정 showProgress=false이면 숨김

---

## 5. 네비게이션 연결

> PRD 참조: 5.1 할일 표시 방식

### 5-1. 하단 네비바 수정 (4탭 구조)

- [ ] `src/lib/components/BottomNav.svelte` 수정 — 4탭: 홈 / 메모 / 할일 / 설정
  - 할일 탭 아이콘: CheckSquare 또는 유사 아이콘 (lucide-svelte)
  - 링크: /todos
  - 기존 탭 간격 4탭에 맞게 조정
- [ ] 알림내역 접근: 홈 상단 벨 아이콘 또는 설정 내 하위메뉴로 이동

### 5-2. 홈 화면 "오늘의 할일" 섹션

- [ ] `src/routes/+page.svelte`에 "오늘의 할일" 섹션 추가
  - 오늘 기한 할일 + overdue 할일 표시 (최대 5개)
  - "더 보기" → /todos 이동

---

## 6. 설정 — 할일 기본설정

> PRD 참조: 6.1 설정 페이지 UI, 6.2 설정 데이터 모델, 6.3 설정 연동 로직

### 6-1. 설정 데이터 모델

- [ ] `src/lib/stores/settings.svelte.ts`에 TodoDefaultSettings 추가
  - remind: { enabled, time } / autoAlert: { enabled, minutesBefore } / showOverdue / showProgress
  - 기본값: remind ON + 07:00, autoAlert OFF, showOverdue ON, showProgress ON
  - PRD 6.2 참고 (postponeLimit 없음)
- [ ] localStorage 'memo-alarm-settings' 키에 todoDefaults 포함

### 6-2. 설정 UI

- [ ] `src/routes/settings/+page.svelte`에 "할일 기본설정" 섹션 추가
  - PRD 6.1의 UI 와이어프레임 참고
- [ ] 상기 알림 ON/OFF 토글 + 시각 선택 (기본 07:00)
  - 설명: "매일 이 시각에 할일 상기 알림을 보냅니다. (기한 없는 할일도 포함)"
- [ ] 자동 알람 ON/OFF 토글 (기본 OFF) + 기한 전 프리셋 (1시간/3시간/하루/3일/1주)
- [ ] 기한 초과 표시 ON/OFF 토글 (기본 ON)
- [ ] 완료 통계 표시 ON/OFF 토글 (기본 ON)
- [ ] 적용 중인 할일 건수 표시: "적용 중인 할일: N건"

### 6-3. 설정 ↔ Todo 연동

- [ ] 설정 변경 시 useGlobalRemind=true인 할일 상기 시각 일괄 업데이트
- [ ] 설정 변경 시 useGlobalAutoAlert=true인 할일 자동알람 일괄 업데이트
  - PRD 6.3의 설정 연동 흐름 참고
- [ ] 새 할일 생성 시 앱 설정에서 기본값 상속
  - useGlobalRemind=true, useGlobalAutoAlert=true (기본)
  - PRD 6.4 기본값 표 참고

---

## 7. 기한 없는 할일 처리

> PRD 참조: 6.4 기한이 없는 할일의 경우

- [ ] 기한 없는 할일 생성 허용 (dueDate, dueTime 모두 미입력)
- [ ] 상기에 포함 — "(기한 없음)" 라벨 표시 (Phase 2에서 실제 발송)
- [ ] 자동알람 적용 안됨 (기한 없으면 계산 불가)
- [ ] overdue 불가 — isOverdue에서 기한 없으면 false
- [ ] 할일 전용 뷰에서 "오늘" 섹션 하단에 표시

---

## 8. 기존 코드 확인/정리

> PRD 참조: 13.2 기존 코드 활용

- [ ] 기존 dueDate 필드 확인 — Memo 인터페이스에 이미 있는지, 있으면 재활용
- [ ] 기존 priority 필드 확인 — Memo 인터페이스에 이미 있는지
- [ ] 기존 memoType 필드 확인 — 'note', 'bookmark' 사용 현황, 'task' 사용 이력
- [ ] 기존 checklist 필드 확인 — ChecklistItem 인터페이스 존재 여부, 할일과의 관계 정리 (PRD 10.2 항목 10 참고)
  - 할일에 체크리스트가 포함된 경우: 체크리스트 완료와 할일 완료는 독립. 체크박스로 할일을 완료 처리하면 미완료 체크리스트가 있어도 완료됨. 체크리스트는 참고용 진행률로만 표시

---

## 완료 기준

Phase 1이 "완료"되려면 아래 시나리오가 모두 동작해야 한다:

1. 사용자가 "할일" 탭에서 새 할일을 만들 수 있다
2. 제목, 기한, 우선순위, 태그를 설정할 수 있다
3. 기한 없는 할일도 만들 수 있다
4. 할일이 메모 목록에 카드로 표시된다 (todo 변형 스타일)
5. 기한 초과 할일이 빨간색으로 강조된다
6. 할일 전용 뷰 (/todos)에서 오늘/이번주/전체/완료됨 필터로 볼 수 있다
7. 체크박스로 할일을 완료 처리할 수 있다
8. 설정에서 할일 기본설정 (상기/자동알람/기한초과/통계) 을 변경할 수 있다
9. 홈 화면에 "오늘의 할일" 섹션이 표시된다
10. Supabase에 할일 데이터가 동기화된다

**Phase 1에서 동작하지 않는 것 (Phase 2 이후):**
- 실제 알림 발송 (상기/알람)은 Phase 2
- 미루기/건너뛰기는 Phase 2
- 반복 할일은 Phase 3
