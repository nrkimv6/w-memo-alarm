# fix: memo-alarm svelte-check 21개 에러 수정

> 출처: /reflect에서 자동 생성
> 작성일시: 2026-04-24 14:30
> 기준커밋: 3772a31
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 유형: fix
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/N (0%)
> 요약: `npm run check`(svelte-check) 실행 시 21개 TypeScript/Svelte 에러 발생 — 6개 카테고리 에러를 수정하여 빌드 정합성 확보

---

## 개요

`npm run check` 실행 결과 21개 에러가 존재함 (우리 변경과 무관한 pre-existing 에러).
빌드는 성공하지만 타입 안전성이 손상되어 있으며, CI/CD 또는 향후 기능 추가 시 실제 타입 에러를 놓칠 위험이 있음.

### 에러 카테고리 (6종)

| # | 카테고리 | 에러 수 | 대표 파일 |
|---|---------|---------|----------|
| A | `__APP_VERSION__` 전역 타입 미선언 | 1 | `src/lib/config.ts:4` |
| B | Web Speech API 타입 미선언 (`SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`) | 3 | `src/lib/components/memo/VoiceInput.svelte:13,45,64` |
| C | Modal/컴포넌트 props에 `"size"` 미존재 (`$$ComponentProps`) | 5 | `PinLockModal.svelte`, `TodoForm.svelte` 등 |
| D | EmojiPicker `emoji` prop 미존재 (`Props`) | 2 | `MemoForm.svelte`, `share/+page.svelte` |
| E | Icon `"title"` prop 미존재 (`IconProps`) | 4 | 복수 파일 |
| F | 기타 타입 에러 (Reminder.id 누락, steps 순서, `"none"` 비교, 함수 아닌 값 호출) | 6 | 복수 파일 |

## 기술적 고려사항

- 에러 A, B: 타입 선언 파일(`src/app.d.ts` 또는 `src/types/global.d.ts`) 추가/수정으로 해결
- 에러 C, D, E: 컴포넌트 Props 정의에 해당 속성이 누락되어 있음 — `interface` 또는 `type` 정의에 추가하거나, 불필요한 prop 호출 제거
- 에러 F: 개별 케이스별 수정 필요
- `npm run check` 빌드 게이트가 0 errors여야 clean 상태
- 수정 중 warnings(57개)는 이번 scope 외 — errors(21개)만 대상

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `plan`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯 유지 (blank = 신규 초기 상태)
   - [ ] `plan`: worktree 생성 또는 재개는 `/implement` 또는 `plan-runner` owner flow가 담당
   - [ ] `plan`: worktree cwd 고정 확인

### Phase 1: 전역 타입 선언 추가 (에러 A, B)

1. - [ ] **`__APP_VERSION__` 전역 타입 선언 위치 수정** — `src/lib/config.ts:4` 에러 수정
   - [ ] 상황: `vite.config.ts`에 `define: { __APP_VERSION__: ... }` 이미 존재, `src/app.d.ts:18`에 `declare const __APP_VERSION__: string;` 이미 존재
   - [ ] 문제: `src/app.d.ts`가 `export {}`로 끝나 **모듈 파일**이 됨 → 모듈 레벨 `declare const`는 전역 아님
   - [ ] `src/app.d.ts` 수정: `declare const __APP_VERSION__: string;` 를 `declare global {}` 블록 안으로 이동
   - [ ] 수정 후 svelte-check 재실행으로 에러 A 해소 확인

2. - [ ] **Web Speech API 타입 선언** — `VoiceInput.svelte` 3개 에러 수정
   - [ ] `src/app.d.ts` 또는 `src/types/` 경로 확인
   - [ ] `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` 타입 선언 파일 추가
   - [ ] 옵션 1: `@types/web` 패키지가 있으면 `tsconfig.json`에 `"lib": ["DOM"]` 추가 확인
   - [ ] 옵션 2: `src/types/speech.d.ts` 신규 생성으로 인터페이스 선언

### Phase 2: 컴포넌트 Props 타입 수정 (에러 C, D, E)

3. - [ ] **Modal `size` prop 추가** — `$$ComponentProps` 에러 5건 수정
   - [ ] `src/lib/components/ui/Modal.svelte` 읽기: 현재 Props 정의 확인
   - [ ] Props에 `size?: 'sm' | 'md' | 'lg' | 'xl'` 추가 또는 기존 size 지원 확인
   - [ ] 사용처(`PinLockModal.svelte`, `TodoForm.svelte` 등) 확인하여 valid size 값인지 검증

4. - [ ] **EmojiPicker `emoji` prop 불일치 수정** — `Props` 에러 2건 수정
   - [ ] `src/lib/components/memo/EmojiPicker.svelte` 확인: Props는 `selected`와 `onSelect`만 존재
   - [ ] 사용처(`MemoForm.svelte`, `share/+page.svelte`)에서 `emoji={...}` → `selected={...}` 로 변경
   - [ ] 또는 EmojiPicker Props에 `emoji?` alias 추가 (사용처 변경 없이 해결)

5. - [ ] **Icon `title` prop 추가** — `IconProps` 에러 4건 수정
   - [ ] Icon 컴포넌트 소스 또는 사용 라이브러리 확인 (`lucide-svelte` 또는 커스텀)
   - [ ] `title` prop 지원 방식 파악 후 타입 정의에 추가 또는 호출 코드에서 prop 제거
   - [ ] 4개 사용처 파일 위치 확인 후 일괄 수정

### Phase 3: 기타 타입 에러 수정 (에러 F)

6. - [ ] **`Reminder.id` 누락 수정**
   - [ ] 에러 발생 파일 확인: `grep -rn "enabled.*time.*days.*autoOpen" src/`
   - [ ] `id` 필드를 객체 리터럴에 추가하거나 Reminder 타입에서 `id`를 optional로 변경

7. - [ ] **`steps` 선언 순서 수정** — 2개 에러
   - [ ] 에러 발생 파일 확인: `grep -rn "steps" src/ --include="*.svelte" -l`
   - [ ] `steps` 변수 선언을 사용 위치보다 앞으로 이동

8. - [ ] **`TodoPriority`와 `"none"` 비교 에러 수정**
   - [ ] 에러 발생 파일 확인: `grep -rn '"none"' src/ --include="*.svelte"`
   - [ ] `TodoPriority` 타입에 `"none"` 추가 또는 비교 로직을 타입에 맞게 수정

9. - [ ] **`filterMemoTitle()`, `visibleGrouped()` 호출 에러 수정**
   - [ ] `src/routes/notifications/+page.svelte:151,261` 읽기
   - [ ] `filterMemoTitle`과 `visibleGrouped`가 `$state`/`$derived` 값이면 함수 호출 `()` 제거
   - [ ] 함수로 유지가 필요하면 반환 타입을 명시하도록 수정

### Phase T1: TC 작성

> T1 해당 없음: 이 plan의 변경은 타입 선언/수정만으로 런타임 동작 변경 없음. 컴파일 게이트 검증(T2)으로 대체.

### Phase T2: TC 검증 (빌드 게이트)

10. - [ ] **`npm run check` 실행 후 0 errors 확인**
    - [ ] `npm run check` 실행
    - [ ] 21개 에러 전부 해소 확인 (warnings는 이번 scope 외)
    - [ ] 에러 잔존 시 해당 Phase로 돌아가 수정

11. - [ ] **`npm run build` 실행 후 빌드 성공 확인**
    - [ ] `npm run build` 실행
    - [ ] 빌드 성공 확인

> T3 해당 없음: 타입 선언 변경만, 런타임 로직 수정 없음.

> T4 해당 없음: E2E 브라우저 테스트 없음, 타입 선언 변경만.

> T5 해당 없음: HTTP API 변경 없음, 타입 선언 변경만.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] `npm run check` 재실행 (main 머지 후 0 errors 재확인)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:` 필드)

---

*상태: 초안 | 진행률: 0/11 (0%)*
