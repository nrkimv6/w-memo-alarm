# 북마크 가시성 & 필터 & 태그 항상표시 기능

> 작성일: 2026-03-30
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/22 (0%)
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
   - [ ] `src/routes/+page.svelte:52-56`: pinnedMemos의 `.filter((m) => m.isPinned && m.isActive && m.memoType !== 'todo')` → `m.memoType !== 'todo'` 조건 제거하여 `.filter((m) => m.isPinned && m.isActive)`로 변경
   - [ ] `src/routes/+page.svelte:58-62`: favoriteMemos의 `.filter((m) => m.isFavorite && m.isActive && !m.isPinned && m.memoType !== 'todo')` → `m.memoType !== 'todo'` 조건 제거하여 `.filter((m) => m.isFavorite && m.isActive && !m.isPinned)`로 변경

2. - [ ] **메모 페이지 필터에서 북마크/즐겨찾기 선택 시 todo 포함**
   - [ ] `src/lib/stores/filter.svelte.ts:104-108`: `getFilteredMemos()` 상단의 하드코딩 `result = result.filter((m) => m.memoType !== 'todo')` 를 조건부로 변경 — `filter`가 `'pinned'`, `'favorites'`, `'bookmarked'` 중 하나이면 todo 제외 스킵, 그 외(`'all'`, `'archived'`)에서는 기존대로 todo 제외

### Phase 2: 북마크 필터 추가

3. - [ ] **FilterType 확장**
   - [ ] `src/lib/types/memo.ts:185`: `export type FilterType = 'all' | 'pinned' | 'favorites' | 'archived'` → `'all' | 'pinned' | 'favorites' | 'bookmarked' | 'archived'`로 변경

4. - [ ] **필터 로직에 bookmarked 분기 추가**
   - [ ] `src/lib/stores/filter.svelte.ts:121-125`: 기존 pinned/favorites 분기 뒤에 `else if (filter === 'bookmarked') { result = result.filter((m) => m.isPinned || m.isFavorite); }` 분기 추가

5. - [ ] **FilterTabs UI에 북마크 탭 추가**
   - [ ] `src/lib/components/layout/FilterTabs.svelte:3`: import에 `Bookmark` 추가 — `import { Pin, Star, Bookmark, Grid, List, EyeOff, LayoutList } from 'lucide-svelte'`
   - [ ] `src/lib/components/layout/FilterTabs.svelte:8-12`: tabs 배열에 `{ id: 'bookmarked', label: '북마크', icon: Bookmark }` 항목 추가 (favorites 뒤에)

### Phase 3: 태그 항상표시 속성 — 데이터 모델 & 저장소

6. - [ ] **TagMeta 인터페이스 정의**
   - [ ] `src/lib/types/memo.ts`: Folder 인터페이스(line 1-8) 근처에 `export interface TagMeta { name: string; alwaysVisible: boolean; }` 추가

7. - [ ] **태그 메타 저장소 생성** — `settings.svelte.ts` 패턴 따름
   - [ ] `src/lib/stores/tagMeta.svelte.ts`: 새 파일 생성. 구조:
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

8. - [ ] **기본보기에서 alwaysVisible=false 전용 태그 메모 숨김**
   - [ ] `src/lib/stores/filter.svelte.ts:1-3`: import에 `import { tagMetaStore } from './tagMeta.svelte'` 추가
   - [ ] `src/lib/stores/filter.svelte.ts`: `getFilteredMemos()`에서 태그 필터 적용 전(line ~153 부근), `filter === 'all'` AND `selectedTags.length === 0` 일 때 추가 필터: `result = result.filter((m) => m.tags.length === 0 || m.tags.some((t) => tagMetaStore.isTagVisible(t)))` — 태그 없는 메모는 항상 표시, 태그 있는 메모는 하나라도 alwaysVisible인 태그가 있어야 표시

### Phase 5: 태그 항상표시 — UI

9. - [ ] **TagFilter에 숨겨진 태그 시각적 구분**
   - [ ] `src/lib/components/memo/TagFilter.svelte:1-6`: import에 `import { tagMetaStore } from '$lib/stores/tagMeta.svelte'` 추가
   - [ ] `src/lib/components/memo/TagFilter.svelte:16-27`: 각 태그 button의 기본 스타일에 `!tagMetaStore.isTagVisible(tag)` 조건 추가 — 비활성 태그는 `opacity-50` 클래스 추가 및 `EyeOff` 아이콘(이미 import됨→아님, `X`만 import됨) → `import { X, EyeOff } from 'lucide-svelte'`로 변경 후 비활성 태그 버튼 내에 `<EyeOff class="w-3 h-3 inline ml-0.5" />` 추가

10. - [ ] **MemoForm 태그 목록에 항상표시 토글 추가**
    - [ ] `src/lib/components/memo/MemoForm.svelte:2`: import에 `Eye, EyeOff` 추가 — `import { X, Plus, Link, ListChecks, Sparkles, ArrowRightLeft, Lock, LockOpen, Eye, EyeOff } from 'lucide-svelte'`
    - [ ] `src/lib/components/memo/MemoForm.svelte`: import 섹션에 `import { tagMetaStore } from '$lib/stores/tagMeta.svelte'` 추가
    - [ ] `src/lib/components/memo/MemoForm.svelte:371-386`: 태그 Badge 내부, 삭제 버튼(`removeTag`) 앞에 눈 토글 버튼 추가 — `<button type="button" onclick={() => tagMetaStore.setAlwaysVisible(tag, !tagMetaStore.isTagVisible(tag))} class="ml-1 p-0.5 hover:bg-black/10 rounded-full" title={tagMetaStore.isTagVisible(tag) ? '기본보기에서 숨기기' : '기본보기에서 표시'}>{#if tagMetaStore.isTagVisible(tag)}<Eye class="w-3 h-3" />{:else}<EyeOff class="w-3 h-3 text-muted-foreground" />{/if}</button>`

### Phase 6: 초기화 & 빌드 검증

11. - [ ] **tagMeta store 초기화 연결**
    - [ ] `src/routes/+layout.svelte`: import 섹션에 `import { tagMetaStore } from '$lib/stores/tagMeta.svelte'` 추가
    - [ ] `src/routes/+layout.svelte:105`: `foldersStore.init()` 뒤에 `tagMetaStore.init()` 호출 추가

12. - [ ] **빌드 검증**
    - [ ] `npm run build` 실행하여 타입 에러 없이 성공 확인

---

*상태: 초안 | 진행률: 0/22 (0%)*
