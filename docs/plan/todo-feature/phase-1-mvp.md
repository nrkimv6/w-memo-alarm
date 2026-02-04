# Phase 1: 기본 할일 (MVP)

> **목표**: 할일을 만들고, 보고, 완료할 수 있는 최소 기능
> **PRD 참조**: 전체 — [docs/prd/2026-02-04_todo-note-prd.md](../../prd/2026-02-04_todo-note-prd.md)
> **선행 조건**: 없음 (첫 번째 Phase)

---

## 시작 전 결정 필요 사항

- [ ] **[결정 필요]** 네비게이션 구조: 5탭 vs 4탭+홈위젯 (PRD 5.1)
- [ ] **[결정 필요]** "하루 종일" 할일의 overdue 판단 시각 (PRD 5.4)
- [ ] **[결정 필요]** 기존 memoType 'task' 데이터 존재 여부 확인 (PRD 4.1)
- [ ] **[결정 필요]** TodoGroup 테이블을 Phase 1 마이그레이션에 포함할지 여부 (PRD 4.3, 10.1)

---

## 1. 데이터 모델 확장

> PRD 참조: 4.1 Todo 확장 필드, 4.3 Supabase 마이그레이션

### 1-1. 타입 정의

- [ ] `src/lib/types/memo.ts`에 할일 관련 타입 추가
  - TodoStatus 타입 ('pending' | 'completed' | 'skipped')
  - TodoPriority 타입 ('low' | 'medium' | 'high' | 'urgent')
  - TodoTiming 인터페이스 (상기/알람 개별 설정 구조)
  - TodoRemindEntry, TodoAlertEntry 인터페이스
  - Recurrence 인터페이스 (반복 패턴 — Phase 3에서 사용하지만 타입은 미리 정의)
  - TodoInstance 인터페이스 (반복 인스턴스 — Phase 3에서 사용하지만 타입은 미리 정의)
  - PostponeInfo, PostponeRecord 인터페이스
  - PRD 4.1의 모든 인터페이스/타입 참고

- [ ] Memo 인터페이스에 할일 필드 추가
  - `memoType?: 'note' | 'bookmark' | 'todo'` (기존 필드 확장 또는 신규)
  - `todoStatus`, `todoPriority`, `dueTime`, `todoTiming` 등
  - `recurrence`, `todoInstances`, `postponeInfo`, `todoGroupId` (Phase 3/4용이지만 타입에는 포함)
  - PRD 4.1 전체 Memo 인터페이스 확장 부분 참고

### 1-2. Supabase DB 마이그레이션

- [ ] 마이그레이션 SQL 파일 작성 (`data/migrations/xxx_todo_feature.sql`)
  - `ma_memos` 테이블에 할일 컬럼 추가 (todo_status, todo_priority, due_time, todo_timing 등)
  - 인덱스 생성 (todo_status, due_date WHERE memo_type = 'todo')
  - **[결정 필요]** ma_todo_groups 테이블은 Phase 4로 미룰지 여부
  - PRD 4.3 전체 SQL 참고

- [ ] 마이그레이션 실행 및 검증
  - Supabase 대시보드에서 마이그레이션 적용
  - RLS 정책 정상 동작 확인

### 1-3. localStorage 스키마 업데이트

- [ ] 기존 localStorage 저장 로직에 할일 필드 포함되도록 확인
  - `src/lib/stores/memos.svelte.ts`의 저장/불러오기 로직에서 새 필드가 누락되지 않는지 확인
  - Supabase ↔ localStorage 동기화 시 새 필드 매핑

---

## 2. 할일 생성/편집 폼

> PRD 참조: 5.4 할일 생성/편집 폼

### 2-1. TodoForm 컴포넌트 생성

- [ ] 새 컴포넌트 파일 생성 (예: `src/lib/components/todo/TodoForm.svelte`)
  - 또는 기존 MemoForm에 memoType='todo' 분기 추가
  - 어느 방식이든, PRD 5.4의 폼 레이아웃을 따를 것

- [ ] 제목 입력 필드
  - 필수 입력
  - 기존 MemoForm의 제목 입력과 동일한 스타일

- [ ] 메모(내용) 입력 필드 — 선택사항
  - 기존 MemoForm의 content 입력 재활용

- [ ] 우선순위 선택 UI
  - 세그먼트 버튼: [낮음] [보통] [높음] [긴급]
  - 기본값: '보통' (medium)
  - PRD 5.4의 "우선순위: [낮음] [보통] [높음] [긴급]" 부분 참고

- [ ] 태그 입력
  - 기존 태그 입력 컴포넌트 재활용

### 2-2. 기한 설정 UI

- [ ] 기한 날짜 선택 (date picker)
  - 기존 dueDate 필드 활용
  - 선택사항 (기한 없는 할일도 가능)

- [ ] 기한 시각 선택 (time picker)
  - dueTime 필드 (HH:mm)
  - "하루 종일" 체크박스 — 체크 시 시각 입력 비활성화
  - **[결정 필요]** "하루 종일"일 때 내부적으로 dueTime을 어떤 값으로 저장할지

- [ ] 기한 설정 시 알람 섹션 자동 표시
  - 기한을 입력하면 "⏰ 알람" 섹션이 자동으로 펼쳐짐
  - Phase 1에서는 표시만 하고, 실제 알림 발송은 Phase 2에서 구현
  - PRD 5.4의 "├─── ⏰ 알람 (기한 설정 시 자동 표시)" 부분 참고

### 2-3. 알람 설정 UI (표시만, 발송은 Phase 2)

- [ ] 상기 설정 토글 + 프리셋
  - "☑ 상기: [하루 전 ▼]"
  - 프리셋: 1시간 전, 3시간 전, 하루 전, 3일 전
  - 데이터는 todoTiming.remindTimes에 저장
  - 앱 기본값 사용 여부 (useGlobalRemind) 연동

- [ ] 알람 설정 토글 + 시각 입력
  - "☑ 알람: [10:00]"
  - 시각을 직접 입력
  - 데이터는 todoTiming.alertTimes에 저장

- [ ] 기한 초과 표시 토글
  - 기본 켜짐

### 2-4. 반복/그룹 설정 (UI만, 로직은 Phase 3/4)

- [ ] 반복 설정 드롭다운 — 비활성 상태 또는 "향후 지원 예정" 표시
  - Phase 1에서는 UI 자리만 잡아두고 실제 동작은 Phase 3에서 구현
  - 또는 Phase 1에서 아예 숨기고 Phase 3에서 추가 (팀 결정)

- [ ] 그룹 선택 드롭다운 — 비활성 상태 또는 숨김
  - Phase 4에서 구현

### 2-5. 저장 로직

- [ ] memoType='todo'로 설정하여 저장
  - todoStatus = 'pending' (기본)
  - todoPriority = 선택한 우선순위
  - dueDate, dueTime 저장
  - todoTiming 저장 (상기/알람 설정)

- [ ] 기존 memosStore의 addMemo/updateMemo 함수에서 할일 필드 처리 추가

- [ ] Supabase 동기화 시 할일 필드 포함 확인

---

## 3. 할일 카드 표시

> PRD 참조: 5.2 할일 카드

### 3-1. MemoCard 내 할일 변형

- [ ] MemoCard.svelte에서 `memoType === 'todo'` 분기 추가
  - 체크박스 + 제목 (왼쪽에 체크박스 표시)
  - 우선순위 배지 (긴급=빨강, 높음=주황, 보통=없음, 낮음=회색)
  - PRD 5.2의 카드 레이아웃 참고

- [ ] 기한 + 반복 표시 영역
  - "📅 2/5(수) 18:00" 형식
  - 반복 아이콘은 Phase 3에서 추가 (지금은 기한만)

- [ ] 알림 3단계 요약 표시
  - "⏰ 상기: 하루 전 | 알람: 10:00" 형식
  - 데이터는 todoTiming에서 읽어 표시

- [ ] 태그 표시
  - 기존 태그 표시 로직 재활용

### 3-2. 기한 초과(overdue) 표시

- [ ] overdue 판단 로직 구현
  - `pending` 상태이고 `dueDate + dueTime < now`이면 overdue
  - overdue는 별도 상태값이 아니라 연산된 상태 (PRD 3.4 참고)
  - 유틸 함수로 분리: `isOverdue(memo: Memo): boolean`

- [ ] overdue 카드 스타일
  - 빨간 배경 또는 빨간 테두리
  - "⚠️ 기한지남" 배지 표시
  - "❌ N일 초과" 또는 "❌ Nh 초과" 형식으로 초과 시간 표시
  - PRD 5.2의 overdue 카드 참고

### 3-3. 완료 카드 스타일

- [ ] 완료된 할일 카드 스타일
  - 취소선 + 연한 색상
  - "✅ 완료" 배지 + 완료 시각 표시
  - PRD 5.2의 완료 카드 참고

### 3-4. 할일 완료 체크

- [ ] 체크박스 클릭 → todoStatus = 'completed' 전환
  - completedAt 시각 기록
  - 카드 스타일 즉시 반영 (completed 스타일로 변경)

- [ ] 완료 취소 (체크 해제)
  - todoStatus = 'pending'으로 복귀
  - completedAt 초기화
  - Phase 2에서 undo 토스트로 개선하지만, Phase 1에서도 기본적으로 가능하게

---

## 4. 할일 전용 뷰 (/todos)

> PRD 참조: 5.3 할일 전용 뷰

### 4-1. 라우트 및 페이지 생성

- [ ] `src/routes/todos/+page.svelte` 신규 생성
  - 페이지 타이틀 "✅ 할일"
  - 우측 상단에 검색, 설정, 추가 버튼

### 4-2. 기간 필터 탭

- [ ] 상단 필터 탭 구현
  - [오늘] [이번주] [전체] [완료됨]
  - 탭 전환 시 필터 적용
  - `src/lib/stores/filter.svelte.ts`에 할일 필터 로직 추가

- [ ] "오늘" 필터: 오늘 기한 + 기한 없는 미완료 + overdue
- [ ] "이번주" 필터: 이번 주 기한 할일
- [ ] "전체" 필터: 미완료 전체
- [ ] "완료됨" 필터: todoStatus === 'completed'

### 4-3. 섹션별 정렬/표시

- [ ] overdue 섹션 (빨간 영역)
  - "⚠️ 기한 지남 (N)" 헤더
  - 기한 초과 할일을 최상단에 표시
  - PRD 5.3, 9.4의 정렬 우선순위 참고

- [ ] 날짜별 섹션
  - "📅 오늘 2/4 (화)" 형식의 날짜 헤더
  - 각 섹션 내 할일 카드 나열
  - 각 섹션 내에서 시각 순 정렬

- [ ] 기한 없는 할일
  - "오늘" 섹션의 하단에 표시
  - "(기한 없음)" 라벨
  - PRD 9.4 참고

- [ ] 완료된 할일
  - 각 날짜 섹션의 최하단
  - 연한 색상 + 취소선

### 4-4. 진행률 바

- [ ] 하단에 오늘 진행률 표시
  - "📊 오늘 진행률: ████░░░░ 1/3 (33%)" 형식
  - 오늘 기한 할일 중 완료된 비율
  - 설정에서 showProgress=false 이면 숨김

---

## 5. 네비게이션 연결

> PRD 참조: 5.1 할일 표시 방식

### 5-1. 하단 네비바 수정

- [ ] **[결정 필요]** 5탭 방식인 경우:
  - `src/lib/components/BottomNav.svelte`에 "할일 ✅" 탭 추가
  - 아이콘: CheckSquare 또는 유사 아이콘 (lucide-svelte)
  - 링크: /todos
  - 기존 4탭 간격 조정 (5탭에 맞게)

- [ ] 4탭+위젯 방식인 경우:
  - 기존 "전체" 탭의 필터에 "할일" 추가
  - 홈 화면에 "오늘의 할일" 위젯만 추가

### 5-2. 홈 화면 "오늘의 할일" 섹션

- [ ] `src/routes/+page.svelte`에 "오늘의 할일" 섹션 추가
  - 기존 "🔔 오늘의 알림" 섹션 아래 또는 옆에 배치
  - 오늘 기한 할일 + overdue 할일 표시 (최대 5개)
  - "더 보기" → /todos 로 이동

---

## 6. 설정 — 할일 기본설정

> PRD 참조: 6.1 설정 페이지 UI, 6.2 설정 데이터 모델, 6.3 설정 연동 로직

### 6-1. 설정 데이터 모델

- [ ] `src/lib/stores/settings.svelte.ts`에 TodoDefaultSettings 추가
  - remind: { enabled: boolean, time: string }
  - autoAlert: { enabled: boolean, minutesBefore: number }
  - showOverdue: boolean
  - showProgress: boolean
  - 기본값: remind ON + 07:00, autoAlert OFF, showOverdue ON, showProgress ON
  - PRD 6.2 참고
  - 기존 defaultReminder 패턴을 따를 것

- [ ] localStorage 저장 키에 todoDefaults 포함
  - 기존 'memo-alarm-settings' 키 내에 todoDefaults 추가

### 6-2. 설정 UI

- [ ] `src/routes/settings/+page.svelte`에 "할일 기본설정" 섹션 추가
  - 기존 "기본 알림 설정" 섹션 아래에 배치
  - PRD 6.1의 UI 와이어프레임 그대로 구현

- [ ] 상기 알림 (Remind) 설정
  - ON/OFF 토글
  - 시각 선택 (기본 07:00)
  - 설명 문구: "매일 이 시각에 미완료 할일 요약 알림을 보냅니다. (기한 없는 할일도 포함)"

- [ ] 자동 알람 (Auto Alert) 설정
  - ON/OFF 토글 (기본 OFF)
  - 기한 전 프리셋: 1시간 전 / 3시간 전 / 하루 전(기본) / 3일 전 / 1주 전
  - 설명 문구: "기한이 있는 할일에 자동으로 알람 시각을 설정합니다."

- [ ] 기한 초과 표시 설정
  - ON/OFF 토글 (기본 ON)

- [ ] 완료 통계 표시 설정
  - ON/OFF 토글 (기본 ON)

- [ ] 적용 중인 할일 건수 표시
  - "적용 중인 할일: N건"
  - useGlobalRemind=true 또는 useGlobalAutoAlert=true인 할일 개수

### 6-3. 설정 ↔ Todo 연동

- [ ] 설정 변경 시 연동 로직 구현
  - useGlobalRemind: true인 할일의 상기 시각 일괄 업데이트
  - useGlobalAutoAlert: true인 할일의 자동알람 일괄 업데이트
  - PRD 6.3의 설정 연동 흐름 참고

- [ ] 새 할일 생성 시 앱 설정에서 기본값 상속
  - useGlobalRemind = true, useGlobalAutoAlert = true (기본)
  - 설정값에 따라 todoTiming 자동 세팅
  - PRD 6.4의 기본값 정리 표 참고

---

## 7. 기한 없는 할일 처리

> PRD 참조: 6.4 기한이 없는 할일의 경우

- [ ] 기한 없는 할일 생성 허용
  - dueDate, dueTime 모두 미입력 가능

- [ ] 상기 알림에 포함 (Phase 2에서 실제 발송)
  - "(기한 없음)" 라벨로 표시

- [ ] 자동알람 적용 안됨
  - 기한이 없으면 "N시간 전" 계산 불가

- [ ] overdue 상태 불가
  - isOverdue 함수에서 기한 없으면 false 반환

- [ ] 할일 전용 뷰에서 "오늘" 섹션 하단에 표시

---

## 8. 기존 코드 확인/정리

> PRD 참조: 13.2 기존 코드 활용

- [ ] 기존 `dueDate` 필드 확인
  - Memo 인터페이스에 이미 있는지 확인
  - 있다면 재활용, 없다면 추가

- [ ] 기존 `priority` 필드 확인
  - Memo 인터페이스에 이미 있는지 확인

- [ ] 기존 `memoType` 필드 확인
  - 'note', 'bookmark'이 이미 사용 중인지 확인
  - 'task'라는 값이 기존에 사용된 적이 있는지 확인

- [ ] 기존 `checklist` 필드 확인
  - ChecklistItem 인터페이스가 이미 있는지 확인
  - 할일과 체크리스트의 관계 정리 (PRD 10.2 항목 10 참고)

---

## 완료 기준

Phase 1이 "완료"되려면 아래 시나리오가 모두 동작해야 한다:

1. 사용자가 "할일" 탭 (또는 진입 경로)에서 새 할일을 만들 수 있다
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
