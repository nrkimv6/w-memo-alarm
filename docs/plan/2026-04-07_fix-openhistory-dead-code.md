# fix: openHistory 기능 정리 (DB 미저장 dead code)

> 작성일: 2026-04-07
> 대상 프로젝트: memo-alarm
> 상태: 테스트중
> branch: plan/2026-04-07_fix-openhistory-dead-code
> worktree: .worktrees/2026-04-07_fix-openhistory-dead-code
> 진행률: 5/5 (100%)
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

### 의사결정 결과: Option A (기능 제거) 채택

**코드베이스 분석 추가 결과:**
- `openCount` / `incrementOpenCount()` → `memoMapper.ts:65`에 `open_count` DB 컬럼 매핑 확인 → **정상 작동, 제거 대상 아님**
- `openHistory` → DB 매핑 없음 → dead code 확정
- `Clock` 아이콘 (`lucide-svelte`) → `openHistory` UI 블록에서만 사용 → 함께 제거 필요
- `MemoCreate` 타입 Omit에 `'openHistory'` 포함 → 제거 후 해당 Omit 항목도 삭제

**제거 범위 (openHistory만, openCount는 유지):**
- `addOpenHistory()` 함수 제거
- `openHistory` UI 제거
- `openHistory?: number[]` 타입 제거
- `Clock` import 제거 (openHistory UI만의 사용처)

### 관련 파일

| 파일 | 관련 코드 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `addOpenHistory()` (764-771줄), `incrementOpenCount()` (773-780줄) |
| `src/lib/components/memo/MemoDetailModal.svelte` | 154줄 (`addOpenHistory` 호출), 396-401줄 (UI 렌더링) |
| `src/lib/types/memo.ts` | `openHistory?: number[]` (135줄) |

---

## TODO

### Phase 1: openHistory dead code 제거

1. - [x] **`src/lib/stores/memos.svelte.ts` — addOpenHistory 함수 제거**
   - [x] `memos.svelte.ts` 764~772줄: `addOpenHistory()` 함수 블록 전체 삭제
   - [x] `memos.svelte.ts` 1292줄: 스토어 export에서 `addOpenHistory` 제거

2. - [x] **`src/lib/types/memo.ts` — openHistory 타입 정의 제거**
   - [x] `memo.ts` 135줄: `openHistory?: number[];` 라인 삭제 (Phase 8 주석 포함)
   - [x] `memo.ts` 173줄: `MemoCreate` Omit에서 `| 'openHistory'` 항목 제거

3. - [x] **`src/lib/components/memo/MemoDetailModal.svelte` — 호출/UI/import 제거**
   - [x] `MemoDetailModal.svelte` 154줄: `memosStore.addOpenHistory(memo.id);` 라인 삭제
   - [x] `MemoDetailModal.svelte` 395~404줄: `<!-- Open history -->` 블록 전체 삭제 (395줄 주석, 396줄 `{#if}`, 397~403줄 내부 콘텐츠, 404줄 `{/if}` 포함 — 396~403만 삭제 시 404줄의 `{/if}` 잔존으로 Svelte 컴파일 오류 발생)
   - [x] `MemoDetailModal.svelte` 10줄: import에서 `Clock,` 항목 제거 (openHistory UI에서만 사용 확인)

---

### Phase R: 재발 경로 분석 (fix: plan 필수)

4. - [x] **수정 대상(`addOpenHistory`)의 모든 호출/참조 경로 열거**
   - [x] Grep으로 `addOpenHistory` 참조 파일 전체 검색 (`src/` 범위) → 0건 (완전 제거 확인)
   - [x] 각 호출 경로별 "이 경로에서 동일 dead code 문제가 발생할 수 있는가?" 판정
   - [x] 방어됨/미방어 증명을 표로 작성 (경로 | 방어여부 | 근거)

   | 경로 | 방어여부 | 근거 |
   |------|---------|------|
   | `MemoDetailModal.svelte:handleUrlClick` | ✅ 방어됨 | `addOpenHistory` 호출 라인 삭제 완료 |
   | `memos.svelte.ts:addOpenHistory` | ✅ 방어됨 | 함수 정의 및 export 삭제 완료 |
   | `memo.ts:openHistory?: number[]` | ✅ 방어됨 | 타입 필드 및 MemoCreate Omit 항목 삭제 완료 |

5. - [x] **미방어 경로 확인 및 마무리**
   - [x] `incrementOpenCount` 호출 경로 검증 — DB 매핑(`open_count`) `memoMapper.ts:65`에서 정상 동작 재확인. 5개 호출 경로(notifications.svelte.ts×2, MemoCard.svelte, MemoDetailModal.svelte, TodayReminders.svelte) 모두 정상
   - [x] `openHistory` 관련 문자열/주석 전체 검색 → `memos.svelte.ts:557` stale 주석(`예: openHistory`) 제거 완료. `src/` 내 `openHistory` 잔존 0건 확인
   - [x] 모든 경로 방어 완료 확인 명시 — `addOpenHistory`/`openHistory` 참조 `src/` 전체에서 0건

🔴 fix: plan인데 Phase R이 없으면 /done과 /merge-test에서 차단된다.

---

*상태: 테스트중 | 진행률: 5/5 (100%)*
