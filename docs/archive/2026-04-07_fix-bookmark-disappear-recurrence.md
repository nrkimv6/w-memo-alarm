# 메모↔할일 전환 시 북마크 소실 재발 이슈 수정

> 작성일: 2026-04-07
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 반영일시: 2026-04-07
> 머지커밋: 465aa01
> 진행률: 6/18 (33%) — Phase 6 수동 시나리오 검증 별도 실행 필요
> 요약: af881d4 수정 후에도 재발하는 북마크 "소실" 이슈의 진짜 원인은 fire-and-forget update의 race condition과 `undefined`가 DB에 전송되지 않는 매퍼 동작. is_pinned/is_favorite 컬럼은 보존되지만 전환 자체가 롤백되어 사용자에게 "사라진 것처럼" 보임.

---

## 개요

### 배경

`af881d4` (Fix bookmark loss when converting memo to todo)에서 `convertMemoToTodo`/`convertTodoToMemo`가 `isPinned`/`isFavorite`를 명시 전달하도록 수정했다. 그러나 사용자 보고로 동일 이슈 재발.

### 분석 결론

**북마크 데이터 자체는 DB에서 소실되지 않는다.** `is_pinned`/`is_favorite` 컬럼 값은 보존된다. "사라진" 북마크들의 실제 위치:

| 상황 | 데이터 위치 | 사용자 인식 |
|------|-----------|-----------|
| race condition으로 전환 롤백됨 | 메모 'all' 뷰에 원래 그대로 (note 타입) | "전환이 안 됐네?" |
| 전환 성공, 'all' 필터에서 보는 중 | /todos 페이지 또는 '북마크' 필터 탭 | "북마크가 사라졌다" |
| `fetchFromSupabase` 전체 새로고침 | DB에 정상 존재, 일시적 UI 불일치 | 깜빡임 |

### 근본 원인 3가지

**1. Fire-and-Forget Race Condition (주 원인)**
`addOpenHistory()`, `incrementOpenCount()`, `togglePin()` 등이 `update()`를 await 없이 호출. DB 트리거 `update_ma_memos_metadata()`가 version을 자동 증가시키므로 두 update가 동일 version으로 경합 → 하나는 PGRST116 실패 → `fetchFromSupabase()`가 전체 롤백 → 전환이 사라진 것처럼 보임.

**재현 시나리오**: 북마크된 메모 상세 모달 열기 (`MemoDetailModal`이 `addOpenHistory`+`incrementOpenCount` 두 번 fire-and-forget) → 모달 안에서 "할일 전환" 클릭 → 동일 version으로 3개 UPDATE 경합 → 1개 성공, 2개 PGRST116 → 전환이 롤백됨.

**2. `undefined` → DB 미전송 (`memoToSupabase`)**
`convertTodoToMemo()`가 `todoStatus: undefined` 등으로 todo 필드 정리를 시도하지만, `memoToSupabase()` 105줄의 `if (val !== undefined)` 조건 때문에 **건너뜀**. DB에 `todo_status='pending'`, `todo_priority='medium'` 등이 좀비로 잔존. 이후 realtime/fetch로 다시 읽으면 좀비 값이 로컬 상태에 복원됨.

**3. `convertTodoToMemo` 누락 필드**
`dueDate`, `todoUrls`, `autoPung`, `pungDelay` 가 cleanup 대상에서 빠져있음.

### 흡수된 선행 plan

- `docs/archive/2026-03-31_fix-todo-to-memo-field-cleanup.md` — Phase 2가 동일 cleanup. 단, 매퍼 미수정으로 실제 동작 안 함을 본 plan Phase 1로 보강.
- `docs/archive/2026-03-31_fire-and-forget-update-race.md` — Phase 4 PGRST116 재시도 동일 + Phase 3 per-memo 큐로 근본 해결 강화.

### 의도된 결과

- 메모↔할일 전환 시 race condition으로 인한 롤백 제거
- todo→메모 전환 시 todo 필드가 DB에서 실제로 정리됨
- fire-and-forget update가 후속 update와 충돌하지 않음

## 기술적 고려사항

- DB 트리거(`update_ma_memos_metadata`, `005_apply_ma_prefix_simple.sql:24-31`)는 `BEFORE UPDATE`에서 `version = OLD.version + 1` 자동 증가. 클라이언트는 이 기반으로 낙관적 동시성 제어를 함.
- `key in memoRecord` 체크로 "필드 부재"와 "명시적 undefined"를 구분해야 한다. 전자는 스킵, 후자는 `null` 전송.
- `addOpenHistory()`는 `openHistory` 필드를 저장하려 하지만 `MEMO_FIELD_MAPPINGS`에 매핑이 없고 DB 컬럼도 없음. 빈 객체 UPDATE를 보내 version만 낭비.
- Per-memo 큐 도입 시 `originalMemo`(509줄)는 `let`으로 변경 후 await 뒤 재조회 필요.
- TodoForm의 `memoData = {...(memo || {}), ...}` 패턴(342줄)은 spread로 `isPinned`/`isFavorite`를 보존하므로 별도 수정 불필요.

### Phase 1 매퍼 변경의 caller 영향 분석 (재검토)

`undefined→null` 매핑 변경은 모든 caller에 영향. 영향 분류:

| caller | 패턴 | Phase 1 후 동작 | 평가 |
|--------|------|-----------------|------|
| `TodoCard.svelte:69-72` | `completedAt: undefined` (pending 복귀) | DB `completed_at`이 NULL로 클리어 | ✅ 의도와 일치 (오히려 버그 수정) |
| `todos/+page.svelte:194-197` | undo 시 `completedAt: undefined` | NULL 클리어 | ✅ 의도와 일치 |
| `TodayTodosSection.svelte:31-34` | 토글 시 `completedAt: undefined` | NULL 클리어 | ✅ 의도와 일치 |
| `TodoForm.svelte:342-358` | `{...(memo || {}), ...}` spread | memo의 옵셔널 undefined 필드들이 NULL로 덮어써질 수 있음 | ⚠️ 검증 필요 — Phase 6 시나리오 추가 |
| `data.ts:127` (백업 import) | `update(id, memo)` 전체 객체 | import된 memo의 undefined 옵셔널 필드가 기존 DB 값을 NULL로 덮어씀 | 🔴 데이터 손실 위험 — Fix 필요 |

### Phase 4 retry의 last-write-wins 위험

기존 동작은 PGRST116 시 사용자에게 토스트로 알리고 fetch함 → 사용자가 명시적으로 last-write 결정. Phase 4 retry는 이를 자동화하여 **다른 기기/탭의 변경을 무음으로 덮어씀**. 멀티 디바이스 동기화 시 의도치 않은 데이터 손실 가능. 트레이드오프:

- **로컬 동시성 (Phase 3 큐로 해결됨)** → retry 거의 불필요
- **크로스 디바이스 동시 수정** → retry는 위험. fetch 후 사용자에게 토스트 유지가 안전

→ 결론: Phase 4의 retry는 **per-memo 큐가 처리하지 못한 동시성** (예: 동일 세션 내 한 호출이 큐에 들어가기 전 다른 호출이 끝난 직후) 에만 의미 있고, 크로스 디바이스 충돌은 기존 동작 유지가 옳음. **retry 횟수를 1회로 제한하고 토스트는 silent로** 유지.

### openHistory 기능 자체 동작 안 함 (별도 이슈)

`addOpenHistory()`가 `openHistory` 필드 저장을 시도하지만:
- `MEMO_FIELD_MAPPINGS`에 매핑 없음
- DB 마이그레이션에 `open_history` 컬럼 없음
- 결과: **현재도 저장되지 않음** (매번 빈 update만 발생, version만 낭비)

Phase 5의 빈 update 차단으로 부작용은 제거되나, 기능 자체는 죽은 코드. **별도 plan 필요** (DB 컬럼 추가 또는 기능 제거).

---

## TODO

### Phase 1: 매퍼 수정 (가장 먼저 — 다른 fix가 의존)

1. - [x] **`memoToSupabase()` undefined→null 변환** — `key in memoRecord`로 부재 vs 명시 undefined 구분
   - [ ] `src/lib/services/memoMapper.ts:101-110`: 루프를 `if (key in memoRecord)`로 감싸고, `val === undefined`이면 `result[db] = null` 전송, 그 외는 기존 `toDb` 처리. `toDb` 호출 전에 undefined 분기 처리하여 변환 함수가 undefined를 받지 않도록.

### Phase 2: convertTodoToMemo 필드 정리 보강

2. - [x] **누락된 todo 필드 cleanup 추가**
   - [ ] `src/lib/stores/memos.svelte.ts:1163-1176`: update 페이로드에 `dueDate: undefined`, `todoUrls: undefined`, `autoPung: undefined`, `pungDelay: undefined` 4개 추가. Phase 1 수정 후 자동으로 DB에 `null`로 전송됨.

### Phase 2.5: data.ts 백업 import 보호 (Phase 1 부작용 방지)

11. - [x] **import 시 undefined 필드가 기존 DB 값을 덮어쓰지 않도록 보호**
    - [ ] `src/lib/utils/data.ts:127`: `memosStore.update(memo.id, memo)` 호출 전, memo 객체의 `undefined` 키를 제거하는 헬퍼 적용. 예: `const cleaned = Object.fromEntries(Object.entries(memo).filter(([_, v]) => v !== undefined))` 후 `update(memo.id, cleaned as MemoUpdate)`.
    - [ ] 또는 `update()`에 `{importMode: true}` 옵션 추가하여 import 경로에서는 매퍼의 undefined→null 변환을 우회하도록 처리. 단순한 경로(undefined 제거)를 우선 채택.

### Phase 3: Per-memo update 큐 (race condition 근본 해결)

3. - [x] **per-memo pending 큐 자료구조 추가**
   - [x] `src/lib/stores/memos.svelte.ts`: `createMemosStore()` 상단(60-70줄 부근)에 `const pendingUpdates = new Map<string, Promise<Memo | null>>();` 선언.

4. - [x] **`update()` 함수에서 큐 대기 + 재조회 적용**
   - [x] `src/lib/stores/memos.svelte.ts:505-602`: `originalMemo` (509줄)를 `const`→`let`으로 변경.
   - [x] Supabase 호출 직전 (534줄 부근): pending 프로미스 await 후 `memos.find(m => m.id === id)`로 `originalMemo` 재바인딩.
   - [x] 535-601의 Supabase 호출 + 응답 처리를 IIFE 프로미스로 감싸 `pendingUpdates.set(id, promise)` 등록, `try/finally`로 `pendingUpdates.delete(id)`.

### Phase 4: PGRST116 단건 재시도 (안전망, 동일 세션 한정)

5. - [x] **버전 충돌 시 단건 재시도 로직 (1회 한정 + 크로스 디바이스 가드)**
   - [ ] `src/lib/stores/memos.svelte.ts:545-553`: 기존 `fetchFromSupabase()` 호출을 다음으로 교체:
     - [ ] 1) `supabase.from('ma_memos').select('version, updated_at').eq('id', id).single()` 로 최신 version + updated_at 조회
     - [ ] 2) **크로스 디바이스 가드**: `freshRow.updated_at`이 로컬 `originalMemo.updatedAt`보다 의미 있게 차이(예: 5초 이상)나면 다른 기기 변경으로 판단 → retry 스킵하고 기존 fetchFromSupabase 폴백 (last-write-wins 자동 덮어쓰기 방지)
     - [ ] 3) 동일 세션 race로 판단되면 `memoToSupabase(changes)` 재호출 + `.eq('version', freshRow.version)` 로 **단 1회만** 재시도
     - [ ] 4) 재시도 성공 시 `supabaseToMemo` 변환 + 로컬 상태 갱신 + `saveCacheToStorage` + return
     - [ ] 5) 재시도 실패 시에만 기존 `toastStore.warning` + `fetchFromSupabase()` 폴백

### Phase 5: 빈 업데이트 차단 (addOpenHistory 부작용 제거)

6. - [x] **`update()`에서 빈 updateData면 Supabase 호출 스킵**
   - [ ] `src/lib/stores/memos.svelte.ts:535` 직후: `if (Object.keys(updateData).length === 0) { return optimisticUpdate; }` 추가. `addOpenHistory`가 매핑되지 않은 `openHistory`만 보낼 때 빈 UPDATE로 version을 낭비하는 문제 차단.

### Phase 6: 빌드 검증 및 수동 시나리오 테스트

7. - [ ] **빌드 확인**
   - [ ] `npm run build` 타입 에러 없이 성공

8. - [ ] **수동 시나리오: 북마크 메모 → 할일 전환**
   - [ ] 핀 고정된 메모 상세 열기 → "할일 전환" 클릭 → 브라우저 콘솔에 PGRST116 경고 없음 확인
   - [ ] /todos 페이지에서 해당 항목이 핀 표시와 함께 노출되는지 확인
   - [ ] 메모 페이지 '북마크' 필터에서도 보이는지 확인

9. - [ ] **수동 시나리오: 북마크 할일 → 메모 전환 후 DB 검증**
   - [ ] 북마크된 todo를 메모로 전환
   - [ ] Supabase 콘솔에서 해당 row 직접 조회 → `todo_status`, `todo_priority`, `due_date`, `due_time`, `todo_timing`, `recurrence`, `todo_instances`, `postpone_info`, `todo_group_id`, `todo_urls`, `auto_pung`, `pung_delay` 모두 NULL 확인
   - [ ] `is_pinned`/`is_favorite`는 원래 값 유지 확인

10. - [ ] **수동 시나리오: race condition 회귀 방지**
    - [ ] 핀 토글 → 즉시 할일 전환 (1초 이내) → 두 변경 모두 반영 확인
    - [ ] 메모 상세 모달 열고 즉시 전환 → 전환 성공 확인 (이전엔 `addOpenHistory`와 경합)
    - [ ] 체크리스트 토글 → 즉시 메모 저장(MemoForm) → 체크리스트 상태와 저장 내용 모두 보존 확인 (`toggleChecklistItem` fire-and-forget 회귀)

12. - [ ] **수동 시나리오: Phase 1 매퍼 변경 부작용 검증**
    - [ ] **TodoForm 편집**: 옵셔널 필드(예: `dueDate`)가 비어있는 todo를 TodoForm에서 열어 다른 필드만 수정 후 저장 → DB의 `due_date`가 NULL로 덮어써지지 않는지 확인 (spread 패턴 안전성)
    - [ ] **백업 import**: 옵셔널 필드가 비어있는 메모를 export → 일부 필드 추가 → import → 기존 DB의 다른 필드들이 NULL로 손실되지 않는지 확인 (Phase 2.5 검증)
    - [ ] **completedAt 클리어**: 완료된 todo를 pending으로 토글 → DB `completed_at`이 정상적으로 NULL로 클리어 확인 (정상 동작)

13. - [ ] **수동 시나리오: 크로스 디바이스 동시 수정 시 retry 스킵 확인**
    - [ ] 기기 A에서 메모 수정 → 기기 B에서 동일 메모를 (오프라인 상태에서) 수정 → B가 온라인 복귀하면 PGRST116 발생 → retry 스킵 + fetchFromSupabase 폴백 + 토스트 표시 확인 (last-write-wins 자동 발생 방지)

---

## 검증

### 빌드

```bash
npm run build
```

- 기대 결과: 타입 에러 0개, 빌드 성공

### 검증 기준

- [ ] `npm run build` 성공
- [ ] 모든 수동 시나리오 통과
- [ ] Supabase에서 todo→메모 전환 후 todo 필드 NULL 확인
- [ ] 브라우저 콘솔 PGRST116 경고 미발생

---

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/services/memoMapper.ts` | `memoToSupabase()` undefined→null 변환 (Phase 1) |
| `src/lib/stores/memos.svelte.ts` | per-memo 큐, PGRST116 재시도(+크로스 디바이스 가드), convertTodoToMemo 필드 추가, 빈 업데이트 차단 (Phase 2~5) |
| `src/lib/utils/data.ts` | 백업 import 시 undefined 키 제거 (Phase 2.5) |

## 후속 별도 plan 후보

- **openHistory 기능 복구 또는 제거** — `addOpenHistory()`가 호출되지만 DB 컬럼/매핑이 없어 데이터가 저장되지 않음. 기능을 살릴지 코드 제거할지 결정 필요.
- **per-memo 큐 dedupe** — 같은 메모에 빠르게 여러 번 같은 종류의 update(예: 핀 토글 5연타)가 큐에 쌓이면 모두 직렬 실행. 마지막 의미만 실행하는 dedupe/coalescing 최적화 검토 (현재 plan 범위 외).

---

*상태: 구현완료 | 진행률: 6/18 (33%) — Phase 6 수동 검증 별도*
