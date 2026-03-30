# 북마크 가시성 & 필터 & 태그 항상표시 기능

> 완료일: 2026-03-30
> 아카이브됨
> 진행률: 22/22 (100%)
> 요약: 메모→할일 전환 시 북마크가 사라지는 문제 수정, 북마크 전용 필터 추가, 태그에 항상표시 속성을 도입하여 기본보기/필터보기 가시성 제어

---

## Context

메모→할일 타입 전환 시 isPinned/isFavorite 데이터는 보존되지만, 대시보드(`+page.svelte:52-61`)와 필터 스토어(`filter.svelte.ts:108`)의 `memoType !== 'todo'` 하드코딩 조건으로 인해 북마크된 항목이 사라져 보이는 문제. 추가로 북마크 전용 필터와 태그별 기본보기 가시성 제어를 요청받음.

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/routes/+page.svelte` | pinnedMemos/favoriteMemos에서 todo 제외 조건 제거 |
| `src/lib/stores/filter.svelte.ts` | todo 제외 조건부화 + bookmarked 필터 + tagMeta 필터 |
| `src/lib/types/memo.ts` | FilterType 확장 + TagMeta 인터페이스 |
| `src/lib/components/layout/FilterTabs.svelte` | 북마크 탭 추가 |
| `src/lib/stores/tagMeta.svelte.ts` | 새 store 생성 (localStorage 기반) |
| `src/lib/components/memo/TagFilter.svelte` | 숨겨진 태그 시각 구분 |
| `src/lib/components/memo/MemoForm.svelte` | 태그 항상표시 토글 UI |
| `src/routes/+layout.svelte` | tagMeta store 초기화 |

---

## TODO

### Phase 1: 타입 전환 시 북마크 가시성 수정

1. - [x] **대시보드 북마크 뷰에서 todo 제외 조건 완화**
   - [x] `src/routes/+page.svelte:52-56`: pinnedMemos의 `.filter((m) => m.isPinned && m.isActive && m.memoType !== 'todo')` → `m.memoType !== 'todo'` 조건 제거하여 `.filter((m) => m.isPinned && m.isActive)`로 변경
   - [x] `src/routes/+page.svelte:58-62`: favoriteMemos의 `.filter((m) => m.isFavorite && m.isActive && !m.isPinned && m.memoType !== 'todo')` → `m.memoType !== 'todo'` 조건 제거하여 `.filter((m) => m.isFavorite && m.isActive && !m.isPinned)`로 변경

2. - [x] **메모 페이지 필터에서 북마크/즐겨찾기 선택 시 todo 포함**
   - [x] `src/lib/stores/filter.svelte.ts:104-108`: `getFilteredMemos()` 상단의 하드코딩 `result = result.filter((m) => m.memoType !== 'todo')` 를 조건부로 변경 — `filter`가 `'pinned'`, `'favorites'`, `'bookmarked'` 중 하나이면 todo 제외 스킵, 그 외(`'all'`, `'archived'`)에서는 기존대로 todo 제외

### Phase 2: 북마크 필터 추가

3. - [x] **FilterType 확장**
   - [x] `src/lib/types/memo.ts:185`: `export type FilterType = 'all' | 'pinned' | 'favorites' | 'archived'` → `'all' | 'pinned' | 'favorites' | 'bookmarked' | 'archived'`로 변경

4. - [x] **필터 로직에 bookmarked 분기 추가**
   - [x] `src/lib/stores/filter.svelte.ts:121-125`: 기존 pinned/favorites 분기 뒤에 `else if (filter === 'bookmarked') { result = result.filter((m) => m.isPinned || m.isFavorite); }` 분기 추가

5. - [x] **FilterTabs UI에 북마크 탭 추가**
   - [x] `src/lib/components/layout/FilterTabs.svelte:3`: import에 `Bookmark` 추가 — `import { Pin, Star, Bookmark, Grid, List, EyeOff, LayoutList } from 'lucide-svelte'`
   - [x] `src/lib/components/layout/FilterTabs.svelte:8-12`: tabs 배열에 `{ id: 'bookmarked', label: '북마크', icon: Bookmark }` 항목 추가 (favorites 뒤에)

### Phase 3: 태그 항상표시 속성 — 데이터 모델 & 저장소

6. - [x] **TagMeta 인터페이스 정의**
   - [x] `src/lib/types/memo.ts`: Folder 인터페이스(line 1-8) 근처에 `export interface TagMeta { name: string; alwaysVisible: boolean; }` 추가

7. - [x] **태그 메타 저장소 생성** — `settings.svelte.ts` 패턴 따름
   - [x] `src/lib/stores/tagMeta.svelte.ts`: 새 파일 생성. 구조:
     - 상수: `const STORAGE_KEY = 'memo-alarm-tag-meta'`
     - 상태: `let metaMap = $state<Record<string, TagMeta>>({})`, `let initialized = $state(false)`
     - `loadFromStorage()` → `typeof window === 'undefined'` SSR 체크 + `try/catch` + `JSON.parse` + 기본값 `{}`
     - `saveToStorage()` → `JSON.stringify(metaMap)` 저장
     - `init()` → `if (initialized) return; metaMap = loadFromStorage(); initialized = true;`
     - `getTagMeta(tag: string): TagMeta` → `metaMap[tag] ?? { name: tag, alwaysVisible: true }`
     - `isTagVisible(tag: string): boolean` → `getTagMeta(tag).alwaysVisible`
     - `setAlwaysVisible(tag: string, value: boolean): void` → `metaMap = { ...metaMap, [tag]: { name: tag, alwaysVisible: value } }; saveToStorage()`
     - export: `getTagMeta`, `isTagVisible`, `setAlwaysVisible`, `init`, getter `metaMap`

### Phase 4: 태그 항상표시 — 필터 로직

8. - [x] **기본보기에서 alwaysVisible=false 전용 태그 메모 숨김**
   - [x] `src/lib/stores/filter.svelte.ts:1-3`: import에 `import { tagMetaStore } from './tagMeta.svelte'` 추가
   - [x] `src/lib/stores/filter.svelte.ts`: `getFilteredMemos()`에서 태그 필터 적용 전(line ~153 부근), `filter === 'all'` AND `selectedTags.length === 0` 일 때 추가 필터: `result = result.filter((m) => m.tags.length === 0 || m.tags.some((t) => tagMetaStore.isTagVisible(t)))` — 태그 없는 메모는 항상 표시, 태그 있는 메모는 하나라도 alwaysVisible인 태그가 있어야 표시

### Phase 5: 태그 항상표시 — UI

9. - [x] **TagFilter에 숨겨진 태그 시각적 구분**
   - [x] `src/lib/components/memo/TagFilter.svelte:1-6`: import에 `import { tagMetaStore } from '$lib/stores/tagMeta.svelte'` 추가, `import { X, EyeOff } from 'lucide-svelte'`로 변경
   - [x] `src/lib/components/memo/TagFilter.svelte:16-27`: 각 태그 button에 `!tagMetaStore.isTagVisible(tag)` 시 `opacity-50` 클래스 추가 + 비활성 태그 버튼 내에 `<EyeOff class="w-3 h-3 inline ml-0.5" />` 추가

10. - [x] **MemoForm 태그 목록에 항상표시 토글 추가**
    - [x] `src/lib/components/memo/MemoForm.svelte:2`: import에 `Eye, EyeOff` 추가
    - [x] `src/lib/components/memo/MemoForm.svelte`: import 섹션에 `import { tagMetaStore } from '$lib/stores/tagMeta.svelte'` 추가
    - [x] `src/lib/components/memo/MemoForm.svelte:371-386`: 태그 Badge 내부, 삭제 버튼(`removeTag`) 앞에 Eye/EyeOff 토글 버튼 추가. `tagMetaStore.isTagVisible(tag)` 상태에 따라 아이콘 전환

### Phase 6: 초기화 & 빌드 검증

11. - [x] **tagMeta store 초기화 연결**
    - [x] `src/routes/+layout.svelte`: import 섹션에 `import { tagMetaStore } from '$lib/stores/tagMeta.svelte'` 추가
    - [x] `src/routes/+layout.svelte:105`: `foldersStore.init()` 뒤에 `tagMetaStore.init()` 호출 추가

12. - [x] **빌드 검증**
    - [x] `npm run build` 실행하여 타입 에러 없이 성공 확인

---

*상태: 구현완료 | 진행률: 22/22 (100%)*
