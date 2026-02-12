# 빠른 메모 추가 (플로팅 버튼)

> 작성일: 2026-02-12
> 완료일: 2026-02-13
> 대상 프로젝트: memo-alarm
> 상태: 아카이브됨
> 진행률: 4/4 (100%)

---

## 개요

홈 화면 상단의 QuickMemoInput은 스크롤 시 보이지 않음. 화면 하단에 플로팅 액션 버튼(FAB)을 추가하여 어디서든 빠르게 메모 작성 가능하게 함.

### 예상 UX

1. 홈 화면 우하단에 + 버튼 상시 표시 (BottomNav 위)
2. 버튼 클릭 → 기존 `handleCreateNew()` 호출 → MemoForm 모달 열림
3. 저장 후 모달 닫힘 + memosStore 자동 반영 (기존 로직)

## 기술적 고려사항

- **기존 MemoForm 재사용**: 이미 `bind:open={showForm}` + `memo={editingMemo}` + `onClose={handleFormClose}` 연동 완료
- **새 상태 불필요**: `handleCreateNew()`가 `editingMemo = null; showForm = true` 처리 중
- **BottomNav**: `fixed bottom-0 z-50 h-16` + safe-area-inset-bottom → FAB는 `bottom-[5.5rem]` 이상
- **모바일 우선**: 터치 타겟 56px (`w-14 h-14`)

---

## TODO

### Phase 1: FAB 버튼 추가

1. [x] **`src/routes/+page.svelte`에 FAB 버튼 HTML 추가**
   - `</main>` 닫는 태그 바로 아래, `<!-- Modals -->` 위에 삽입
   - `<button onclick={handleCreateNew}>` — 기존 함수 재사용, 새 상태 추가 없음
   - Tailwind 클래스: `fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center`
   - `bottom-24` = BottomNav(h-16=4rem) + safe-area + 여유 간격
   - `z-40` = BottomNav(z-50)보다 낮게
   - 아이콘: 이미 import된 `Plus` (lucide-svelte) 사용, `class="w-6 h-6"`
   - `aria-label="새 메모 작성"` 접근성 속성 추가

### Phase 2: FAB 인터랙션 스타일

2. [x] **`src/routes/+page.svelte`에 FAB 호버/액티브 애니메이션 추가**
   - Tailwind 클래스 추가: `hover:scale-110 active:scale-95 transition-transform duration-200`
   - `showForm`이 true일 때 FAB 숨기기: `{#if !showForm}...{/if}` 또는 `class:hidden={showForm}`
   - 이유: MemoForm 모달이 열려있으면 FAB가 뒤에 겹쳐 보이지 않아야 함

### Phase 3: 스크롤 시 FAB 자동 숨기기 (선택)

3. [x] **`src/routes/+page.svelte`에 스크롤 방향 감지 로직 추가**
   - `let lastScrollY = $state(0)` + `let fabVisible = $state(true)` 상태 추가
   - `onMount`에서 `scroll` 이벤트 리스너 등록 (throttle 100ms)
   - 아래로 빠르게 스크롤 시 FAB 숨기기, 위로 스크롤 시 다시 표시
   - FAB에 `transition-opacity duration-300` + `opacity-0 pointer-events-none` 토글
   - 선택적 기능이므로 Phase 1, 2 완료 후 판단

### Phase 4: 빌드 확인

4. [x] **`npm run build` 실행 및 에러 수정**
   - 빌드 성공 확인
   - 타입 에러 없는지 확인

---

*상태: 완료 | 진행률: 4/4 (100%)*
