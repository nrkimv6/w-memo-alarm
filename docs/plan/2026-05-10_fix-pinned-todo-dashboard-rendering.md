# fix: 고정/즐겨찾기 할일 대시보드 카드 렌더링 수정

> 작성일시: 2026-05-10 22:59
> 기준커밋: 600265d
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 8/8 (100%)
> 요약: 메모를 할일로 전환할 때 데이터는 복제되지 않지만, 고정/즐겨찾기 대시보드 섹션에서 할일이 메모 카드로 렌더링되어 복제처럼 보이는 문제를 수정한다. 고정된 메모와 고정된 할일은 같은 북마크 섹션에 남기되 카드 UI를 타입에 맞게 분기한다.

---

## 개요

고정된 메모를 할일로 전환하면 `convertMemoToTodo()`는 기존 `ma_memos` row를 `UPDATE`로 변경한다. 즉, 전환 자체는 새 할일 row를 생성하는 복제 동작이 아니다.

문제는 홈 대시보드의 고정/즐겨찾기 섹션이 `memoType === 'todo'` 항목도 항상 `MemoCard`로 렌더링한다는 점이다. 전환된 할일이 오늘의 할일 섹션과 고정된 메모 섹션에 동시에 노출되고, 고정 섹션에서는 메모 카드처럼 보이기 때문에 사용자가 “전환이 아니라 복제”로 인식할 수 있다.

해결 방향은 고정/즐겨찾기 상태를 유지하면서, 해당 섹션 안에서 할일 항목은 `TodoCard`로 렌더링하는 것이다.

## 기술적 고려사항

- `convertMemoToTodo()`는 `insert` 없이 `update()`만 호출하므로 DB 트랜잭션 추가가 직접 해결책은 아니다.
- 고정/즐겨찾기 할일을 섹션에서 제외하면 사용자가 기대한 북마크 유지 동작이 깨진다.
- `/memos` 북마크 필터는 이미 todo를 `TodoCard`로 렌더링하는 패턴이 있으므로 홈 대시보드도 같은 방식으로 맞춘다.
- `TodoCard`의 `onEdit`는 기존 메모 상세 모달 열기 흐름과 연결해 현재 대시보드 동작을 유지한다.

---

## TODO

### Phase 1: 원인 확인

1. [x] **전환 로직 확인** — 데이터 복제 여부 판정
   - [x] `src/lib/stores/memos.svelte.ts`: `convertMemoToTodo()`가 `insert`가 아닌 기존 row `update()`를 호출하는지 확인한다.
   - [x] `src/lib/stores/memos.svelte.ts`: `isPinned`, `isFavorite`이 전환 후에도 유지되는지 확인한다.

2. [x] **대시보드 표시 경로 확인** — 복제처럼 보이는 UI 원인 판정
   - [x] `src/routes/+page.svelte`: `pinnedMemos`, `favoriteMemos`가 todo를 포함하는지 확인한다.
   - [x] `src/lib/components/dashboard/PinnedMemosSection.svelte`: 모든 항목을 `MemoCard`로 렌더링하는지 확인한다.
   - [x] `src/lib/components/dashboard/FavoriteMemosSection.svelte`: 모든 항목을 `MemoCard`로 렌더링하는지 확인한다.

### Phase 2: 렌더링 분기 수정

3. [x] **고정 섹션 타입별 카드 렌더링** — 고정된 할일은 할일 UI로 표시
   - [x] `src/lib/components/dashboard/PinnedMemosSection.svelte`: `TodoCard`를 import한다.
   - [x] `src/lib/components/dashboard/PinnedMemosSection.svelte`: `memo.memoType === 'todo'`이면 `TodoCard`, 그 외에는 `MemoCard`를 렌더링한다.

4. [x] **즐겨찾기 섹션 타입별 카드 렌더링** — 즐겨찾기 할일도 할일 UI로 표시
   - [x] `src/lib/components/dashboard/FavoriteMemosSection.svelte`: `TodoCard`를 import한다.
   - [x] `src/lib/components/dashboard/FavoriteMemosSection.svelte`: `memo.memoType === 'todo'`이면 `TodoCard`, 그 외에는 `MemoCard`를 렌더링한다.

### Phase 3: 검증

5. [x] **정적 검증** — Svelte 타입/진단 확인
   - [x] `package.json`: `npm run check`를 실행해 새 에러가 없는지 확인한다.
   - [x] `src/lib/components/dashboard/PinnedMemosSection.svelte`: 새 import와 prop 연결이 Svelte 진단을 통과하는지 확인한다.
   - [x] `src/lib/components/dashboard/FavoriteMemosSection.svelte`: 새 import와 prop 연결이 Svelte 진단을 통과하는지 확인한다.

---

## 검증 결과

- `npm run check`: 에러 0개, 기존 경고 57개.

---

*상태: 구현완료 | 진행률: 8/8 (100%)*
