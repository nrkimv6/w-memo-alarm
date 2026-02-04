# TODO 기능 추가 아이디어

> **상태**: 선택적 구현 / 사용자 피드백 기반 판단
> **출처**: Phase 4에서 분리된 선택적 기능들

---

## 1. 전용 TodoGroup 기능

> **출처**: Phase 4 Section 4-2
> **판단 기준**: 현재 태그/폴더 기반 그룹핑으로 충분한지 사용자 피드백 수집 후 결정

### 배경
- Phase 1에서 `ma_todo_groups` 테이블은 이미 생성됨
- 현재 태그와 폴더로 할일 그룹핑 가능
- 전용 그룹 기능의 필요성을 사용자 피드백으로 검증 필요

### 구현 범위

**데이터베이스**
- [x] `ma_todo_groups` 테이블 (Phase 1에서 완료)
  ```sql
  - id: uuid (PK)
  - user_id: uuid (FK)
  - name: text
  - color: text
  - icon: text
  - order_index: integer
  - created_at: timestamptz
  - updated_at: timestamptz
  ```

**기능**
- [ ] TodoGroup CRUD
  - 생성: 그룹 이름, 색상, 아이콘 설정
  - 수정: 그룹 속성 변경
  - 삭제: 그룹 삭제 (할일은 유지)
  - 순서 변경: drag & drop으로 그룹 순서 조정

- [ ] 할일 할당/해제
  - 할일 편집 시 그룹 선택
  - 드래그 앤 드롭으로 그룹 간 이동
  - 그룹 없는 할일 허용 (Unassigned)

- [ ] 그룹 진행률 표시
  - 그룹별 완료율: "출장 준비: 2/3 완료 (67%)"
  - 그룹 카드에 미니 프로그레스 바
  - 그룹 내 할일 카운트 (전체/완료/미완료)

- [ ] 그룹 뷰
  - 그룹별로 접힌/펼쳐진 섹션
  - 그룹 클릭 시 해당 그룹 할일만 필터링
  - "모든 그룹" 뷰로 전환

### 태그/폴더와의 차이점
- **태그**: 다중 할당 가능, 분류/검색 용도
- **폴더**: 계층 구조, 메모 전체 관리
- **TodoGroup**: 할일 전용, 프로젝트/목표 단위 관리

### 구현 우선순위
- 🔴 **Low**: 태그/폴더로 충분하다는 피드백이 많을 경우
- 🟡 **Medium**: "프로젝트 단위 관리가 필요하다"는 요청이 있을 경우
- 🟢 **High**: "태그만으로는 부족하다"는 피드백이 많을 경우

---

## 2. 일괄 미루기 (Batch Postpone)

> **출처**: Phase 4 Section 7-2
> **난이도**: ⭐ (쉬움)
> **예상 시간**: 30분

### 현재 상태
- ✅ 일괄 완료 구현됨
- ✅ 일괄 삭제 구현됨
- ⏸️ 일괄 미루기만 미구현

### 구현 방안

**옵션 A: PostponeSheet 재사용**
```typescript
async function batchPostpone() {
  if (selectedTodoIds.size === 0) return;

  // PostponeSheet를 열어서 날짜 선택
  // 선택된 모든 할일에 동일한 날짜 적용
  showBatchPostponeSheet = true;
}
```

**옵션 B: 빠른 미루기 버튼**
```typescript
// 배치 액션 바에 빠른 버튼 추가
- "내일로" 버튼: 선택된 할일을 모두 내일로
- "다음주로" 버튼: 선택된 할일을 모두 다음 주 월요일로
- "날짜 선택" 버튼: PostponeSheet 열기
```

### 추천 구현
옵션 B (빠른 버튼 + 날짜 선택)가 사용성이 더 좋음

---

## 3. 체크리스트 → 할일 변환

> **출처**: Phase 4 Section 8-3
> **난이도**: ⭐⭐ (보통)
> **예상 시간**: 1시간

### 현재 상태
- ✅ 메모 ↔ 할일 전환 구현됨
- ✅ 체크리스트 기능 있음 (Phase 12)
- ⏸️ 체크리스트 항목 분할만 미구현

### 구현 방안

**UI 위치**
- 메모 상세 화면에서 체크리스트가 있는 경우
- "체크리스트를 할일로 변환" 버튼 표시

**변환 로직**
```typescript
async function convertChecklistToTodos(memo: Memo) {
  if (!memo.checklist || memo.checklist.length === 0) return;

  // 각 체크리스트 항목을 개별 할일로 생성
  for (const item of memo.checklist) {
    await memosStore.add({
      title: item.text,
      content: `원본 메모: ${memo.title}`,
      tags: [...memo.tags],
      memoType: 'todo',
      todoStatus: item.completed ? 'completed' : 'pending',
      folderId: memo.folderId,
      // 기한은 없음 (사용자가 나중에 설정)
    });
  }

  // 원본 메모는 유지 또는 삭제 (사용자 선택)
}
```

**옵션**
- [ ] 완료된 항목도 할일로 변환 (완료 상태 유지)
- [ ] 미완료 항목만 할일로 변환
- [ ] 원본 메모 유지/삭제 선택
- [ ] 기한 일괄 설정 옵션

---

## 4. 홈 화면 위젯

> **출처**: Phase 4 Section 5
> **난이도**: ⭐⭐⭐⭐ (어려움)
> **플랫폼**: Android Native

### 요구사항
- Android Home Screen Widget
- 할일 진행률 표시 (오늘/이번 주)
- 할일 목록 미리보기
- 위젯 클릭 시 앱 열기

### 기술 스택
- Android Widget Provider
- RemoteViews
- App Widget Configuration
- Periodic Update (AlarmManager 또는 WorkManager)

### 위젯 종류

**1. 작은 위젯 (2x2)**
- 오늘 진행률만 표시
- 프로그레스 바
- "오늘 할일: 2/5"

**2. 중간 위젯 (4x2)**
- 오늘 + 이번 주 진행률
- Overdue 카운트
- 탭하여 앱 열기

**3. 큰 위젯 (4x4)**
- 진행률 표시
- 오늘 할일 목록 (최대 5개)
- 체크박스 클릭으로 완료 처리
- 스크롤 가능한 리스트

### 구현 우선순위
- 🟡 **Medium**: Android 사용자가 많고 위젯 요청이 있을 경우
- 선행 조건: Native 개발 환경 구축 완료

---

## 5. 장기 로드맵 아이디어 (계획 미정)

### 캘린더 뷰
- 월간 캘린더에 할일 표시
- 날짜별 할일 개수 표시
- 날짜 클릭 시 해당 날짜 할일 목록

### 자연어 입력
- "내일 오후 3시에 회의" → 자동 파싱
- "매주 월요일 운동" → 반복 할일 자동 생성
- GPT API 또는 로컬 NLP 사용

### 서브태스크
- 할일 내에 하위 할일 추가
- 트리 구조 표시
- 서브태스크 진행률 표시

### 알림 피로도 관리
- 알림 빈도 분석
- 스누즈 횟수 추적
- 알림 시간 최적화 제안

### On-Device AI
- 할일 우선순위 추천
- 완료 시간 예측
- 태그 자동 제안

---

## 구현 판단 기준

### 즉시 구현 추천 ✅
1. **일괄 미루기** - 쉽고 유용함
2. **체크리스트→할일 변환** - 워크플로우 개선

### 사용자 피드백 필요 ⏸️
1. **전용 TodoGroup** - 태그/폴더로 충분한지 검증
2. **홈 화면 위젯** - Android 사용자 비율 확인

### 장기 로드맵 📅
1. **캘린더 뷰** - 요청 시 검토
2. **자연어 입력** - 요청 시 검토
3. **서브태스크** - 요청 시 검토
4. **AI 기능** - 향후 고려
