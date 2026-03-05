# memo-alarm: 메모 수정 시 undefined tags 크래시 수정

> 완료일: 2026-03-05
> 아카이브됨
> 작성일: 2026-02-27
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 진행률: 5/5 (100%)
> 요약: 메모 선택 후 수정 클릭 시 "Cannot read properties of undefined (reading 'length')" 에러 발생. localStorage 캐시에 저장된 구버전 메모 데이터에 tags 필드가 없을 때 크래시하는 문제를 방어 코드로 수정한다.

---

## 개요

### 증상

- 메모 목록에서 메모 클릭 → MemoDetailModal 열림 → "수정" 버튼 클릭 → 앱 크래시
- 에러: `Cannot read properties of undefined (reading 'length')`
- MemoDetailModal에서도 tags 관련 렌더링 중 크래시 가능

### 근본 원인

`loadCacheFromStorage()`가 localStorage의 JSON을 역직렬화할 때 필드 정규화 없이 그대로 반환한다:

```ts
// memos.svelte.ts 현재 코드
function loadCacheFromStorage(): Memo[] {
  const cached = localStorage.getItem(CACHE_KEY);
  return cached ? JSON.parse(cached) : [];  // 정규화 없음
}
```

구버전에 저장된 메모 객체에 `tags` 필드가 없으면(`undefined`), 이후 아래 코드들이 모두 크래시:

| 위치 | 문제 코드 |
|------|----------|
| `MemoForm.svelte:123` | `tags = [...memo.tags]` |
| `MemoDetailModal.svelte:299` | `{#if memo.tags.length > 0}` |
| `MemoDetailModal.svelte:343` | `{#if related.tags.length > 0}` |
| `memos.svelte.ts:716` | `m.tags.forEach(...)` |

### 수정 전략

로컬스토리지에서 로드 시 `normalizeMemo()` 함수로 필수 배열 필드에 기본값 보장.
컴포넌트에는 타입 보장만 하는 방어 코드를 추가(2차 안전망).

---

## 기술적 고려사항

- `Memo` 타입에 `tags: string[]`는 필수(required)이나 실제 저장 데이터는 구버전 호환 문제로 `undefined`일 수 있음
- `tags` 외에도 `isActive`, `isPinned`, `isFavorite` 등 구버전 누락 가능 필드 일괄 정규화
- Supabase에서 로드하는 경로(`supabaseToMemo`)는 이미 `tags: data.tags || []` 처리 중 → 문제 없음
- localStorage 캐시 경로만 수정하면 됨

---

## TODO

### Phase 1: localStorage 캐시 정규화 함수 추가

1. [x] **`normalizeMemo` 함수 추가 및 적용** — memos.svelte.ts
   - [x] `src/lib/stores/memos.svelte.ts`: `loadCacheFromStorage()` 위에 `normalizeMemo(m: unknown): Memo` 함수 추가
     ```ts
     function normalizeMemo(m: unknown): Memo {
       const raw = m as Record<string, unknown>;
       return {
         ...(raw as Memo),
         tags: Array.isArray(raw.tags) ? raw.tags : [],
         isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
         isPinned: Boolean(raw.isPinned),
         isFavorite: Boolean(raw.isFavorite),
       };
     }
     ```
   - [x] `src/lib/stores/memos.svelte.ts`: `loadCacheFromStorage()` 반환값을 `.map(normalizeMemo)`로 감싸기

### Phase 2: 컴포넌트 방어 코드 추가 (2차 안전망)

2. [x] **MemoForm 방어 처리** — MemoForm.svelte
   - [x] `src/lib/components/memo/MemoForm.svelte:123`: `tags = [...(memo.tags ?? [])]` 로 변경

3. [x] **MemoDetailModal 방어 처리** — MemoDetailModal.svelte
   - [x] `src/lib/components/memo/MemoDetailModal.svelte:299`: `{#if (memo.tags ?? []).length > 0}` 로 변경
   - [x] `src/lib/components/memo/MemoDetailModal.svelte:343`: `{#if (related.tags ?? []).length > 0}` 로 변경

### Phase 3: 빌드 확인

4. [x] **타입 체크 및 빌드**
   - [x] `memo-alarm/`: `npm run check` 실행하여 타입 에러 없음 확인
   - [x] `memo-alarm/`: `npm run build` 실행하여 빌드 성공 확인

### Phase 4: 커밋

5. [x] **변경사항 커밋**
   - [x] 수정된 3개 파일 git add 후 커밋 스크립트 실행

---

*상태: 구현완료 | 진행률: 5/5 (100%)*
