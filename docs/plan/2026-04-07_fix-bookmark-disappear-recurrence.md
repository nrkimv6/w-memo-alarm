# 메모↔할일 전환 시 북마크 소실 재발 이슈 수정

> 작성일: 2026-04-07
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/14 (0%)
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

---

## TODO

### Phase 1: 매퍼 수정 (가장 먼저 — 다른 fix가 의존)

1. - [ ] **`memoToSupabase()` undefined→null 변환** — `key in memoRecord`로 부재 vs 명시 undefined 구분
   - [ ] `src/lib/services/memoMapper.ts:101-110`: 루프를 `if (key in memoRecord)`로 감싸고, `val === undefined`이면 `result[db] = null` 전송, 그 외는 기존 `toDb` 처리. `toDb` 호출 전에 undefined 분기 처리하여 변환 함수가 undefined를 받지 않도록.

### Phase 2: convertTodoToMemo 필드 정리 보강

2. - [ ] **누락된 todo 필드 cleanup 추가**
   - [ ] `src/lib/stores/memos.svelte.ts:1163-1176`: update 페이로드에 `dueDate: undefined`, `todoUrls: undefined`, `autoPung: undefined`, `pungDelay: undefined` 4개 추가. Phase 1 수정 후 자동으로 DB에 `null`로 전송됨.

### Phase 3: Per-memo update 큐 (race condition 근본 해결)

3. - [ ] **per-memo pending 큐 자료구조 추가**
   - [ ] `src/lib/stores/memos.svelte.ts`: `createMemosStore()` 상단(60-70줄 부근)에 `const pendingUpdates = new Map<string, Promise<Memo | null>>();` 선언.

4. - [ ] **`update()` 함수에서 큐 대기 + 재조회 적용**
   - [ ] `src/lib/stores/memos.svelte.ts:505-602`: `originalMemo` (509줄)를 `const`→`let`으로 변경.
   - [ ] Supabase 호출 직전 (534줄 부근): pending 프로미스 await 후 `memos.find(m => m.id === id)`로 `originalMemo` 재바인딩.
   - [ ] 535-601의 Supabase 호출 + 응답 처리를 IIFE 프로미스로 감싸 `pendingUpdates.set(id, promise)` 등록, `try/finally`로 `pendingUpdates.delete(id)`.

### Phase 4: PGRST116 단건 재시도 (안전망)

5. - [ ] **버전 충돌 시 단건 재시도 로직**
   - [ ] `src/lib/stores/memos.svelte.ts:545-553`: 기존 `fetchFromSupabase()` 호출을 다음으로 교체:
     - [ ] 1) `supabase.from('ma_memos').select('version').eq('id', id).single()` 로 최신 version 조회
     - [ ] 2) 성공 시 `memoToSupabase(changes)` 재호출 + `.eq('version', freshRow.version)` 로 1회 재시도
     - [ ] 3) 재시도 성공 시 `supabaseToMemo` 변환 + 로컬 상태 갱신 + `saveCacheToStorage` + return
     - [ ] 4) 재시도 실패 시에만 기존 `toastStore.warning` + `fetchFromSupabase()` 폴백

### Phase 5: 빈 업데이트 차단 (addOpenHistory 부작용 제거)

6. - [ ] **`update()`에서 빈 updateData면 Supabase 호출 스킵**
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
| `src/lib/stores/memos.svelte.ts` | per-memo 큐, PGRST116 재시도, convertTodoToMemo 필드 추가, 빈 업데이트 차단 (Phase 2~5) |

---

*상태: 초안 | 진행률: 0/14 (0%)*
