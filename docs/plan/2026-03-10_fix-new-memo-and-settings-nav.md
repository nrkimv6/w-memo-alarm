# 새메모 버튼 에러 + 설정 네비게이션 수정

> 작성일: 2026-03-10
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 0/5 (0%)
> 요약: 새메모 버튼 클릭 시 AudioRecorder prop 이름 불일치로 인한 TypeError 수정, 하단 네비게이션 설정 버튼 미작동 원인 조사 및 수정

---

## 개요

### 버그 1: 새메모 버튼 클릭 시 TypeError

`MemoForm.svelte`에서 `<AudioRecorder {audioUrls} ...>`로 전달하지만, `AudioRecorder.svelte`의 Props 인터페이스는 `audioDataUrls`를 기대한다. Svelte 5의 `$props()` 디스트럭처링에서 `audioDataUrls`가 `undefined`가 되어, `audioDataUrls.length` 접근 시 `Cannot read properties of undefined (reading 'length')` 에러 발생.

**에러 위치**: `AudioRecorder.svelte:138` — `$derived(!readonly && audioDataUrls.length < MAX_RECORDINGS)`

**동일 버그 존재**: `MemoDetailModal.svelte:265`에서도 `audioUrls`로 전달 (같은 불일치).

### 버그 2: 설정 버튼 클릭 시 페이지 미이동

코드상 `BottomNav.svelte`의 `<a href="/settings">`와 `src/routes/settings/+page.svelte` 라우트 모두 정상. 런타임 환경(Capacitor/브라우저) 확인 및 빌드 결과물 검증 필요.

## 기술적 고려사항

- AudioRecorder의 prop명을 `audioUrls`로 통일하는 것이 Memo 타입(`audioUrls?: string[]`)과 일관성 유지
- `audioDataUrls` → `audioUrls`로 변경 시 AudioRecorder 내부 모든 참조를 일괄 수정
- 설정 페이지 미이동은 빌드 후 실제 동작 확인 필요 (코드 분석만으로는 원인 불명확)

---

## TODO

### Phase 1: AudioRecorder prop 이름 수정 (버그 1 핵심 수정)

1. [ ] **AudioRecorder prop명 통일** — `audioDataUrls` → `audioUrls`로 변경
   - [ ] `src/lib/components/memo/AudioRecorder.svelte`: Props 인터페이스의 `audioDataUrls` → `audioUrls`로 변경
   - [ ] `src/lib/components/memo/AudioRecorder.svelte`: `$props()` 디스트럭처링의 `audioDataUrls` → `audioUrls`로 변경
   - [ ] `src/lib/components/memo/AudioRecorder.svelte`: 내부 모든 `audioDataUrls` 참조를 `audioUrls`로 일괄 변경 (라인 62, 108, 138, 161, 167, 168, 169, 182, 184)

### Phase 2: 설정 네비게이션 디버깅 (버그 2)

2. [ ] **설정 페이지 이동 확인** — 빌드 후 런타임 동작 검증
   - [ ] `npm run build` 후 설정 라우트가 빌드 출력에 포함되는지 확인
   - [ ] 브라우저 `dev` 모드에서 `/settings` 직접 접속 테스트
   - [ ] 브라우저 콘솔에서 BottomNav 설정 링크 클릭 시 에러 로그 확인
   - [ ] 원인 파악 후 수정 (결과에 따라 추가 작업)

### Phase 3: 빌드 검증

3. [ ] **빌드 확인** — `npm run build` 성공 확인

---

*상태: 초안 | 진행률: 0/5 (0%)*
