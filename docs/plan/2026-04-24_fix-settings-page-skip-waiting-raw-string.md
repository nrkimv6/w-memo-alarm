# fix: settings/+page.svelte SKIP_WAITING postMessage raw string 교체

> 작성일시: 2026-04-24
> 기준커밋: (현재 main HEAD)
> 대상 프로젝트: memo-alarm
> 상태: 검토완료
> branch:
> worktree:
> worktree-owner:
> 진행률: 0/0 (0%)
> 요약: `REGISTER/REMOVE_TODO_NOTIFICATIONS` fix와 동일 패턴 — `routes/settings/+page.svelte:144`에서 메인 스레드 발신 측이 `type: 'SKIP_WAITING'`을 raw string으로 postMessage한다. `SW_MSG.SKIP_WAITING` 상수로 교체하면 타이포 위험을 제거할 수 있다.
> 출처: /reflect에서 자동 생성

---

## 개요

`src/routes/settings/+page.svelte:144`는 SW 대기 인스턴스에 `{ type: 'SKIP_WAITING' }` 메시지를 raw string으로 postMessage한다.

```typescript
if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
```

`swMessages.ts`에는 이미 `SKIP_WAITING: 'SKIP_WAITING'` 상수가 존재한다. 이번 `REGISTER/REMOVE_TODO_NOTIFICATIONS` fix와 동일 패턴으로 메인 스레드 발신 측에서 raw string 대신 `SW_MSG.SKIP_WAITING`을 사용하면 일관성을 갖춘다.

프로젝트 전체에서 메인 스레드 → SW postMessage에 raw string을 사용하는 마지막 잔존 케이스다.

## 기술적 고려사항

- `swMessages.ts`를 SW scope에서 import하는 것은 번들 제약 때문에 피하므로, SW(`service-worker.ts`) 수신 측(`if (event.data?.type === 'SKIP_WAITING')`)은 raw string 그대로 유지한다 (기존 정책 동일).
- 변경 대상은 **메인 스레드 발신 측**(`settings/+page.svelte:144`)만이다.
- 변경 범위가 1줄로 매우 작다.

---

## TODO

### Phase 1: SKIP_WAITING 발신 측 교체

1. - [ ] **`src/routes/settings/+page.svelte`에 `SW_MSG` import 추가 및 raw string 교체**
   - [ ] 파일 상단 import 블록에 `import { SW_MSG } from '$lib/constants/swMessages';` 추가
   - [ ] L144 `type: 'SKIP_WAITING'`를 `type: SW_MSG.SKIP_WAITING`으로 교체

2. - [ ] **`src/service-worker.ts` 수신 측 주석 보강 (raw string 유지, 번들 제약)**
   - [ ] SKIP_WAITING 수신부(`if (event.data?.type === 'SKIP_WAITING')` 또는 `addEventListener('message')`) 바로 위에 주석 `// matches SW_MSG.SKIP_WAITING (raw string retained: SW bundle cannot import $lib)` 추가

### Phase R: 재발 경로 분석 (fix: plan 필수)

3. - [ ] **메인 스레드 발신 측 raw string postMessage 잔존 여부 전수 확인**
   - [ ] `rg "postMessage.*type.*'" src/ --glob '*.ts' --glob '*.svelte'` 실행 후 service-worker.ts 제외 결과 0건 확인
   - [ ] 전체 방어 완료 명시

### Phase T1: TC 작성

> T1 해당 없음: memo-alarm은 TypeScript 프런트 전용이며 프로젝트 테스트 프레임워크 미구성. 단순 상수 교체.

### Phase T2: TC 실행 및 수정

> T2 해당 없음: T1 미작성이므로 실행 대상 없음.

### Phase T3: 재현/통합 TC

> T3 해당 없음: 설정값/상수 추출 변경이며 runtime 동작 불변. expand-todo 규칙의 "순수 설정값 변경만" 스킵 허용 조건.

### Phase T4: E2E 테스트

> T4 해당 없음: tests/ 디렉토리 미존재, E2E 인프라 없음.

### Phase T5: HTTP 통합 테스트

> T5 해당 없음: SvelteKit + Supabase 구성, 자체 백엔드 HTTP API 부재.

### Phase Z: Post-Merge Cleanup (/merge-test owner)

4. - [ ] **post-merge 정리 확인** — `/merge-test` owner
   - [ ] main merge 시도
   - [ ] T4/T5 해당 없음 재판정
   - [ ] worktree remove
   - [ ] branch remove
   - [ ] header meta 제거

## 작업 수 요약

- Phase 1: SKIP_WAITING 교체 (2 parents / 3 children)
- Phase R: 재발 경로 전수 확인 (1 parent / 2 children)
- Phase T1~T5: 블록쿼트만 (체크박스 0)
- Phase Z: Post-Merge Cleanup (1 parent / 5 children)
- 총 4 parents / 10 children = 14 체크박스

*상태: 초안 | 진행률: 0/14 (0%)*
