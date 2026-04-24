# 북마크 필터에서 할일 카드 렌더링 개선

> 작성일: 2026-03-30
> 기준커밋: b900531
> 대상 프로젝트: memo-alarm
> 상태: 머지대기
> branch: impl/bookmark-filter-todo-card
> worktree: .worktrees/impl-bookmark-filter-todo-card
> worktree-owner: codex
> 진행률: 6/6 (100%)
> 요약: 북마크 필터 선택 시 todo가 MemoCard로 렌더링되어 기한/상태 등 할일 정보가 누락되는 문제 수정
> 출처: /reflect에서 자동 생성

---

## 개요

`북마크 가시성 & 필터` 구현으로 `filter === 'bookmarked'` 시 todo가 메모 페이지에 표시됨.
그러나 `src/routes/memos/+page.svelte:274-286`에서 모든 항목을 `<MemoCard>`로 렌더링하므로,
북마크된 todo의 `dueDate`, `todoStatus`, `todoPriority` 등 할일 고유 정보가 표시되지 않음.

### 영향 범위
- `filter === 'bookmarked'` (또는 `'pinned'`, `'favorites'`)에서 `memoType === 'todo'`인 항목

## 기술적 고려사항

- `src/routes/todos/+page.svelte`에 `TodoCard`(또는 해당하는 컴포넌트) 존재 여부 확인 필요
- 메모 페이지의 카드 렌더링 부분에서 `memo.memoType === 'todo'`이면 다른 카드로 분기하거나,
  MemoCard 내부에서 todo 필드(기한, 상태 배지)를 표시하는 방식으로 해결 가능

---

## TODO

### Phase 1: 현황 파악

1. - [x] **TodoCard/할일 카드 컴포넌트 확인**
   - [x] `src/routes/todos/+page.svelte`: 할일 목록에서 사용하는 카드 컴포넌트 이름 확인
   - [x] `src/lib/components/todo/` 또는 `src/lib/components/memo/`: TodoCard 컴포넌트 존재 여부 확인

### Phase 2: 메모 페이지 카드 렌더링 분기

2. - [x] **북마크 필터에서 todo 렌더링 분기 추가**
   - [x] `src/routes/memos/+page.svelte:274-286`: `{#each filteredMemos as memo}` 내부에서 `memo.memoType === 'todo'`이면 TodoCard, 아니면 MemoCard로 분기 렌더링
   - [x] `src/routes/memos/+page.svelte`: TodoCard import 추가

### Phase 3: 빌드 검증

3. - [x] **빌드 확인**
   - [x] `npm run build` 타입 에러 없이 성공

---

*상태: 머지대기 | 진행률: 6/6 (100%)*
