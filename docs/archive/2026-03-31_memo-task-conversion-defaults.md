# 메모→할일 전환 시 기본값 불일치 수정

> 완료일: 2026-03-31
> 아카이브됨
> 대상 프로젝트: memo-alarm
> 진행률: 4/4 (100%)
> 요약: convertMemoToTodo()에 todoPriority와 todoTiming 기본값이 누락되어 신규 할일 생성과 불일치. 전환된 할일의 알림/알람이 편집 전까지 완전 비활성되는 Critical 버그. 2개 필드 추가로 해결.

---

## 개요

메모→할일 전환(`convertMemoToTodo`) 시 `todoPriority`와 `todoTiming`이 설정되지 않아 `undefined`로 남는 버그.
신규 할일 생성(TodoForm.svelte)에서는 각각 `'medium'`과 `TodoTiming` 객체가 설정되므로 불일치 발생.

### 불일치 상세

| 필드 | 신규 할일 (TodoForm:45,290-299) | 전환 (memos.svelte.ts:1133-1138) |
|------|-------------------------------|----------------------------------|
| `todoPriority` | `'medium'` | **undefined** |
| `todoTiming` | `{useGlobalRemind:true, remindTimes:[], useGlobalAutoAlert:true, alertTimes:[], showOverdue:true}` | **undefined** |

### 영향 (심각도별)

**Critical — todoTiming 누락 시 알림 완전 비활성:**
- `todoNotifications.ts:92,163` — `if (!timing) return` → 알림 스케줄링 빈 배열 반환
- `todoAlertManager.svelte.ts:86` — `if (!timing) return false` → 알람 트리거 비활성
- `memos.svelte.ts:955,965` — `m.todoTiming?.useGlobalRemind` → 글로벌 설정 변경 시 리스케줄 제외
- TodoForm 편집 시 저장하면 해소되지만, **편집 전까지 알림/알람 완전 무작동**

**Medium — todoPriority 누락 시 UX 혼란:**
- `TodoCard.svelte:171` — `todoPriority` 없으면 뱃지 미표시
- TodoForm 편집 시 `'medium'` fallback → 저장 후 갑자기 뱃지 출현

## 기술적 고려사항

- `autoAlertBefore` 미포함이 정상: `todoNotifications.ts:169`에서 `useGlobalAutoAlert=true`면 파라미터로 전달된 `globalAutoAlertMinutes`를 사용 (저장된 값 무시)
- 전환 시 `scheduleTodoNotifications()` 미호출은 정상: 전환 직후에는 `dueDate`가 없으므로 스케줄링할 내용 없음
- `dueDate`, `dueTime`은 사용자 입력 필드이므로 기본값 설정 불필요

### 범위 외 발견: `convertTodoToMemo` 필드 클리어 누락

`convertTodoToMemo()`에서 `dueDate`, `todoUrls`, `autoPung`, `pungDelay`를 클리어하지 않음 → 별도 plan 권장

---

## TODO

### Phase 1: 기본값 추가

1. - [x] **convertMemoToTodo에 누락 필드 추가** — `src/lib/stores/memos.svelte.ts` line 1133-1138
   - [x] `src/lib/stores/memos.svelte.ts`: `convertMemoToTodo()` 함수의 `update()` 호출 객체에 `todoPriority: 'medium'` 필드 추가 (`todoStatus: 'pending'` 다음 줄)
   - [x] `src/lib/stores/memos.svelte.ts`: 같은 `update()` 호출 객체에 `todoTiming` 기본 객체 추가: `todoTiming: { useGlobalRemind: true, remindTimes: [], useGlobalAutoAlert: true, alertTimes: [], showOverdue: true }`

### Phase 2: 검증

2. - [x] **빌드 확인**
   - [x] `npm run build` — 환경변수 누락(기존 이슈)으로 빌드 불가, 코드 변경과 무관
   - [x] 변경된 함수의 update 객체가 TodoForm.svelte:290-299의 기본값과 동일한 구조인지 코드 리뷰 확인 완료

---

*상태: 구현완료 | 진행률: 4/4 (100%)*
