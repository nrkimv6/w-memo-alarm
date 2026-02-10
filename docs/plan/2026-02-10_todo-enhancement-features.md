# Todo 기능 강화 계획서

> **작성일**: 2026-02-10
> **범위**: 메모↔할일 전환 개선 + Todo URL 속성 + 펑(Pung) 자동삭제

---

## 1. 메모 ↔ 할일 전환 기능 개선

### 1.1 현재 상태 분석

현재 전환 기능은 **편집 폼(Form)** 에서만 가능:
- `MemoForm.svelte:384-388` — "할일로 전환" 버튼 (memo → todo)
- `TodoForm.svelte:1068-1076` — "메모로 전환" 버튼 (todo → memo)
- 스토어 함수: `memos.svelte.ts:1169` `convertMemoToTodo()`, `memos.svelte.ts:1188` `convertTodoToMemo()`

**문제점**: 전환하려면 반드시 편집 모드에 진입해야 함 → 상세보기에서 바로 전환 불가

### 1.2 요구사항

- 이미 생성된 항목만 **상세보기(Detail Modal)**에서 전환 가능
- 새로 만드는 항목은 전환 대상이 아님 (처음부터 올바른 타입으로 생성)

### 1.3 구현 계획

#### Task 1-1: MemoDetailModal에 "할일로 전환" 버튼 추가
- **파일**: `src/lib/components/memo/MemoDetailModal.svelte`
- **위치**: footer 영역 (`line 264~280`), 삭제 버튼 왼쪽 또는 공유 버튼 옆
- **조건**: `memo.memoType !== 'todo'` 일 때만 표시
- **동작**: `memosStore.convertMemoToTodo(memo.id)` 호출 → 모달 닫기
- **UI**: `<ArrowRightLeft>` 아이콘 + "할일로" 텍스트 (ghost 버튼)

#### Task 1-2: TodoCard 또는 TodoDetailModal에 "메모로 전환" 기능 추가
- 현재 TodoDetailModal이 **존재하지 않음** → TodoForm이 상세보기 겸용
- **방안 A**: TodoCard의 액션 영역에 "메모로 전환" 추가 (스와이프 또는 더보기 메뉴)
- **방안 B** (권장): TodoCard 탭 시 열리는 TodoForm 하단에 이미 있으므로, 카드 길게 누르기(long-press) 컨텍스트 메뉴에 추가
- **동작**: `memosStore.convertTodoToMemo(memo.id)` 호출

#### Task 1-3: 전환 시 확인 다이얼로그
- 할일→메모 전환 시 todo 전용 필드 (기한, 우선순위, 반복 등)가 삭제됨을 안내
- 메모→할일 전환 시에는 별도 확인 불필요 (데이터 손실 없음)

### 1.4 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `MemoDetailModal.svelte` | 전환 버튼 추가 |
| `TodoCard.svelte` | 컨텍스트 메뉴 또는 액션에 전환 추가 |
| `memos.svelte.ts` | 변경 없음 (기존 함수 활용) |

---

## 2. Todo URL 속성 추가

### 2.1 요구사항

- 할일에 **URL 링크를 N개** 첨부 가능
- 리스트 뷰에서는 URL 존재 여부만 **클립 아이콘(📎)** 으로 표시
- 상세보기/편집에서는 URL 목록을 관리

### 2.2 데이터 모델 설계

```typescript
// src/lib/types/memo.ts 에 추가
export interface TodoUrl {
  id: string;        // nanoid 등
  url: string;       // https://...
  label?: string;    // 선택적 레이블 (표시 이름)
  addedAt: number;   // 추가 시각 timestamp
}
```

**Memo 인터페이스 확장**:
```typescript
export interface Memo {
  // ... 기존 필드
  todoUrls?: TodoUrl[];  // Todo URL 목록 (N개)
}
```

### 2.3 DB 마이그레이션

```sql
-- data/migrations/009_todo_urls.sql
ALTER TABLE ma_memos ADD COLUMN todo_urls JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_ma_memos_todo_urls_exists
  ON ma_memos ((todo_urls IS NOT NULL AND todo_urls != '[]'::jsonb))
  WHERE is_active = true;
```

### 2.4 구현 계획

#### Task 2-1: 타입 정의
- **파일**: `src/lib/types/memo.ts`
- `TodoUrl` 인터페이스 추가
- `Memo` 인터페이스에 `todoUrls?: TodoUrl[]` 추가

#### Task 2-2: DB 마이그레이션
- **파일**: `data/migrations/009_todo_urls.sql`
- JSONB 컬럼 추가 + 인덱스

#### Task 2-3: TodoForm에 URL 입력 UI 추가
- **파일**: `src/lib/components/todo/TodoForm.svelte`
- URL 입력 필드 + 추가/삭제 버튼
- URL 유효성 검증 (http/https)
- 선택적 label 입력

#### Task 2-4: TodoCard에 클립 아이콘 표시
- **파일**: `src/lib/components/todo/TodoCard.svelte`
- 조건: `todo.todoUrls && todo.todoUrls.length > 0`
- 위치: 제목 옆 또는 태그 영역 근처
- UI: `<Paperclip class="w-3.5 h-3.5" />` + 개수 표시 (2개 이상일 때)

#### Task 2-5: 스토어 camelCase ↔ snake_case 변환
- **파일**: `src/lib/stores/memos.svelte.ts`
- DB 동기화 시 `todoUrls` ↔ `todo_urls` 변환 추가

### 2.5 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/types/memo.ts` | `TodoUrl` 타입, Memo 필드 추가 |
| `data/migrations/009_todo_urls.sql` | 새 컬럼 + 인덱스 |
| `TodoForm.svelte` | URL 입력 UI |
| `TodoCard.svelte` | 클립 아이콘 표시 |
| `memos.svelte.ts` | 필드 변환 |

---

## 3. Todo 펑(Pung) 기능 — 만료 시 자동삭제

### 3.1 요구사항

- **펑(Pung)**: 기한 만료 시 자동으로 삭제(비활성화)되는 할일
- **반복 할일 + 펑**: 현재 인스턴스 자동 삭제 → 다음 인스턴스 자동 생성
- 기존 **overdue 표시**(빨간색, `!N일 지남`)와 통합 고려

### 3.2 현재 overdue 시스템 분석

```
현재 흐름:
  기한 초과 → isOverdue() = true → 빨간색 표시 + "N일 지남" 배지
  (삭제/정리는 수동으로 사용자가 처리)
```

관련 코드:
- `src/lib/utils/todo.ts:6-24` — `isOverdue()`: dueDate+dueTime 비교
- `src/lib/utils/todo.ts:50-65` — `getOverdueDays()`: 초과 일수 계산
- `TodoCard.svelte:193-200` — overdue 배지 렌더링
- `TodoCard.svelte:175-177` — 기한 텍스트 빨간색 처리
- `src/lib/utils/todo.ts:102-148` — `filterTodos()`: overdue 항목을 "today" 필터에 포함

### 3.3 설계 방향

#### 3.3.1 데이터 모델

```typescript
// Memo 인터페이스 확장
export interface Memo {
  // ... 기존 필드
  autoPung?: boolean;       // 펑 활성화 여부 (기본 false)
  pungDelay?: number;       // 기한 초과 후 N분 뒤 삭제 (기본 0 = 즉시)
}
```

#### 3.3.2 overdue + pung 통합 흐름

```
기한 초과 시:
├── autoPung = false (기본) → 기존 동작: overdue 빨간 표시
│
└── autoPung = true → 펑 동작:
    ├── 비반복 할일:
    │   └── pungDelay 경과 후 → todoStatus = 'skipped' + isActive = false
    │
    └── 반복 할일:
        └── pungDelay 경과 후 → 현재 인스턴스 skip + 다음 인스턴스 자동생성
            (기존 skipTodoInstance 로직 활용: memos.svelte.ts:1113-1149)
```

#### 3.3.3 코드 통합 지점

`isOverdue()` 함수를 확장하여 pung 체크를 함께 수행:

```typescript
// src/lib/utils/todo.ts
export function checkOverdueStatus(memo: Memo): {
  isOverdue: boolean;
  overdueDays: number;
  shouldPung: boolean;    // pung 실행 필요 여부
  pungType: 'delete' | 'next-instance' | null;
} {
  const overdue = isOverdue(memo);
  if (!overdue) return { isOverdue: false, overdueDays: 0, shouldPung: false, pungType: null };

  const days = getOverdueDays(memo);
  const shouldPung = memo.autoPung === true && isOverdue(memo);
  // pungDelay 체크도 여기서
  const pungType = shouldPung
    ? (memo.recurrence ? 'next-instance' : 'delete')
    : null;

  return { isOverdue: true, overdueDays: days, shouldPung, pungType };
}
```

### 3.4 구현 계획

#### Task 3-1: 데이터 모델 추가
- **파일**: `src/lib/types/memo.ts`
- `autoPung?: boolean`, `pungDelay?: number` 추가

#### Task 3-2: DB 마이그레이션
- **파일**: `data/migrations/009_todo_urls.sql` (위 마이그레이션에 통합)
```sql
ALTER TABLE ma_memos ADD COLUMN auto_pung BOOLEAN DEFAULT false;
ALTER TABLE ma_memos ADD COLUMN pung_delay INTEGER DEFAULT 0;
```

#### Task 3-3: Pung 실행 로직 구현
- **파일**: `src/lib/stores/memos.svelte.ts`
- `executePung(memoId)` 함수 추가:
  - 비반복: `update(id, { todoStatus: 'skipped', isActive: false })`
  - 반복: 기존 `skipTodoInstance()` 활용 → 자동으로 다음 인스턴스 생성

#### Task 3-4: Pung 스케줄러 (체크 타이밍) — ✅ 결정: 2단계 접근

기존 알림 인프라(`pg_cron` + `send-notifications` Edge Function)와 동일한 패턴 활용.

**1단계 (MVP): 앱 접속 시 체크**
- 앱 진입(onMount) 시 overdue + autoPung 할일 일괄 체크
- `recoverAllMissingInstances()`와 유사한 패턴으로 `executePendingPungs()` 실행
- 장점: 추가 인프라 불필요, 즉시 구현 가능

**2단계: Supabase pg_cron + Edge Function**
- 기존 `send-notifications` Edge Function에 pung 로직 추가 또는 별도 `execute-pung` 함수 생성
- `pg_cron`에서 1분~5분 간격으로 호출
- DB 직접 조회: `SELECT * FROM ma_memos WHERE auto_pung = true AND todo_status = 'pending' AND due_date + pung_delay < NOW()`
- 장점: 앱이 꺼져 있어도 동작, 알림과 동일한 안정적 인프라

#### Task 3-5: TodoForm에 펑 설정 UI 추가
- **파일**: `src/lib/components/todo/TodoForm.svelte`
- 기한 설정 영역 아래에 토글: "기한 초과 시 자동 삭제 (펑)"
- 토글 ON 시 pungDelay 선택: 즉시 / 1시간 / 1일 / 3일

#### Task 3-6: TodoCard overdue 영역에 펑 표시 통합
- **파일**: `src/lib/components/todo/TodoCard.svelte`
- 기존 overdue 배지 (`line 193-200`) 확장:
  - `autoPung = false`: 기존 `! N일 지남` (빨간색)
  - `autoPung = true`: `💥 N일 후 삭제` 또는 `💥 펑 예정` (주황색 or 빨간색)

#### Task 3-7: 스토어 필드 변환 추가
- `autoPung` ↔ `auto_pung`, `pungDelay` ↔ `pung_delay`

### 3.5 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/types/memo.ts` | `autoPung`, `pungDelay` 추가 |
| `data/migrations/009_todo_urls.sql` | 컬럼 추가 |
| `src/lib/utils/todo.ts` | `checkOverdueStatus()` 통합 함수 |
| `memos.svelte.ts` | `executePung()`, 스케줄러, 필드 변환 |
| `TodoForm.svelte` | 펑 설정 토글 |
| `TodoCard.svelte` | overdue+pung 통합 표시 |

---

## 4. 구현 순서 (의존 관계)

```
Phase A: 데이터 모델 + 마이그레이션
  ├── Task 2-1: TodoUrl 타입 정의
  ├── Task 3-1: autoPung/pungDelay 타입 정의
  └── Task 2-2 + 3-2: DB 마이그레이션 (통합 009)

Phase B: 스토어 + 비즈니스 로직
  ├── Task 2-5: 필드 변환 (todoUrls)
  ├── Task 3-7: 필드 변환 (autoPung, pungDelay)
  ├── Task 3-3: executePung() 구현
  └── Task 3-4a: Pung 체크 — 앱 접속 시 (1단계 MVP)

Phase D: 서버 인프라 (2단계)
  └── Task 3-4b: Pung 체크 — Supabase pg_cron + Edge Function

Phase C: UI 구현
  ├── Task 1-1: MemoDetailModal 전환 버튼
  ├── Task 1-2: TodoCard 전환 기능
  ├── Task 1-3: 전환 확인 다이얼로그
  ├── Task 2-3: TodoForm URL 입력 UI
  ├── Task 2-4: TodoCard 클립 아이콘
  ├── Task 3-5: TodoForm 펑 설정 UI
  └── Task 3-6: TodoCard overdue+pung 통합 표시
```

---

## 5. 결정 사항 (확정)

| # | 항목 | 결정 | 비고 |
|---|------|------|------|
| 1 | 펑 실행 타이밍 | **2단계 접근**: 1차 앱 접속 시 체크 → 2차 Supabase cron | 기존 `pg_cron` + Edge Function 인프라 활용 |
| 2 | 펑 후 데이터 처리 | **B) 비활성화** (isActive=false) | 복구 가능 |
| 3 | pungDelay 기본값 | **0** (즉시) | — |
| 4 | 메모→할일 전환 위치 | **A) 상세보기 footer** | — |
| 5 | TodoUrl.label 필수 여부 | **선택** | 빈 값이면 도메인 표시 |
