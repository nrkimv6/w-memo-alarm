# 할일→메모 전환 시 할일 전용 필드 클리어 누락 수정

> ⚠️ **SUPERSEDED by [2026-04-07_fix-bookmark-disappear-recurrence.md](../plan/2026-04-07_fix-bookmark-disappear-recurrence.md)**
> cleanup 필드만 추가했으나 `memoToSupabase()`가 `undefined`를 스킵하여 DB에 실제 적용되지 않음. 04-07 plan에서 매퍼 수정 + cleanup을 함께 처리.
>
> 작성일: 2026-03-31
> 대상 프로젝트: memo-alarm
> 상태: superseded
> 진행률: 0/3 (0%)
> 요약: convertTodoToMemo()에서 dueDate, todoUrls, autoPung, pungDelay를 클리어하지 않아 메모로 전환 후에도 할일 전용 데이터가 잔존. /review에서 자동 생성.
> 출처: /review에서 자동 생성

---

## 개요

`convertTodoToMemo()` (`src/lib/stores/memos.svelte.ts:1158-1176`)에서 할일→메모 전환 시 일부 할일 전용 필드를 `undefined`로 클리어하지 않음.

### 누락 필드

| 필드 | 용도 | 영향 |
|------|------|------|
| `dueDate` | 할일 기한 날짜 | 메모에 orphan 기한 데이터 잔존 |
| `todoUrls` | 할일 전용 URL 목록 | 메모에 불필요한 데이터 잔존 |
| `autoPung` | 자동 퐁 설정 | `autoPung=true`인 메모가 자동완료 로직에 포함될 위험 |
| `pungDelay` | 퐁 지연 시간 | autoPung과 함께 잔존 |

### autoPung 잔존 위험

`memos.svelte.ts:1058,1100-1103`에서 autoPung 로직:
```
if (!memo || memo.memoType !== 'todo' || !memo.autoPung)
```
`memoType !== 'todo'` 가드가 있으므로 즉시 위험은 아니나, 데이터 정합성 관점에서 클리어 필요.

## 기술적 고려사항

- 기존 클리어 패턴(`todoStatus`, `todoPriority`, `dueTime` 등)과 동일하게 `undefined` 설정
- `dueDate`를 클리어하면 메모 상태에서는 기한 표시 없음 (정상)

---

## TODO

### Phase 1: 필드 클리어 추가

1. - [ ] **convertTodoToMemo에 누락 필드 클리어 추가** — `src/lib/stores/memos.svelte.ts` line 1163-1175
   - [ ] `src/lib/stores/memos.svelte.ts`: `convertTodoToMemo()` 함수의 `update()` 호출에 `dueDate: undefined` 추가
   - [ ] `src/lib/stores/memos.svelte.ts`: 같은 `update()` 호출에 `todoUrls: undefined`, `autoPung: undefined`, `pungDelay: undefined` 추가

### Phase 2: 검증

2. - [ ] **빌드 확인**
   - [ ] `npm run build` — 타입 에러 없이 성공 확인 (또는 환경 이슈만 확인)

---

*상태: 초안 | 진행률: 0/3 (0%)*
