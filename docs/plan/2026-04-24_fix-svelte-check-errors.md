# fix: memo-alarm svelte-check 에러 수정

> 출처: /reflect에서 자동 생성
> 작성일시: 2026-04-24 14:30
> 기준커밋: 3772a31
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> 유형: fix
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/12 (0%)
> 요약: `npm run check`(svelte-check) 실행 시 타입/Svelte 에러 발생 — 4개 카테고리 에러를 수정하여 빌드 정합성 확보

---

## 개요

`npm run check` 실행 시 에러가 존재함 (대부분 pre-existing 에러).
빌드는 성공하지만 타입 안전성이 손상되어 있으며, CI/CD 또는 향후 기능 추가 시 실제 타입 에러를 놓칠 위험이 있음.

### 에러 카테고리 (4종)

> 재검토 수정 (2026-04-24): Category A(`__APP_VERSION__`)와 B(Web Speech API)는 실제 에러 미존재.
> — A: check_log에 없음. B: tsconfig `lib: ["DOM"]`에 SpeechRecognition 이미 포함.
> — Category F: `steps 순서`, `"none"` 비교는 현재 코드 미존재. filterMemoTitle/visibleGrouped + auth/callback 에러 추가.

| # | 카테고리 | 에러 수 | 대표 파일 |
|---|---------|---------|----------|
| C | Modal/컴포넌트 props에 `"size"` 미존재 (`$$ComponentProps`) | 5 | `MemoDetailModal.svelte`, `PinLockModal.svelte`, `ScheduledRemindersModal.svelte`, `ShareModal.svelte`, `SwipeGuideModal.svelte` |
| D | EmojiPicker `emoji` prop 미존재 (`Props`) | 2 | `MemoForm.svelte`, `share/+page.svelte` |
| E | Icon `"title"` prop 미존재 (`IconProps`) | 4 | `MemoCard.svelte` ×4 |
| F | 기타 타입 에러 (Reminder.id 누락, $derived 값 함수 호출, tokens.error 타입 미존재) | 4 | `QuickMemoInput.svelte`, `notifications/+page.svelte`, `auth/callback/+page.svelte` |

## 기술적 고려사항

- 에러 C: `Modal.svelte` Props에 `size` 미선언 — 호출처 5곳이 `size="sm|md|lg"` 전달 중
- 에러 D: `EmojiPicker.svelte` Props는 `selected`이나 호출처가 `emoji=` 사용 — 호출처 변경으로 해결
- 에러 E: `lucide-svelte` `IconProps`에 `title` 미포함 — `aria-label`로 대체 (접근성 개선)
- 에러 F-1: `getDefaultReminder()` 반환 `DefaultReminderSettings`는 `id` 없음 — `Reminder` 타입에 `id: string` 필수
- 에러 F-2: `notifications/+page.svelte`의 `filterMemoTitle`, `visibleGrouped`는 `$derived.by()` 값 (함수 아님) — `()` 제거
- 에러 F-3: `auth/callback/+page.svelte`의 `tokens` 합산 타입에 `error` 미포함 — type assertion 필요
- `npm run check` 빌드 게이트가 0 errors여야 clean 상태
- 수정 중 warnings는 이번 scope 외 — errors만 대상

---

## TODO

### Phase 0: Worktree 준비

0. - [ ] **worktree 준비 상태를 문서에 고정** — `/implement` 진입 게이트
   - [ ] `plan`: `> branch:`, `> worktree:`, `> worktree-owner:` 슬롯 유지 (blank = 신규 초기 상태)
   - [ ] `plan`: worktree 생성 또는 재개는 `/implement` 또는 `plan-runner` owner flow가 담당
   - [ ] `plan`: worktree cwd → `D:/work/project/service/wtools/memo-alarm` 고정 확인

### Phase 1: 컴포넌트 Props 타입 수정 (에러 C, D, E)

3. - [ ] **Modal `size` prop 추가** — `$$ComponentProps` 에러 5건 수정
   - [ ] `src/lib/components/ui/Modal.svelte:7-21` 읽기: 현재 Props `{open, title, children, footer, class, useHistory}` 확인
   - [ ] `src/lib/components/ui/Modal.svelte` Props에 `size?: 'sm' | 'md' | 'lg' | 'xl'` 추가
   - [ ] `src/lib/components/ui/Modal.svelte:83` `'bg-card w-full max-w-lg rounded-xl ...'` → size 분기로 교체
     - size='sm' → `max-w-sm`, size='md' → `max-w-md`, size='lg' → `max-w-lg`, size='xl' → `max-w-xl`, 미지정 → `max-w-lg` (기존값 유지)
   - [ ] 5개 사용처 에러 해소 확인: `MemoDetailModal.svelte:169`(lg), `PinLockModal.svelte:175`(sm), `ScheduledRemindersModal.svelte:87`(md), `ShareModal.svelte:122`(md), `SwipeGuideModal.svelte:25`(md)

4. - [ ] **EmojiPicker 사용처를 `selected` prop으로 변경** — `Props` 에러 2건 수정
   - [ ] `src/lib/components/memo/EmojiPicker.svelte` Props: `{selected, onSelect}` 확인 (현재 `emoji` alias 없음)
   - [ ] `src/lib/components/memo/MemoForm.svelte:301`: `<EmojiPicker {emoji} onSelect=...` → `<EmojiPicker selected={emoji} onSelect=...`
   - [ ] `src/routes/share/+page.svelte:230`: `<EmojiPicker {emoji} onSelect=...` → `<EmojiPicker selected={emoji} onSelect=...`

5. - [ ] **Icon `title` prop → `aria-label`로 변경** — `IconProps` 에러 4건 수정
   - [ ] `src/lib/components/memo/MemoCard.svelte:108`: `<CloudOff ... title="로컬에 저장됨 - 동기화 대기" />` → `aria-label="로컬에 저장됨 - 동기화 대기"`
   - [ ] `src/lib/components/memo/MemoCard.svelte:110`: `<RefreshCw ... title="동기화 중..." />` → `aria-label="동기화 중..."`
   - [ ] `src/lib/components/memo/MemoCard.svelte:154`: CloudOff 동일 패턴 → `aria-label`
   - [ ] `src/lib/components/memo/MemoCard.svelte:156`: RefreshCw 동일 패턴 → `aria-label`

### Phase 2: 기타 타입 에러 수정 (에러 F)

6. - [ ] **`Reminder.id` 누락 수정** — `QuickMemoInput.svelte:43` 에러
   - [ ] `src/lib/components/memo/QuickMemoInput.svelte:42-44` 읽기: `data.reminder = { ...defaultReminder }` 확인
   - [ ] `getDefaultReminder()` 반환 타입 `DefaultReminderSettings` 확인: `{enabled, time, days, autoOpen}` — `id` 없음
   - [ ] `src/lib/components/memo/QuickMemoInput.svelte:43`: `data.reminder = { ...defaultReminder }` → `data.reminder = { ...defaultReminder, id: crypto.randomUUID() }`

7. - [ ] **`filterMemoTitle`, `visibleGrouped` 함수 호출 에러 수정** — `notifications/+page.svelte` 2건
   - [ ] `src/routes/notifications/+page.svelte:56,74` 읽기: `$derived.by()` 반환값 — 함수가 아닌 값 확인
   - [ ] `src/routes/notifications/+page.svelte:151`: `{filterMemoTitle()}` → `{filterMemoTitle}`
   - [ ] `src/routes/notifications/+page.svelte:261`: `{#each visibleGrouped()[dateKey] as record (record.id)}` → `{#each visibleGrouped[dateKey] as record (record.id)}`

8. - [ ] **`tokens.error` 타입 에러 수정** — `auth/callback/+page.svelte` 2건
   - [ ] `src/routes/auth/callback/+page.svelte:95` 읽기: `const tokens = { ...hashTokens, ...queryMetadata }` — 합산 타입에 `error` 없음 확인
   - [ ] `src/routes/auth/callback/+page.svelte:107`: `tokens?.error` → `(tokens as Record<string, string | undefined>)['error']`
   - [ ] `src/routes/auth/callback/+page.svelte:108`: `tokens.error` → `(tokens as Record<string, string | undefined>)['error']`

### Phase T1: TC 작성

> T1 해당 없음: 이 plan의 변경은 타입 선언/수정만으로 런타임 동작 변경 없음. 컴파일 게이트 검증(T2)으로 대체.

### Phase T2: TC 검증 (빌드 게이트)

9. - [ ] **`npm run check` 실행 후 0 errors 확인**
   - [ ] `memo-alarm` 디렉토리에서 `npm run check` 실행
   - [ ] 에러 전부 해소 확인 (warnings는 이번 scope 외)
   - [ ] 에러 잔존 시 해당 Phase로 돌아가 수정

10. - [ ] **`npm run build` 실행 후 빌드 성공 확인**
    - [ ] `npm run build` 실행
    - [ ] 빌드 성공 확인

### Phase R: 재발 경로 분석 (fix: plan 필수)

11. ☐ **수정 대상의 모든 호출/참조 경로 열거**
    - ☐ `<Modal size=` Grep — 5건 수정 완료 외 추가 사용처 없는지 확인
    - ☐ `<EmojiPicker` Grep — 2건 외 `{emoji}` 잔존 사용처 없는지 확인
    - ☐ lucide 아이콘에 `title=` Grep (`--include="*.svelte"`) — 추가 icon title 에러 없는지 확인
    - ☐ `getDefaultReminder()` 호출 전수 Grep — `id` 미추가 위치 없는지 확인
    - ☐ 각 경로별 방어여부 | 근거 표 작성

12. ☐ **미방어 경로 수정**
    - ☐ 미방어 경로가 있으면 해당 경로에 수정 적용
    - ☐ 모든 경로 방어 완료 확인 ("전체 방어 완료" 명시, "근본 수정" 표현 금지)

> T3 해당 없음: 타입 선언 변경만, 런타임 로직 수정 없음.

> T4 해당 없음: memo-alarm 프로젝트 내 `tests/**/*e2e*`, `tests/**/*integration*` 파일 0건 확인 (node_modules 제외). 런타임 동작 변경 없음.

> T5 해당 없음: `tests/**/*http*`, `tests/**/*api*` 파일 0건 확인. HTTP API 변경 없음, 타입 선언 변경만.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

Z. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] root dirty stash/apply (if needed)
   - [ ] `npm run check` 재실행 (main 머지 후 0 errors 재확인)
   - [ ] `npm run build` 재실행 (main 머지 후 빌드 성공 재확인)
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거 (`> branch:`, `> worktree:`, `> worktree-owner:` 필드)

---

*상태: 검토완료 | 진행률: 0/12 (0%)*
