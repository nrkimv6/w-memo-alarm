# 메모 수정 시 null.id TypeError 수정

> 작성일: 2026-03-10
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/7 (0%)
> 요약: MemoForm.svelte에서 handleClose()가 Svelte 5 반응성으로 memo prop을 즉시 null로 만들어 memo.id 접근 시 TypeError 발생. handleSubmit + handleConvertToTodo 두 곳 수정.

---

## 개요

### 버그 1: 메모 수정 시 null.id TypeError

`MemoForm.svelte:handleSubmit()`에서 `handleClose()`를 먼저 호출하면, 부모의 `onClose` 콜백이 `editingMemo = null`을 설정한다. Svelte 5의 동기적 반응성으로 `memo` prop이 즉시 `null`이 되어, 이후 `memo.id` 접근 시 `Cannot read properties of null (reading 'id')` 에러 발생.

**에러 위치**: `MemoForm.svelte:227` — `memosStore.update(memo.id, data)`

### 버그 2: 할일 변환 시 동일 null 에러

`handleConvertToTodo()`가 `handleSubmit()`을 호출(내부에서 `handleClose()` 실행) 후 `memo.id`에 접근하여 동일 에러 발생. 또한 `handleClose()`가 중복 호출됨.

### 전수검사 결과

`MemoDetailModal.svelte`, `MemoCard.svelte`, `ScheduledRemindersModal.svelte`, `+page.svelte` 등 전체 스캔 완료. `memo.reminder` 접근은 모두 `{#if memo.reminder?.enabled}` 블록 내부에서 사용되어 안전함. 추가 크래시 버그 없음.

## 기술적 고려사항

- Svelte 5에서 `$props()` 바인딩은 부모 상태 변경 시 즉시 반영됨
- `handleClose()` → `onClose()` → 부모의 `editingMemo = null` → `memo` prop = `null` (동기적)
- 수정 방법: `handleClose()` 호출 전에 필요한 값을 로컬 변수에 캡처

---

## TODO

### Phase 1: handleSubmit 수정

1. - [ ] **handleSubmit에서 memo.id를 handleClose 전에 로컬 변수로 캡처**
   - [ ] `src/lib/components/memo/MemoForm.svelte:222`: `const isEdit = !!memo;` 바로 아래에 `const memoId = memo?.id;` 추가
   - [ ] `src/lib/components/memo/MemoForm.svelte:227`: `memosStore.update(memo.id, data)` → `memosStore.update(memoId!, data)` 변경

### Phase 2: handleConvertToTodo 수정

2. - [ ] **handleConvertToTodo에서 memo.id 사전 캡처 + 중복 handleClose 제거**
   - [ ] `src/lib/components/memo/MemoForm.svelte:257`: `if (!memo) return;` 아래에 `const memoId = memo.id;` 추가
   - [ ] `src/lib/components/memo/MemoForm.svelte:263`: `memosStore.convertMemoToTodo(memo.id)` → `memosStore.convertMemoToTodo(memoId)` 변경
   - [ ] `src/lib/components/memo/MemoForm.svelte:265`: `handleClose();` 삭제 (handleSubmit 내부에서 이미 호출됨)

### Phase 3: 빌드 검증

3. - [ ] **빌드 확인** — `npm run build` 성공 확인
   - [ ] `memo-alarm` 디렉토리에서 `npm run build` 실행, 에러 없음 확인

---

*상태: 초안 | 진행률: 0/7 (0%)*
