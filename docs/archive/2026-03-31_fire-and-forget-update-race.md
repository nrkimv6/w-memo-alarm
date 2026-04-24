# fire-and-forget update() 호출의 잠재적 race condition 방지

> ⚠️ **SUPERSEDED by [2026-04-07_fix-bookmark-disappear-recurrence.md](./2026-04-07_fix-bookmark-disappear-recurrence.md)**
> PGRST116 단건 재시도 + per-memo 큐로 근본 해결을 04-07 plan에 통합. 체크리스트 토글 회귀 시나리오도 흡수.
>
> 작성일: 2026-03-31
> 대상 프로젝트: memo-alarm
> 상태: superseded
> 진행률: 0/3 (0%)
> 요약: memos store에서 `update()`를 await 없이 호출하는 6개 함수가 다른 awaited update와 동시 호출 시 version conflict를 일으킬 수 있음. 북마크 전환 버그(v0.6.6)와 동일 패턴.
> 출처: /reflect에서 자동 생성

---

## 개요

v0.6.6에서 `togglePin()`/`toggleFavorite()`의 fire-and-forget 패턴이 `convertMemoToTodo`와 race condition을 일으켜 북마크 소실 버그를 유발한 것을 수정했다. 동일 패턴을 가진 다른 함수도 잠재적으로 같은 문제를 일으킬 수 있다.

### 영향 함수 (fire-and-forget `update()`)

| 함수 | 줄 | 전송 필드 | 위험도 |
|------|-----|----------|--------|
| `toggleActive()` | 687 | `isActive` | 낮음 — 비활성화 후 즉시 다른 update는 드묾 |
| `setFolder()` | 692 | `folderId` | 낮음 — 폴더 이동 후 즉시 다른 update는 드묾 |
| `addOpenHistory()` | 701 | `openHistory` | 매우 낮음 — silent, 백그라운드 |
| `incrementOpenCount()` | 709 | `openCount` | 매우 낮음 — silent, 백그라운드 |
| `toggleChecklistItem()` | 723 | `checklist` | 중간 — 체크리스트 토글 후 메모 저장 가능 |

### 해결 접근

북마크 수정에서 사용한 "명시적 필드 전달" 방식은 1:1 대응이므로, 근본적 해결은 fire-and-forget 함수들을 async/await로 전환하거나 version conflict 시 재시도 로직을 추가하는 것이다. 하지만 현재 이 함수들이 실제 버그를 유발하는 시나리오는 보고되지 않았으므로 P2로 분류.

## 기술적 고려사항

- `togglePin`/`toggleFavorite`는 이미 v0.6.6에서 해결 (convertMemo/TodoTo 함수에서 명시 전달)
- fire-and-forget를 await로 바꾸면 UI 응답성에 영향 — 현재 optimistic update로 즉각 반영되는 UX가 깨질 수 있음
- 대안: version conflict 시 자동 재시도 (retry with latest version) 로직을 `update()` 함수 내부에 추가

---

## TODO

### Phase 1: update() 함수 내 version conflict 재시도

1. - [ ] **update() 함수에 version conflict 자동 재시도 추가**
   - [ ] `src/lib/stores/memos.svelte.ts:545-553`: PGRST116 에러 시 fetchFromSupabase 대신, 최신 version으로 1회 재시도 후 실패하면 기존 동작(fetchFromSupabase) 유지
   - [ ] 재시도 시 로컬 optimistic 상태의 변경 필드를 최신 서버 version과 병합

### Phase 2: 검증

2. - [ ] **빌드 확인**
   - [ ] `npm run build` 에러 없이 성공

3. - [ ] **시나리오 검증** (수동)
   - [ ] 핀 토글 후 즉시 할일 전환 — 두 변경 모두 서버에 반영
   - [ ] 체크리스트 토글 후 즉시 메모 저장 — 체크리스트 상태 보존

---

*상태: 초안 | 진행률: 0/3 (0%)*
