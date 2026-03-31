# 메모→할일 전환 시 기본값 불일치 수정

> 작성일: 2026-03-31
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/3 (0%)
> 요약: convertMemoToTodo()에 todoPriority와 todoTiming 기본값이 누락되어 신규 할일 생성과 불일치. 2개 필드 추가로 해결.

---

## 개요

메모→할일 전환(`convertMemoToTodo`) 시 `todoPriority`와 `todoTiming`이 설정되지 않아 `undefined`로 남는 버그.
신규 할일 생성(TodoForm.svelte)에서는 각각 `'medium'`과 `TodoTiming` 객체가 설정되므로 불일치 발생.

### 불일치 상세

| 필드 | 신규 할일 (TodoForm:45,290-299) | 전환 (memos.svelte.ts:1133-1138) |
|------|-------------------------------|----------------------------------|
| `todoPriority` | `'medium'` | **undefined** |
| `todoTiming` | `{useGlobalRemind:true, remindTimes:[], useGlobalAutoAlert:true, alertTimes:[], showOverdue:true}` | **undefined** |

### 영향

- 전환된 할일에 우선순위 표시 없음
- todoTiming이 없어 알림 스케줄링에서 글로벌 설정이 적용되지 않을 수 있음
- DB 마이그레이션(007)이 서버 동기화 시 todoTiming을 채우지만 로컬 상태에는 즉시 반영 안 됨

## 기술적 고려사항

- TodoForm에서 편집 시 `memo?.todoTiming?.useGlobalRemind ?? true`로 fallback하므로 편집 UI에서는 문제 없음
- 하지만 알림 스케줄링 등 todoTiming 객체 존재를 전제하는 로직에서 문제 가능
- `dueDate`, `dueTime`은 사용자 입력 필드이므로 기본값 설정 불필요 (신규 할일도 빈 값 허용)

---

## TODO

### Phase 1: 기본값 추가

1. - [ ] **convertMemoToTodo에 누락 필드 추가**
   - [ ] `src/lib/stores/memos.svelte.ts`: `convertMemoToTodo()` 함수(line 1133-1138)의 update 호출에 `todoPriority: 'medium'` 추가
   - [ ] `src/lib/stores/memos.svelte.ts`: 같은 update 호출에 `todoTiming` 기본 객체 추가 (`{useGlobalRemind: true, remindTimes: [], useGlobalAutoAlert: true, alertTimes: [], showOverdue: true}`)

### Phase 2: 검증

2. - [ ] **빌드 및 동작 확인**
   - [ ] `npm run build` 성공 확인

---

*상태: 초안 | 진행률: 0/3 (0%)*
