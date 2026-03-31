# 북마크 전환 버그 수정 — 메모→할일 전환 시 북마크 소실 방지

> 완료일: 2026-03-31
> 아카이브됨
> 대상 프로젝트: memo-alarm
> 진행률: 14/14 (100%)
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

1. - [x] **convertMemoToTodo에 북마크 필드 추가** — race condition 방지
   - [x] `src/lib/stores/memos.svelte.ts:1133-1136`: `update()` 호출의 객체에 `isPinned: memo.isPinned, isFavorite: memo.isFavorite` 2줄 추가. before: `{ memoType: 'todo', todoStatus: 'pending' }` → after: `{ memoType: 'todo', todoStatus: 'pending', isPinned: memo.isPinned, isFavorite: memo.isFavorite }`

2. - [x] **convertTodoToMemo에 북마크 필드 추가** — 대칭성 보장
   - [x] `src/lib/stores/memos.svelte.ts:1153-1164`: `update()` 호출의 객체에 `isPinned: todo.isPinned, isFavorite: todo.isFavorite` 2줄 추가. 기존 `memoType: 'note'` 등과 함께 전달

### Phase R: 재발 경로 분석 (fix: plan 필수)

3. - [x] **수정 대상의 모든 호출/참조 경로 열거**
   - [x] Grep으로 `convertMemoToTodo`/`convertTodoToMemo` 호출처 검색 (현재 3곳: `MemoDetailModal.svelte:146`, `MemoForm.svelte:266`, `TodoForm.svelte:396`)
   - [x] 각 호출 경로별 "이 경로에서 동일 버그가 발생할 수 있는가?" 판정
   - [x] 방어됨/미방어 증명을 표로 작성 (경로 | 방어여부 | 근거)

4. - [x] **미방어 경로 수정**
   - [x] 미방어 경로가 있으면 해당 경로에 방어 코드 추가
   - [x] 모든 경로 방어 완료 확인 — **전체 방어 완료**: 3곳 모두 store 함수(`convertMemoToTodo`/`convertTodoToMemo`) 경유, Phase 1 수정으로 일괄 커버됨

### Phase 2: TodoCard 북마크 인디케이터 추가

5. - [x] **TodoCard에 Pin/Star import 추가**
   - [x] `src/lib/components/todo/TodoCard.svelte:2`: lucide-svelte import 변경. before: `import { Calendar, Repeat, ChevronDown, ChevronUp, Paperclip } from "lucide-svelte"` → after: `import { Calendar, Repeat, ChevronDown, ChevronUp, Paperclip, Pin, Star } from "lucide-svelte"`

6. - [x] **TodoCard에 핀 배지 표시** — MemoCard:111-114 패턴 복제
   - [x] `src/lib/components/todo/TodoCard.svelte:112`: `<div class="flex items-start gap-3">` 직전(line 112과 113 사이)에 핀 배지 블록 삽입: `{#if todo.isPinned}<div class="absolute -top-2 -right-2 w-7 h-7 bg-secondary rounded-full flex items-center justify-center shadow-md z-10"><Pin class="w-3.5 h-3.5 text-white fill-white" /></div>{/if}`
   - [x] `src/lib/components/todo/TodoCard.svelte:106`: 카드 root div의 class 문자열 끝에 `{todo.isPinned ? 'memo-card-pinned' : ''}` 조건부 클래스 추가

7. - [x] **TodoCard에 즐겨찾기 별 표시** — MemoCard:158-159 패턴 참고
   - [x] `src/lib/components/todo/TodoCard.svelte:159-168`: Priority Badge 영역(`{#if todo.todoPriority ...}`) 직전에 `{#if todo.isFavorite}<Star class="w-4 h-4 text-warning fill-warning flex-shrink-0" />{/if}` 삽입

### Phase 3: 빌드 검증

8. - [x] **타입 체크 및 빌드 확인**
   - [x] `npm run build` 에러 없이 성공 확인 — .env 미설정으로 full build 불가, svelte-check로 변경 파일 타입 에러 없음 확인

9. - [x] **시나리오 검증 체크리스트** (수동) (→ MANUAL_TASKS)
   - [x] 메모에 핀 추가 → 할일 전환 → TodoCard에 핀 배지 표시 (→ MANUAL_TASKS)
   - [x] 메모에 즐겨찾기 추가 → 할일 전환 → TodoCard에 별 아이콘 표시 (→ MANUAL_TASKS)
   - [x] 핀 추가된 할일 → 메모 전환 → MemoCard에 핀 유지 (→ MANUAL_TASKS)
   - [x] 북마크 필터에서 전환된 할일 표시 확인 (→ MANUAL_TASKS)

---

*상태: 구현완료 | 진행률: 14/14 (100%)*
