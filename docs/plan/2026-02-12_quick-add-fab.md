# 빠른 메모 추가 (플로팅 버튼)

> 작성일: 2026-02-12
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/5 (0%)

---

## 개요

메모 추가하려면 여러 단계가 필요한 현재 상태에서, 홈 화면에 플로팅 액션 버튼(FAB)을 추가하여 빠르게 메모를 입력할 수 있도록 합니다.

### 예상 UX

1. 홈 화면 우하단에 + 버튼 표시
2. 버튼 클릭 → 간단한 입력 모달 또는 MemoForm 열기
3. 저장 후 목록에 즉시 반영

## 기술적 고려사항

- 기존 MemoForm 컴포넌트 재사용
- Safe Area 고려 (하단 네비게이션 + 노치)
- 모바일 우선 (터치 타겟 48px 이상)

---

## TODO

### Phase 1: FAB 컴포넌트 추가

1. [ ] **플로팅 액션 버튼 추가** — 홈 화면 우하단
   - [ ] `src/routes/+page.svelte`: FAB 버튼 추가
     - 위치: `fixed bottom-20 right-4` (BottomNav 위)
     - 아이콘: Plus (lucide-svelte)
     - 크기: `w-14 h-14` (터치 친화적)
     - 스타일: primary 색상, 그림자

### Phase 2: 빠른 추가 모달

2. [ ] **FAB 클릭 시 동작** — 모달 또는 폼 열기
   - [ ] `src/routes/+page.svelte`: `showQuickAdd` 상태 추가
   - [ ] `src/routes/+page.svelte`: FAB 클릭 시 `showQuickAdd = true`

3. [ ] **기존 MemoForm 연동** — 재사용
   - [ ] `src/routes/+page.svelte`: MemoForm 모달 표시 로직 추가
     - 빈 메모로 초기화
     - 저장 후 `showQuickAdd = false` + 목록 새로고침

### Phase 3: 애니메이션 & 마무리

4. [ ] **FAB 애니메이션** — 부드러운 UX
   - [ ] `src/routes/+page.svelte`: FAB hover/active 스케일 애니메이션
   - [ ] `src/routes/+page.svelte`: 모달 열릴 때 FAB 회전 (+ → ×)

5. [ ] **빌드 확인**
   - [ ] `npm run build` 실행 및 에러 수정

---

*상태: 초안 | 진행률: 0/5 (0%)*
