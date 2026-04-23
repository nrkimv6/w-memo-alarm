# 메모→할일 전환 시 URL이 할일 UI에서 사라지는 이슈 수정

> 작성일시: 2026-04-24 00:39
> 기준커밋: 931c414
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/21 (0%)
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

### 관련 선행 plan / archive

- `docs/plan/2026-04-07_fix-bookmark-disappear-recurrence.md` (구현완료): `isPinned`/`isFavorite` 보존 및 race condition 수정. 본 plan과 수정 파일이 겹치지만(`convertMemoToTodo`/`convertTodoToMemo`) URL 필드는 다루지 않았다. `memoToSupabase`의 `undefined → null` 동작 규약은 선행 plan에서 확정된 전제.
- `docs/archive/2026-03-31_fix-bookmark-conversion-bug.md` (완료): `isPinned`/`isFavorite` 보존을 위한 명시 전달 패턴 도입. 본 plan은 동일 함수의 `url`/`todoUrls` 필드에 같은 패턴(명시 전달)을 적용한다.
- `docs/archive/2026-01-24_url-sharing-feature.md`, `docs/archive/2026-02-10_fix-memo-share-url-null.md`: 메모 공유 URL 관련. 본 plan과 다른 도메인(공유 vs 마이그레이션) — 0-hit 충돌.

### 의도된 결과

- 메모→할일 전환 시 기존 `memo.url`이 할일 UI의 `todoUrls`로 자동 이전되어 사용자가 URL을 계속 볼 수 있다.
- 할일→메모 역전환 시 `todoUrls[0]`이 `memo.url`로 복원되어 "양방향 URL 보존"이 성립한다.
- 할일→메모 경고 다이얼로그가 "할일 전용 URL 목록(첫 번째 제외)이 삭제된다"를 명시한다.

## 기술적 고려사항

- `memoToSupabase`(`src/lib/services/memoMapper.ts:101`): `key in memoRecord` + `val === undefined → null`. changes 객체에 키를 **안 넣으면** 스킵, **`undefined`로 명시하면** DB에 null 전송. 본 plan은 양쪽 동작을 모두 사용한다.
- `TodoUrl` 인터페이스(`src/lib/types/memo.ts:108`): `{ id, url, label?, addedAt }`. `id`는 `crypto.randomUUID()` 또는 `nanoid` 사용 (기존 TodoForm.svelte가 이미 사용하는 방식 확인 후 동일 채택).
- `convertMemoToTodo`(`src/lib/stores/memos.svelte.ts:1188`): 현재 `url` 키 없음 → 마이그레이션 후에도 DB의 기존 `url` 컬럼이 남으면 안 된다. `url` 이전 시 `url: undefined` 명시하여 DB에서 삭제해야 할일 UI의 `todoUrls`와 중복 소스가 되지 않는다.
- `convertTodoToMemo`(`src/lib/stores/memos.svelte.ts:1217`): 기존에 `todoUrls: undefined`로 전체 삭제. `todoUrls[0].url`이 있으면 `url`에 복원한 뒤 `todoUrls: undefined`로 삭제. 메모가 이미 `memo.url`을 가진 경우의 우선순위는 **기존 `memo.url` 보존 우선** (덮어쓰지 않음).
- `TodoForm.svelte:381` 경고 문구 수정 시 2단계 스프레드(`...(memo || {}), ...`) 패턴으로 `url` 필드는 이미 자연 보존됨. 본 plan의 Phase 2 마이그레이션 로직이 들어가면 `url`은 `convertTodoToMemo`에서 복원 경로가 생기므로 TodoForm 저장 경로와 충돌하지 않는다(TodoForm은 `convert*` 호출 전 `handleSubmit`으로 먼저 저장).
- 메모→할일 경로에서 `memo.url`이 빈 문자열(`""`)인 레거시 행이 있을 수 있으므로 `if (memo.url && memo.url.trim())`로 가드.
- 경합 가드: `convertMemoToTodo`는 이미 `update()` 한 번으로 처리됨. `url`과 `todoUrls`를 같은 `update()` 호출 안에 넣어 원자적으로 전송한다.
- 반대 방향도 동일. 두 필드를 별도 `update()`로 분리하지 않는다.
- 메모→할일 진입 경로 전수: `convertMemoToTodo` 호출자는 `MemoForm.svelte:266`, `MemoDetailModal.svelte:145` 두 곳뿐이며 둘 다 동일 함수를 호출하므로 Phase 1 수정만으로 모든 진입 경로가 커버된다(별도 분기 불필요). 신규 할일 작성 경로(`TodoForm.svelte:347`의 `memoType: "todo"` 저장)는 메모 → 할일 "전환"이 아니라 신규 생성이므로 마이그레이션 대상 아님.
- 할일→메모 진입 경로: `convertTodoToMemo` 호출자는 `TodoForm.svelte:396` 한 곳. Phase 2/3 수정으로 커버.

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

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯을 유지한다
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: blank `> branch:`, `> worktree:`, `> worktree-owner:`는 신규 초기 상태이며 다른 `impl/*` 잔여와 무관하다고 적는다
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `worktree 생성 또는 재개`가 `/implement` 또는 `plan-runner` owner flow임을 적는다
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `worktree cwd 고정` 확인을 별도 하위 작업으로 적는다

### Phase 1: `convertMemoToTodo`에서 `url` → `todoUrls` 마이그레이션

1. - [ ] **`memo.url` 존재 시 `todoUrls` 항목으로 이전하고 `url` 필드 삭제** — 메모→할일 진입 경로의 UI 누락 해소
   - [ ] `src/lib/stores/memos.svelte.ts`: `convertMemoToTodo`(약 1188줄) 내부에서 `const hasUrl = typeof memo.url === 'string' && memo.url.trim().length > 0;` 가드 추가
   - [ ] `src/lib/stores/memos.svelte.ts`: `hasUrl && (memo.todoUrls === undefined || memo.todoUrls.length === 0)`일 때만 `migratedTodoUrls = [{ id: crypto.randomUUID(), url: memo.url!, addedAt: Date.now() }]`로 생성 (기존 `todoUrls` 있으면 덮어쓰지 않음)
   - [ ] `src/lib/stores/memos.svelte.ts`: `update()`에 넘기는 changes 객체에 `hasUrl`일 때 `url: undefined`와 `todoUrls: migratedTodoUrls` 두 키를 **함께** 포함 (원자적 전송)
   - [ ] `src/lib/stores/memos.svelte.ts`: `hasUrl === false`일 때는 `url`/`todoUrls` 둘 다 changes에서 생략 (기존 동작 유지, DB 스킵)
   - [ ] `src/lib/stores/memos.svelte.ts`: UUID 생성 방식은 기존 코드 컨벤션과 동일하게 맞춘다 (`TodoForm.svelte:169` 주변 또는 기존 `todoUrls` 생성부를 Grep으로 확인 후 통일)

2. - [ ] **성공 토스트 메시지에 마이그레이션 사실 포함(선택)** — 사용자가 URL이 이전된 것을 인지
   - [ ] `src/lib/stores/memos.svelte.ts`: `hasUrl`일 때 `toastStore.success('할일로 전환되었습니다 (URL 이전)')` 등으로 분기 또는 기존 메시지 유지 중 택1. 기존 메시지 유지도 허용(과도한 노이즈 방지)

### Phase 2: `convertTodoToMemo`에서 `todoUrls[0]` → `url` 역마이그레이션

3. - [ ] **기존 `memo.url`이 없고 `todoUrls`가 있을 때만 첫 항목을 `url`로 복원** — 양방향 URL 보존
   - [ ] `src/lib/stores/memos.svelte.ts`: `convertTodoToMemo`(약 1217줄) 내부에서 현재 todo의 `url`(기존 값)과 `todoUrls`를 읽어 결정
   - [ ] `src/lib/stores/memos.svelte.ts`: `const existingUrl = typeof todo.url === 'string' && todo.url.trim().length > 0;` — 기존 `url`이 이미 있으면 우선하여 **덮어쓰지 않음**
   - [ ] `src/lib/stores/memos.svelte.ts`: `const firstTodoUrl = todo.todoUrls?.[0]?.url?.trim();` — 후보
   - [ ] `src/lib/stores/memos.svelte.ts`: `!existingUrl && firstTodoUrl`일 때 changes에 `url: firstTodoUrl`을 추가 (기존 `url` 있으면 생략)
   - [ ] `src/lib/stores/memos.svelte.ts`: 기존 `todoUrls: undefined` 삭제 동작은 유지 (단일 `url` 필드로 통합)
   - [ ] `src/lib/stores/memos.svelte.ts`: 두 필드 변경을 하나의 `update()` 호출 내 changes로 통합 — 원자성 유지

4. - [ ] **`todoUrls.length > 1`인 경우 2번째 이후 URL 삭제에 대한 경고 책임은 Phase 3 다이얼로그로 위임** — 경고 주체 분리
   - [ ] `src/lib/stores/memos.svelte.ts`: `convertTodoToMemo` 자체는 조용히 첫 항목만 `url`로 승격, 나머지 `todoUrls`는 `undefined`로 삭제 (경고는 호출자 책임)

### Phase 3: 할일→메모 경고 다이얼로그에 URL 삭제 경고 보강

5. - [ ] **`TodoForm.svelte`의 `handleConvertToMemo` 다이얼로그에 URL 경고 추가** — 실제 데이터 소실 케이스 사용자 고지
   - [ ] `src/lib/components/todo/TodoForm.svelte` (약 381~390줄): 현재 확인 문구에 `todoUrls.length >= 2`일 때 "URL 목록 중 첫 번째를 제외한 N개 URL이 삭제됩니다." 조건부 문장 추가
   - [ ] `src/lib/components/todo/TodoForm.svelte`: `todoUrls.length === 1` 또는 0이면 URL 문구 생략 (기존 메시지 그대로)
   - [ ] `src/lib/components/todo/TodoForm.svelte`: 기존 "기한, 우선순위, 반복 설정 등 할일 전용 정보가 삭제됩니다." 경고 문구는 유지

### Phase 4: 렌더링 경로 재확인 (회귀 방지)

6. - [ ] **할일 UI가 마이그레이션 후 `todoUrls`를 올바르게 표시하는지 코드 레벨 확인** — UI 누락 재발 방지
   - [ ] `src/lib/components/todo/TodoCard.svelte` (약 204~210줄): `todo.todoUrls && todo.todoUrls.length > 0` 렌더 조건 그대로 동작하는지 확인 (수정 없음, 읽기만)
   - [ ] `src/lib/components/todo/TodoForm.svelte` (약 109줄): `let todoUrls = $state<TodoUrl[]>(memo?.todoUrls || []);` 초기화가 마이그레이션된 값 수신 확인 (수정 없음, 읽기만)

7. - [ ] **메모 UI가 역마이그레이션 후 `memo.url`을 올바르게 표시하는지 확인** — 역방향 누락 재발 방지
   - [ ] `src/lib/components/memo/MemoCard.svelte` (약 138, 221줄): `{#if memo.url}` 렌더링 정상 동작 확인 (수정 없음, 읽기만)
   - [ ] `src/lib/components/memo/MemoDetailModal.svelte` (약 267줄): `memo.url` 표시 경로 확인 (수정 없음, 읽기만)

### Phase R: 재발 경로 분석 (fix: plan 필수)

8. - [ ] **수정 대상의 모든 호출/참조 경로 열거** — 누락 진입 경로 차단
   - [ ] Grep `convertMemoToTodo` 전수 검색 → 호출자 목록 확정 (예상: `MemoForm.svelte:266`, `MemoDetailModal.svelte:145` 2개)
   - [ ] Grep `convertTodoToMemo` 전수 검색 → 호출자 목록 확정 (예상: `TodoForm.svelte:396` 1개)
   - [ ] Grep `memoType:\s*['"]todo['"]` 전수 검색 → 메모→할일 전환 우회 경로 점검 (예상: `memos.svelte.ts:1193`(본 plan 수정 대상), `TodoForm.svelte:347`(신규 생성 경로 — 마이그레이션 대상 아님)). 우회 경로가 신규로 발견되면 본 Phase에 추가 마이그레이션 작업 삽입
   - [ ] Grep `memoType:\s*['"]note['"]` 전수 검색 → 할일→메모 전환 우회 경로 점검 (예상: `memos.svelte.ts:1223`(본 plan 수정 대상)). 우회 경로가 신규로 발견되면 본 Phase에 추가 작업 삽입
   - [ ] 결과를 표로 작성 (경로 | 마이그레이션 적용 여부 | 근거) — plan의 "기술적 고려사항" 섹션에 추가

9. - [ ] **미방어 경로 수정** — 전체 방어 완료 증명
   - [ ] Phase R 1단계 표에서 "미적용"으로 표기된 경로가 있으면 해당 경로에 마이그레이션 코드 추가 (Phase 1/2와 동일 패턴)
   - [ ] 모든 경로 방어 완료 확인 ("전체 방어 완료" 명시, "근본 수정" 표현 금지)

### Phase 5: 수동 검증 시나리오

10. - [ ] **시나리오 S1: 북마크 메모(`url` only, `todoUrls` 없음) → 할일 전환** — 마이그레이션 정상
    - [ ] 메모 생성 시 URL 입력 → 할일로 전환 → TodoCard에 링크 아이콘 표시, TodoForm 열어 URL 섹션에 해당 URL 표시 확인
    - [ ] Supabase `ma_memos` 행 확인: `url IS NULL`, `todo_urls` 길이 1 (마이그레이션 완료)

11. - [ ] **시나리오 S2: `url` 없는 일반 메모 → 할일 전환** — 기존 동작 회귀 없음
    - [ ] URL 없는 메모를 할일로 전환 → 에러 없이 전환, TodoCard에 링크 아이콘 없음
    - [ ] DB에서 `url`/`todo_urls` 모두 null/빈 배열 확인

12. - [ ] **시나리오 S3: 할일(`todoUrls` 1개) → 메모 전환** — 역마이그레이션 정상
    - [ ] 할일에 URL 1개 등록 → 메모로 전환 → MemoCard에서 `memo.url` 표시 확인
    - [ ] DB 행 확인: `url` 설정됨, `todo_urls IS NULL`

13. - [ ] **시나리오 S4: 할일(`todoUrls` 2개 이상) → 메모 전환** — 경고+부분 소실 확인
    - [ ] 할일에 URL 2개 이상 등록 → 메모 전환 시 경고 다이얼로그에 "N개 URL이 삭제됩니다" 문구 노출 확인
    - [ ] 확인 후 메모 전환 시 첫 번째 URL만 `memo.url`로 복원, 나머지 소실 확인 (의도된 동작)

14. - [ ] **시나리오 S5: 메모→할일→메모 왕복** — 양방향 동기화 확인
    - [ ] `url` 있는 메모 → 할일 전환 → 다시 메모 전환 → 원래 URL 그대로 `memo.url`에 복원 확인

15. - [ ] **시나리오 S6: 기존 할일(`url` 필드 잔존, `todoUrls` 비어있음) → 메모 전환** — 레거시 데이터 처리
    - [ ] Phase 1 마이그레이션 이전 생성된 할일(DB에 `url` 있고 `todo_urls` null)이 있는 경우를 수동으로 seed → 메모 전환 시 `url` 그대로 유지 확인 (덮어쓰기 없음)

16. - [ ] **시나리오 S7: race condition 재검증** — 선행 plan(2026-04-07)의 per-memo 큐가 본 plan 변경으로 깨지지 않음 확인
    - [ ] 북마크 메모 상세 모달에서 "할일로" 버튼 클릭 시 PGRST116 없이 1회 update로 완료되는지 콘솔에서 확인

### Phase 6: 문서/CHANGELOG 반영

17. - [ ] **CHANGELOG에 변경 기록** — 사용자 공지
    - [ ] `CHANGELOG.md`: Unreleased 섹션에 "fix: 메모→할일 전환 시 북마크 URL이 할일 UI에서 사라지던 문제 수정 (양방향 URL 마이그레이션)" 추가

18. - [ ] **PRD/요구사항 업데이트 여부 확인** — 정책 변경 반영
    - [ ] `docs/PRD.md` 또는 관련 문서: "메모 ↔ 할일 전환 시 URL 보존 정책"이 이미 기재돼 있으면 수정, 없으면 생략

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `main merge 시도`를 owner step으로 적는다
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `root dirty stash/apply (if needed)`를 owner step으로 적는다
   - [ ] `docs/plan/2026-04-24_fix-memo-to-todo-url-ui-hide.md`: `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`를 분리해 적는다

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

*상태: 검토완료 | 진행률: 0/21 (0%)*
