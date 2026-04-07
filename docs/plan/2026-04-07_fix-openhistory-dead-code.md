# fix: openHistory 기능 정리 (DB 미저장 dead code)

> 작성일: 2026-04-07
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/0 (0%)
> 출처: /reflect에서 자동 생성
> 요약: addOpenHistory()가 로컬 state만 업데이트하고 DB에 저장되지 않음. Phase 5(빈 업데이트 차단)로 PGRST116 부작용은 제거됐으나, "최근 열람" UI가 새로고침 시 소실되는 혼란을 줌. 기능을 살릴지(DB 컬럼 추가) 제거할지 결정 필요.

---

## 개요

### 배경

`addOpenHistory()`는 메모 열람 이력(`openHistory: number[]`)을 저장하려 하지만:
- `MEMO_FIELD_MAPPINGS`에 `openHistory` 매핑 없음
- DB 마이그레이션에 `open_history` 컬럼 없음
- 결과: `memoToSupabase()` 호출 시 빈 객체 반환 → Phase 5(빈 업데이트 차단)로 Supabase 호출 자체 스킵

`MemoDetailModal.svelte`에서:
- `addOpenHistory(memo.id)` 호출 (154줄)
- `memo.openHistory && memo.openHistory.length > 0` 렌더링 (396~401줄)

### 현재 동작

1. 메모 열기 → `addOpenHistory()` 호출 → 로컬 state에만 이력 추가
2. "최근 열람: {시간}" UI 표시 → 사용자는 저장된 것으로 인식
3. 페이지 새로고침 → 로컬 state 초기화 → "최근 열람" 사라짐 → 사용자 혼란

### 의사결정 필요

**Option A: 기능 제거 (권장)**
- `addOpenHistory()`, `incrementOpenCount()` 함수 제거
- `MemoDetailModal.svelte`에서 openHistory UI 제거
- `Memo` 타입에서 `openHistory?: number[]` 제거
- 코드 간소화, 실수로 인한 혼란 제거

**Option B: 기능 구현 (구현 비용 높음)**
- DB 마이그레이션: `open_history JSONB` 컬럼 추가
- `MEMO_FIELD_MAPPINGS`에 매핑 추가
- RLS 정책 검토

### 관련 파일

| 파일 | 관련 코드 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `addOpenHistory()` (764-771줄), `incrementOpenCount()` (773-780줄) |
| `src/lib/components/memo/MemoDetailModal.svelte` | 154줄 (`addOpenHistory` 호출), 396-401줄 (UI 렌더링) |
| `src/lib/types/memo.ts` | `openHistory?: number[]` (135줄) |

---

## TODO

*(의사결정 후 채운다)*

---

*상태: 초안 | 진행률: 0/0 (0%)*
