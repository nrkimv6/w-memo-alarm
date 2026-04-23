# 메모→할일 전환 시 URL이 할일 UI에서 사라지는 이슈 수정

> 작성일시: 2026-04-24 00:39
> 기준커밋: 931c414
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/20 (0%)
> 요약: 메모→할일 전환 시 기존 `memo.url`(북마크 URL)이 할일 UI(TodoCard/TodoForm)에서 표시되지 않아 "URL이 사라진 것처럼" 보인다 — `convertMemoToTodo`에서 `url`을 `todoUrls`로 자동 마이그레이션하고, 역방향 `convertTodoToMemo`에서 `todoUrls[0]`을 `url`로 복원한다. 함께 할일→메모 경고 다이얼로그에도 URL 삭제 경고를 추가한다.

---

## 개요

### 배경

사용자 보고: "메모를 할일로 바꾸면 URL이 사라진다." 코드 확인 결과 **DB의 `url` 컬럼은 보존**되지만 할일 UI가 `memo.url` 필드를 무시하고 `todoUrls` 배열만 렌더링하기 때문에 체감 상 사라진 것처럼 보인다. 그리고 반대 방향(할일→메모)에서는 현재 코드가 `todoUrls: undefined`를 명시 전송하여 `memoToSupabase` 매퍼가 DB의 `todo_urls`를 `null`로 덮어쓰는 실제 데이터 소실이 발생하며, 경고 다이얼로그에도 이 사실이 빠져 있다.

### 분석 결론

| 케이스 | DB | 로컬 memos 배열 | UI 표시 | 사용자 체감 |
|--------|-----|---------------|---------|-----------|
| 메모→할일 `convertMemoToTodo` | `url` 보존 (changes에 key 없음 → 매퍼 스킵) | `{...originalMemo, ...changes}` → 보존 | TodoCard/TodoForm은 `todoUrls`만 참조 → `memo.url` 미표시 | **"URL 소멸"로 보임** |
| 할일에서 TodoForm 편집 저장 | `...(memo || {})` spread → `url` 보존 | 보존 | 여전히 안 보임 | 소멸 유지 |
| 할일→메모 `convertTodoToMemo` | `url` 그대로, `todoUrls: undefined` → **null로 덮어씀** | `url` 유지, `todoUrls` 제거 | 메모 UI에서 `url` 재노출 | `url`은 복원, `todoUrls`는 **실제 삭제** |

- 메모→할일 방향: **데이터 소실 아님**, UI 렌더링 누락 (UX 결함).
- 할일→메모 방향: `todoUrls`에 대한 **실제 데이터 소실**. 경고 다이얼로그에도 URL 언급 없음.

### 관련 선행 plan

- `docs/plan/2026-04-07_fix-bookmark-disappear-recurrence.md` (구현완료): `isPinned`/`isFavorite` 보존 및 race condition 수정. 본 plan과 수정 파일이 겹치지만(`convertMemoToTodo`/`convertTodoToMemo`) URL 필드는 다루지 않았다. `memoToSupabase`의 `undefined → null` 동작 규약은 선행 plan에서 확정된 전제.

### 의도된 결과

- 메모→할일 전환 시 기존 `memo.url`이 할일 UI의 `todoUrls`로 자동 이전되어 사용자가 URL을 계속 볼 수 있다.
- 할일→메모 역전환 시 `todoUrls[0]`이 `memo.url`로 복원되어 "양방향 URL 보존"이 성립한다.
- 할일→메모 경고 다이얼로그가 "할일 전용 URL 목록(첫 번째 제외)이 삭제된다"를 명시한다.

## 기술적 고려사항

- `memoToSupabase`(`src/lib/services/memoMapper.ts:101`): `key in memoRecord` + `val === undefined → null`. changes 객체에 키를 **안 넣으면** 스킵, **`undefined`로 명시하면** DB에 null 전송. 본 plan은 양쪽 동작을 모두 사용한다.
- `TodoUrl` 인터페이스(`src/lib/types/memo.ts:109`): `{ id, url, label?, addedAt }`. `id`는 opaque string이면 충분하며, 현재 `TodoForm.svelte:154-170`은 로컬 `generateId()`(`entry-${Date.now()}-...`)를, `src/lib/utils/index.ts:8-10`은 공용 `generateId() = crypto.randomUUID()`를 사용한다. 본 plan은 store 경로에서 한 가지 생성 방식만 고정하면 되며, prefix 형식에 의존하는 코드는 없다.
- `convertMemoToTodo`(`src/lib/stores/memos.svelte.ts:1188`): 현재 `url` 키 없음 → 마이그레이션 후에도 DB의 기존 `url` 컬럼이 남으면 안 된다. `url` 이전 시 `url: undefined` 명시하여 DB에서 삭제해야 할일 UI의 `todoUrls`와 중복 소스가 되지 않는다.
- `convertTodoToMemo`(`src/lib/stores/memos.svelte.ts:1217`): 기존에 `todoUrls: undefined`로 전체 삭제. `todoUrls[0].url`이 있으면 `url`에 복원한 뒤 `todoUrls: undefined`로 삭제. 메모가 이미 `memo.url`을 가진 경우의 우선순위는 **기존 `memo.url` 보존 우선** (덮어쓰지 않음).
- `TodoForm.svelte:381` 경고 문구 수정 시 2단계 스프레드(`...(memo || {}), ...`) 패턴으로 `url` 필드는 이미 자연 보존됨. 본 plan의 Phase 2 마이그레이션 로직이 들어가면 `url`은 `convertTodoToMemo`에서 복원 경로가 생기므로 TodoForm 저장 경로와 충돌하지 않는다(TodoForm은 `convert*` 호출 전 `handleSubmit`으로 먼저 저장).
- `TodoForm.svelte:381-396`: 확인 다이얼로그 이후 `handleSubmit()`이 현재 폼 상태의 `todoUrls`를 먼저 저장한 뒤 `convertTodoToMemo()`를 호출한다. 따라서 URL 삭제 경고 문구와 수동 검증 시나리오는 `memo.todoUrls` 스냅샷이 아니라 **현재 폼 상태(`todoUrls`) 기준**으로 작성해야 한다.
- 메모→할일 경로에서 `memo.url`이 빈 문자열(`""`)인 레거시 행이 있을 수 있으므로 `if (memo.url && memo.url.trim())`로 가드.
- 경합 가드: `convertMemoToTodo`는 이미 `update()` 한 번으로 처리됨. `url`과 `todoUrls`를 같은 `update()` 호출 안에 넣어 원자적으로 전송한다.
- 반대 방향도 동일. 두 필드를 별도 `update()`로 분리하지 않는다.
- `git diff --name-only 931c414..HEAD -- src/lib/stores/memos.svelte.ts src/lib/components/todo/TodoForm.svelte src/lib/components/todo/TodoCard.svelte src/lib/components/memo/MemoCard.svelte src/lib/components/memo/MemoDetailModal.svelte src/lib/services/memoMapper.ts` 결과 0건으로, 기준커밋 이후 main 드리프트는 본 plan의 핵심 수정 파일 범위에 없다.

### 대안 검토

| 대안 | 기각/채택 | 사유 |
|------|----------|------|
| A. 할일 UI에서 `memo.url`도 함께 표시 | 기각 | 같은 의미의 필드 2개를 UI에서 병렬 표시 → 사용자 혼란, 편집 진입점 이원화. |
| B. `convertMemoToTodo`에서 `url` → `todoUrls`로 이전 + `url: undefined` | **채택** | 데이터 소스 단일화, 기존 할일 편집 UI(`TodoForm` URL 입력) 그대로 사용 가능. |
| C. 마이그레이션 없이 할일 상태에서 `url`을 숨기기만 | 기각 | 역전환해야만 URL이 다시 보여 "왜 할일에선 안 보이지?" UX 혼란 지속. |

[기각 대안 잔여 위험 검증] A 기각의 경우 "UI에 두 URL 경로가 보이는 문제"는 B로 완전 해소됨(`memo.url`이 할일 상태에선 항상 `undefined`). C 기각의 경우 "할일 상태에서 URL 편집 불가"는 B가 `todoUrls`로 이전하여 `TodoForm`의 URL 입력 UI로 해결.

---

## TODO

### Phase 0: Worktree 준비

1. - [ ] **worktree 메타 슬롯과 owner 책임을 문서에 고정** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: 헤더의 `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 그대로 유지한다.
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`가 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다.
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: worktree 생성 또는 재개가 `/implement` 또는 `plan-runner` owner flow라고 적는다.
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: worktree `cwd` 고정 확인을 별도 하위 작업으로 유지한다.

### Phase 1: `convertMemoToTodo`에서 `url` → `todoUrls` 마이그레이션

2. - [ ] **`convertMemoToTodo()`에 URL 존재 가드와 마이그레이션 payload를 추가** — 메모→할일 UI 누락 해소
   - [ ] `src/lib/stores/memos.svelte.ts:1188-1204`: `convertMemoToTodo()` 초반에 `const hasUrl = typeof memo.url === 'string' && memo.url.trim().length > 0;` 가드를 추가한다.
   - [ ] `src/lib/stores/memos.svelte.ts:1188-1204`: `const migratedTodoUrls = hasUrl && (!memo.todoUrls || memo.todoUrls.length === 0) ? [...] : undefined;` 형태로 이전 후보 배열 생성 분기를 추가한다.
   - [ ] `src/lib/stores/memos.svelte.ts:1188-1204`: `update()` changes 객체에 `hasUrl`일 때만 `url: undefined`와 `todoUrls: migratedTodoUrls ?? memo.todoUrls`를 함께 넣어 단일 호출로 전송한다.
   - [ ] `src/lib/stores/memos.svelte.ts:1188-1204`: `hasUrl === false`일 때는 `url`/`todoUrls` 키를 changes 객체에서 생략해 기존 DB skip 동작을 유지한다.

3. - [ ] **마이그레이션용 `TodoUrl.id` 생성 방식을 store 경로에서 하나로 고정** — 형식 혼선 제거
   - [ ] `src/lib/stores/memos.svelte.ts`: migration entry 생성 시 `crypto.randomUUID()` 또는 `$lib/utils`의 공용 `generateId()` 중 하나를 선택해 단일 방식으로 명시한다.
   - [ ] `src/lib/types/memo.ts:109-113`: `TodoUrl.id`가 opaque string이며 prefix parsing이 없음을 근거로, TodoForm의 기존 `entry-*` 형식과 혼용돼도 기능상 문제 없다는 점을 plan 비고에 남긴다.
   - [ ] `src/lib/stores/memos.svelte.ts`: 성공 토스트는 기존 `"할일로 전환되었습니다"` 유지 또는 URL 이전 문구 분기 중 하나만 선택하고, 선택 근거(노이즈 vs 가시성)를 TODO 하위 항목에 기록한다.

### Phase 2: `convertTodoToMemo`에서 `todoUrls[0]` → `url` 역마이그레이션

4. - [ ] **`convertTodoToMemo()`에 기존 `url` 우선 복원 로직을 추가** — 양방향 URL 보존
   - [ ] `src/lib/stores/memos.svelte.ts:1217-1241`: `const existingUrl = typeof todo.url === 'string' && todo.url.trim().length > 0;` 계산을 추가한다.
   - [ ] `src/lib/stores/memos.svelte.ts:1217-1241`: `const firstTodoUrl = todo.todoUrls?.[0]?.url?.trim();` 계산을 추가한다.
   - [ ] `src/lib/stores/memos.svelte.ts:1217-1241`: `!existingUrl && firstTodoUrl`일 때만 changes 객체에 `url: firstTodoUrl`를 넣고, 기존 `url`이 있으면 생략한다.
   - [ ] `src/lib/stores/memos.svelte.ts:1217-1241`: `todoUrls: undefined`를 포함한 todo 전용 필드 정리를 같은 `update()` 호출 안에 유지한다.

5. - [ ] **다중 URL 소실 경고의 책임을 호출자 다이얼로그로 분리 유지** — store는 데이터 변환만 담당
   - [ ] `src/lib/stores/memos.svelte.ts:1217-1241`: `convertTodoToMemo()` 자체는 첫 번째 URL 승격과 `todoUrls` 제거만 수행하고 사용자 경고 문자열은 추가하지 않는다.
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `todoUrls.length > 1` 삭제 경고는 Phase 3 `TodoForm.svelte` 다이얼로그 책임이라고 명시한다.

### Phase 3: 할일→메모 경고 다이얼로그에 URL 삭제 경고 보강

6. - [ ] **`TodoForm.svelte` 확인 다이얼로그를 현재 폼 상태 기준으로 확장** — 실제 소실 케이스 사용자 고지
   - [ ] `src/lib/components/todo/TodoForm.svelte:381-396`: 기존 경고 문구를 유지하되 `todoUrls.length >= 2`일 때 `"URL 목록 중 첫 번째를 제외한 N개 URL이 삭제됩니다."` 문장을 조건부로 덧붙인다.
   - [ ] `src/lib/components/todo/TodoForm.svelte:381-396`: `todoUrls.length === 0` 또는 `1`이면 URL 삭제 문구를 생략해 기존 메시지와 동일하게 유지한다.
   - [ ] `src/lib/components/todo/TodoForm.svelte:381-396`: 경고에 사용하는 개수는 `memo?.todoUrls`가 아니라 현재 폼 state `todoUrls` 기준으로 계산한다.
   - [ ] `src/lib/components/todo/TodoForm.svelte:347-396`: `handleSubmit()` 선호출 후 `convertTodoToMemo()`가 이어지는 현재 순서를 유지하고, 문구 추가만으로 저장/전환 제어 흐름을 바꾸지 않는다.

### Phase 4: 렌더링 경로 재확인 (회귀 방지)

7. - [ ] **할일 UI의 표시 소스가 `todoUrls` 하나로 유지되는지 재확인** — note/bookmark와 소스 분리 유지
   - [ ] `src/lib/components/todo/TodoCard.svelte:204-210`: `todo.todoUrls && todo.todoUrls.length > 0` 조건이 마이그레이션 후 그대로 링크 아이콘을 노출하는지 확인한다.
   - [ ] `src/lib/components/todo/TodoForm.svelte:109,1084-1108`: `let todoUrls = $state<TodoUrl[]>(memo?.todoUrls || [])` 초기화와 URL 목록 렌더링이 migration 결과를 그대로 받는지 확인한다.
   - [ ] `src/lib/components/todo/TodoForm.svelte:347-356`: 저장 payload가 `todoUrls: todoUrls.length > 0 ? todoUrls : undefined`를 유지해 새 source-of-truth를 계속 사용함을 확인한다.

8. - [ ] **메모 UI의 표시 소스가 `memo.url`로 정상 복귀하는지 재확인** — 역방향 누락 방지
   - [ ] `src/lib/components/memo/MemoCard.svelte:138-145,221-238`: compact/normal 두 경로 모두 `{#if memo.url}` 렌더링이 복원된 `url`을 그대로 사용함을 확인한다.
   - [ ] `src/lib/components/memo/MemoDetailModal.svelte:267-284`: 상세 모달 URL 카드가 `memo.url` 복원만으로 별도 수정 없이 동작함을 확인한다.
   - [ ] `src/lib/components/memo/MemoForm.svelte:125-127,266`: 메모 수정 폼과 메모→할일 재전환 경로가 복원된 `memo.url`을 기존대로 읽는지 확인한다.

### Phase R: 재발 경로 분석 (fix: plan 필수)

9. - [ ] **수정 대상 호출/참조 경로를 전수 열거하고 방어 범위를 표로 남긴다**
   - [ ] `src/` 전체에서 `convertMemoToTodo`, `convertTodoToMemo`, `memo.url`, `todoUrls`를 Grep해 호출 파일과 렌더 파일을 분류한다.
   - [ ] `src/lib/components/memo/MemoDetailModal.svelte`, `src/lib/components/memo/MemoForm.svelte`, `src/lib/components/todo/TodoForm.svelte`를 호출 경로 표에 넣고 store-level migration으로 동일 버그가 방어되는지 판정한다.
   - [ ] `src/lib/components/memo/MemoCard.svelte`, `src/lib/components/memo/MemoDetailModal.svelte`, `src/lib/components/todo/TodoCard.svelte`, `src/lib/components/todo/TodoForm.svelte`를 표시 경로 표에 넣고 각 경로의 source field(`memo.url` vs `todoUrls`)를 근거와 함께 기록한다.

10. - [ ] **미방어 경로가 없는지 확인하고 범위 밖 소비자는 기술적 고려사항으로 격리한다**
   - [ ] `src/lib/utils/share.ts`, `src/lib/utils/qrcode.ts`, `src/lib/stores/notifications.svelte.ts`, `src/lib/utils/ai.ts`, `src/lib/utils/capacitor.ts`의 `memo.url` 소비가 note/bookmark 전용인지 확인하고, todo URL 미지원이 기존 모델과 동일한지 판단을 기록한다.
   - [ ] `src/` 전체에서 `todoUrls?.[0]`, `memo.url` fallback 렌더링, `todo.todoUrls` 외 URL 표기 경로를 재검색해 0-hit 또는 보정 필요를 기록한다.
   - [ ] 모든 경로가 방어됨 또는 범위 제외로 정리되면 `"전체 방어 완료"` 문구와 함께 근거 표를 남긴다.

### Phase 5: 수동 검증 시나리오

11. - [ ] **시나리오 S1: 북마크 메모(`url` only, `todoUrls` 없음) → 할일 전환** — 마이그레이션 정상
   - [ ] URL이 있는 메모를 생성한 뒤 할일로 전환해 `TodoCard` 링크 아이콘과 `TodoForm` URL 섹션에 동일 URL이 보이는지 확인한다.
   - [ ] Supabase `ma_memos` 행에서 `url IS NULL`이고 `todo_urls` 길이가 1인지 확인한다.

12. - [ ] **시나리오 S2: `url` 없는 일반 메모 → 할일 전환** — 기존 동작 회귀 없음
   - [ ] URL 없는 메모를 할일로 전환해 오류 없이 완료되고 `TodoCard`에 링크 아이콘이 생기지 않는지 확인한다.
   - [ ] 같은 행에서 `url`이 null이며 `todo_urls`가 비어 있는지 확인한다.

13. - [ ] **시나리오 S3: 할일(`todoUrls` 1개) → 메모 전환** — 역마이그레이션 정상
   - [ ] URL 1개를 가진 할일을 메모로 전환해 `MemoCard`와 `MemoDetailModal`에 `memo.url`이 표시되는지 확인한다.
   - [ ] Supabase 행에서 `url`이 채워지고 `todo_urls IS NULL`인지 확인한다.

14. - [ ] **시나리오 S4: 할일(`todoUrls` 2개 이상) → 메모 전환** — 경고+부분 소실 확인
   - [ ] URL 2개 이상을 가진 할일에서 메모 전환 다이얼로그를 열어 `"N개 URL이 삭제됩니다"` 문구가 현재 폼 상태 기준으로 노출되는지 확인한다.
   - [ ] 전환 후 첫 번째 URL만 `memo.url`에 복원되고 나머지 `todoUrls`는 제거되는지 확인한다.

15. - [ ] **시나리오 S5: 메모→할일→메모 왕복** — 양방향 동기화 확인
   - [ ] `url`이 있는 메모를 할일로 전환했다가 다시 메모로 전환해 원래 URL이 `memo.url`에 그대로 복원되는지 확인한다.
   - [ ] 왕복 후 `TodoCard` 경로와 `MemoCard` 경로가 각각 한 번씩만 URL을 표시하는지 확인한다.

16. - [ ] **시나리오 S6: 기존 할일(`url` 필드 잔존, `todoUrls` 비어있음) → 메모 전환** — 레거시 데이터 처리
   - [ ] Phase 1 이전에 생성된 레거시 할일(`url`만 있고 `todo_urls`는 null)을 seed한 뒤 메모로 전환해 기존 `url`이 덮어써지지 않는지 확인한다.
   - [ ] 레거시 케이스에서도 `todo_urls` 제거와 `memo.url` 유지가 같은 `update()` 호출로 끝나는지 네트워크/로그로 확인한다.

17. - [ ] **시나리오 S7: race condition 재검증** — 2026-04-07 선행 fix와 충돌하지 않음 확인
   - [ ] 북마크 메모 상세 모달에서 `"할일로"` 버튼을 눌렀을 때 PGRST116 없이 1회 `update()`로 완료되는지 콘솔에서 확인한다.
   - [ ] `TodoForm`에서 URL을 수정한 직후 메모 전환을 눌렀을 때 저장→전환 순서가 유지되고 URL 복원이 깨지지 않는지 확인한다.

### Phase 6: 문서/CHANGELOG 반영

18. - [ ] **CHANGELOG 반영 여부를 확정한다** — 사용자 공지
   - [ ] `CHANGELOG.md`: 현재 릴리스 포맷(`## [x.y.z]`)에 맞춰 이번 수정이 들어갈 섹션을 정하고, `"메모→할일 전환 시 북마크 URL이 할일 UI에서 사라지던 문제 수정"` 문구를 추가할지 결정한다.
   - [ ] `CHANGELOG.md`: 실제 반영을 선택하면 note→todo와 todo→note 양방향 URL 마이그레이션이라는 핵심 범위를 한 줄로 요약한다.

19. - [ ] **PRD/요구사항 문서 반영 필요성을 판단한다** — 정책 변경 vs 구현 상세 구분
   - [ ] `docs/PRD.md`: "메모 ↔ 할일 전환 시 URL 보존 정책"이 이미 있으면 해당 문장을 양방향 기준으로 보정한다.
   - [ ] `docs/PRD.md`: 관련 정책 문장이 없으면 구현 상세만 바뀐 것으로 보고 PRD 미수정 근거를 plan 비고에 남긴다.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

20. - [ ] **post-merge owner 정리 단계를 분리 유지한다** — `/merge-test` owner
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `main merge 시도`를 owner step으로 유지한다.
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `root dirty stash/apply (if needed)`를 owner step으로 유지한다.
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 각각 분리된 하위 작업으로 유지한다.

> 예외 경로: `merge resolve`, `stash pop`, `stash-pop resolve`는 정상 체크박스로 만들지 않고 충돌/복원 실패 시 메모로만 남긴다.
> T4/T5 해당 없음: 이 프로젝트는 pytest 대상이 아닌 SvelteKit + Capacitor 프런트엔드이며 vitest/플레이라이트 자동화가 아직 설정돼 있지 않다. 검증은 Phase 5의 수동 시나리오로 수행한다.

---

## 🔴 백엔드/Python 변경 시 — SKILL.md `pytest 강제 Phase 규칙` 적용

> 해당 없음: 본 plan은 SvelteKit + Svelte 5 + TypeScript 프런트엔드 변경이며 Python 코드를 건드리지 않는다. 검증은 Phase 5의 수동 시나리오 + `npm run check` (svelte-check) 타입 검증으로 대체한다.

---

## 검증 (프런트엔드 타입 체크)

### 빌드/타입 확인

```powershell
cd "D:\work\project\service\wtools\memo-alarm"
npm run check
```

- 기대 결과: svelte-check 에러/경고 0건

### 검증 기준

- [ ] `npm run check` 에러 0건
- [ ] Phase 5의 시나리오 S1~S7 전부 통과
- [ ] Supabase DB 행에서 `url` / `todo_urls` 컬럼 상태가 의도대로 전환됨
- [ ] 선행 plan(2026-04-07)의 race condition 가드가 회귀하지 않음

---

*상태: 검토완료 | 진행률: 0/20 (0%)*
