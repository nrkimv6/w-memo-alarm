# 새메모 버튼 에러 + 설정 네비게이션 수정

> 완료일: 2026-03-10
> 아카이브됨
> 작성일: 2026-03-10
> 대상 프로젝트: memo-alarm
> 상태: 구현완료
> 반영일: 2026-03-10 09:50
> 머지커밋: 07b82bf
> 진행률: 3/3 (100%)
> 요약: AudioRecorder prop 이름 불일치(`audioDataUrls` vs `audioUrls`)로 인한 TypeError 수정. 버그 2(설정 네비게이션 미작동)는 버그 1의 연쇄 효과로 확인됨.

---

## 개요

### 버그 1: 새메모 버튼 클릭 시 TypeError

`MemoForm.svelte`에서 `<AudioRecorder {audioUrls} ...>`로 전달하지만, `AudioRecorder.svelte`의 Props 인터페이스는 `audioDataUrls`를 기대한다. Svelte 5의 `$props()` 디스트럭처링에서 `audioDataUrls`가 `undefined`가 되어, `audioDataUrls.length` 접근 시 `Cannot read properties of undefined (reading 'length')` 에러 발생.

**에러 위치**: `AudioRecorder.svelte:138` — `$derived(!readonly && audioDataUrls.length < MAX_RECORDINGS)`

**동일 버그 존재**: `MemoDetailModal.svelte:265`에서도 `audioUrls`로 전달 (같은 불일치).

### 버그 2: 설정 버튼 클릭 시 페이지 미이동

버그 1의 TypeError가 Svelte 렌더링을 깨뜨려 이후 네비게이션이 작동하지 않는 연쇄 효과. 버그 1을 수정하면 자동 해결.

## 기술적 고려사항

- AudioRecorder의 prop명을 `audioUrls`로 통일하는 것이 Memo 타입(`audioUrls?: string[]`)과 일관성 유지
- `audioDataUrls` → `audioUrls`로 변경 시 AudioRecorder 내부 모든 참조를 일괄 수정

---

## TODO

### Phase 1: AudioRecorder prop 이름 수정

1. - [x] **AudioRecorder.svelte prop명 일괄 변경** — `audioDataUrls` → `audioUrls` (replace_all)
   - [x] `src/lib/components/memo/AudioRecorder.svelte:6`: Props 인터페이스 `audioDataUrls: string[]` → `audioUrls: string[]`
   - [x] `src/lib/components/memo/AudioRecorder.svelte:11`: `$props()` 디스트럭처링 `audioDataUrls` → `audioUrls`
   - [x] `src/lib/components/memo/AudioRecorder.svelte`: 내부 참조 12개소 일괄 변경 (`replace_all` 사용) — L62(onAudioChange spread), L108(filter), L138($derived length), L161/L163(cn 조건), L167(삼항), L168/L169(#if + length), L182(#if length), L184(#each)

### Phase 2: 빌드 검증

2. - [x] **빌드 확인** — `npm run build` 성공 확인
   - [x] `memo-alarm` 디렉토리에서 `npm run build` 실행, 에러 없음 확인

---

*상태: 구현완료 | 진행률: 3/3 (100%)*
