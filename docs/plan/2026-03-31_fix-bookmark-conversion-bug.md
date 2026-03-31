# 북마크 전환 버그 수정 — 메모→할일 전환 시 북마크 소실 방지

> 작성일: 2026-03-31
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/7 (0%)
> 요약: 메모에 북마크(isPinned/isFavorite)를 추가하고 할일로 전환하면 북마크가 사라지는 버그 수정. Race condition으로 인한 데이터 소실 방지 + TodoCard에 북마크 인디케이터 추가

---

## 개요

메모에 북마크(핀/즐겨찾기)를 추가한 뒤 할일로 전환하면 북마크가 사라지는 문제.

### 원인 1: Race Condition에 의한 데이터 소실

`togglePin()`/`toggleFavorite()`는 fire-and-forget(await 없음, `memos.svelte.ts:670-681`).
사용자가 북마크 추가 직후 할일 전환 시:

1. `togglePin` → `update(id, { isPinned: true })` 시작 (await 없음), version=N으로 서버 전송
2. `convertMemoToTodo` → `update(id, { memoType: 'todo', todoStatus: 'pending' })`, 동일 version=N으로 서버 전송
3. 전환 update가 먼저 서버에 도달 → version N+1로 증가, `is_pinned`은 건드리지 않음(여전히 false)
4. 북마크 update가 뒤늦게 도달 → version=N 불일치 → PGRST116 에러 → `fetchFromSupabase()` 호출
5. 서버 상태(`is_pinned=false`, `memo_type='todo'`)로 로컬 덮어씀 → **북마크 소실**

### 원인 2: TodoCard에 북마크 인디케이터 없음

`TodoCard.svelte`에 Pin/Star 아이콘이 없어, 전환 후 데이터가 보존되더라도 사용자가 확인 불가.

## 기술적 고려사항

- DDL 변경 불필요 — DB 스키마(`is_pinned BOOLEAN DEFAULT FALSE`, `is_favorite BOOLEAN DEFAULT FALSE`)는 정상
- `memoToSupabase()`는 전달된 필드만 Supabase UPDATE에 포함하므로, 명시적으로 전달하지 않으면 서버에 보내지 않음
- `convertMemoToTodo`에서 `getById()`로 읽는 memo는 optimistic update가 반영된 로컬 상태이므로, `memo.isPinned`을 명시 전달하면 race condition에서도 올바른 값이 서버에 도달
- `convertTodoToMemo`도 대칭적으로 동일 문제 존재

---

## TODO

### Phase 1: convertMemoToTodo/convertTodoToMemo 북마크 명시 전달

1. - [ ] **convertMemoToTodo에 북마크 필드 추가** — race condition 방지
   - [ ] `src/lib/stores/memos.svelte.ts:1133-1136`: `update()` 호출에 `isPinned: memo.isPinned, isFavorite: memo.isFavorite` 추가

2. - [ ] **convertTodoToMemo에 북마크 필드 추가** — 대칭성 보장
   - [ ] `src/lib/stores/memos.svelte.ts:1153-1164`: `update()` 호출에 `isPinned: todo.isPinned, isFavorite: todo.isFavorite` 추가

### Phase 2: TodoCard 북마크 인디케이터 추가

3. - [ ] **TodoCard에 Pin/Star import 추가**
   - [ ] `src/lib/components/todo/TodoCard.svelte:2`: lucide-svelte import에 `Pin`, `Star` 추가

4. - [ ] **TodoCard에 핀 배지 표시** — MemoCard:111-114 패턴 참고
   - [ ] `src/lib/components/todo/TodoCard.svelte`: 카드 root `<div>` 직후에 `{#if todo.isPinned}` 핀 배지 추가 (absolute position, -top-2 -right-2)
   - [ ] `src/lib/components/todo/TodoCard.svelte:106`: 카드 root div class에 `todo.isPinned ? 'memo-card-pinned' : ''` 조건 추가

5. - [ ] **TodoCard에 즐겨찾기 별 표시** — MemoCard:158-159 패턴 참고
   - [ ] `src/lib/components/todo/TodoCard.svelte`: title 영역(`h3` 부근)에 `{#if todo.isFavorite}` Star 아이콘 추가

### Phase 3: 빌드 검증

6. - [ ] **타입 체크 및 빌드 확인**
   - [ ] `npm run build` 에러 없이 성공 확인

7. - [ ] **시나리오 검증 체크리스트** (수동)
   - [ ] 메모에 핀 추가 → 할일 전환 → TodoCard에 핀 배지 표시
   - [ ] 메모에 즐겨찾기 추가 → 할일 전환 → TodoCard에 별 아이콘 표시
   - [ ] 핀 추가된 할일 → 메모 전환 → MemoCard에 핀 유지
   - [ ] 북마크 필터에서 전환된 할일 표시 확인

---

*상태: 초안 | 진행률: 0/7 (0%)*
