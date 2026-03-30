# 북마크 가시성 & 필터 & 태그 항상표시 기능

> 작성일: 2026-03-30
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/18 (0%)
> 요약: 메모→할일 전환 시 북마크가 사라지는 문제 수정, 북마크 전용 필터 추가, 태그에 항상표시 속성을 도입하여 기본보기/필터보기 가시성 제어

---

## 개요

### 문제 1: 타입 전환 시 북마크 소실 (보이기만 안됨)
`convertMemoToTodo()` 실행 시 `isPinned`/`isFavorite` 데이터는 보존되지만, 대시보드와 메모 페이지의 필터가 `memoType !== 'todo'` 조건으로 할일을 제외하여 북마크가 사라져 보임.

- `src/routes/+page.svelte:52-61` — pinnedMemos, favoriteMemos에서 todo 제외
- `src/lib/stores/filter.svelte.ts:108` — getFilteredMemos()에서 todo 제외

### 문제 2: 북마크 전용 필터 부재
현재 FilterTabs에 '핀', '즐겨찾기' 필터는 있으나 둘을 합친 '북마크' 필터가 없음.

### 문제 3: 태그 가시성 제어 불가
태그가 단순 `string[]`로 메타데이터 없음. 특정 태그를 기본보기에서 숨기고 필터에서만 볼 수 있는 방법이 없음.

## 기술적 고려사항

- 태그 메타데이터는 Supabase 테이블 추가 없이 localStorage + memos store 내 관리로 시작 (규모 작음)
- 기존 `getAllTags()`는 메모에서 태그를 수집하므로 tagMeta는 별도 저장 필요
- `alwaysVisible` 기본값 = `true`로 하여 기존 태그 동작 유지
- 필터에서 북마크 선택 시 todo 제외 조건 완화 필요 (Feature 1과 연동)

---

## TODO

### Phase 1: 타입 전환 시 북마크 가시성 수정

1. - [ ] **대시보드 북마크 뷰에서 todo 제외 조건 완화**
   - [ ] `src/routes/+page.svelte`: pinnedMemos 필터에서 `m.memoType !== 'todo'` 조건 제거
   - [ ] `src/routes/+page.svelte`: favoriteMemos 필터에서 `m.memoType !== 'todo'` 조건 제거

2. - [ ] **메모 페이지 필터에서 북마크 선택 시 todo 포함**
   - [ ] `src/lib/stores/filter.svelte.ts`: `getFilteredMemos()`에서 `filter === 'pinned'` 또는 `filter === 'favorites'` 일 때 todo 제외 조건 스킵하도록 수정 (기본 'all'에서는 기존 유지)

### Phase 2: 북마크 필터 추가

3. - [ ] **FilterType에 'bookmarked' 추가**
   - [ ] `src/lib/types/memo.ts:185`: FilterType에 `'bookmarked'` 추가 → `'all' | 'pinned' | 'favorites' | 'bookmarked' | 'archived'`

4. - [ ] **필터 로직에 bookmarked 처리 추가**
   - [ ] `src/lib/stores/filter.svelte.ts`: getFilteredMemos()에 `filter === 'bookmarked'` 분기 추가 — `m.isPinned || m.isFavorite` (todo 포함)

5. - [ ] **FilterTabs UI에 북마크 탭 추가**
   - [ ] `src/lib/components/layout/FilterTabs.svelte`: tabs 배열에 `{ id: 'bookmarked', label: '북마크', icon: Bookmark }` 추가, Bookmark 아이콘 import

### Phase 3: 태그 항상표시 속성 — 데이터 모델 & 저장소

6. - [ ] **TagMeta 인터페이스 정의**
   - [ ] `src/lib/types/memo.ts`: `TagMeta` 인터페이스 추가 (`name: string`, `alwaysVisible: boolean`)

7. - [ ] **태그 메타 저장소 생성**
   - [ ] `src/lib/stores/tagMeta.svelte.ts`: 새 store 생성
     - `tagMetaMap: Record<string, TagMeta>` 상태
     - `getTagMeta(tag)` — 없으면 `{ name: tag, alwaysVisible: true }` 기본값 반환
     - `setAlwaysVisible(tag, value)` — 토글
     - `loadFromStorage()` / `saveToStorage()` — localStorage 'memo-alarm-tag-meta' 키 사용
     - `isTagVisible(tag)` — alwaysVisible 여부 반환

### Phase 4: 태그 항상표시 — 필터 로직

8. - [ ] **기본보기에서 alwaysVisible=false 태그 메모 숨김 처리**
   - [ ] `src/lib/stores/filter.svelte.ts`: getFilteredMemos()에서 기본 보기(filter='all', 태그 선택 없음)일 때 — 메모의 모든 태그가 `alwaysVisible=false`이면 해당 메모 숨김. 하나라도 `alwaysVisible=true`인 태그가 있거나 태그가 없으면 표시
   - [ ] `src/lib/stores/filter.svelte.ts`: 태그 필터 선택 시(`selectedTags.length > 0`)에는 alwaysVisible 무관하게 모든 메모 표시

### Phase 5: 태그 항상표시 — UI

9. - [ ] **TagFilter에 숨겨진 태그 표시 처리**
   - [ ] `src/lib/components/memo/TagFilter.svelte`: alwaysVisible=false 태그는 반투명 스타일로 구분 표시 (EyeOff 아이콘 또는 opacity 50%)

10. - [ ] **MemoForm 고급 속성에 태그 항상표시 토글 추가**
    - [ ] `src/lib/components/memo/MemoForm.svelte`: 태그 목록(line 371-386) 내 각 태그 Badge 옆에 눈 아이콘(Eye/EyeOff) 토글 버튼 추가
    - [ ] 토글 클릭 시 `tagMetaStore.setAlwaysVisible(tag, !current)` 호출

### Phase 6: 초기화 & 통합

11. - [ ] **tagMeta store 초기화 연결**
    - [ ] `src/routes/+layout.svelte`: onMount에서 `tagMetaStore.loadFromStorage()` 호출 추가

12. - [ ] **빌드 검증**
    - [ ] `npm run build` 성공 확인

---

*상태: 초안 | 진행률: 0/18 (0%)*
