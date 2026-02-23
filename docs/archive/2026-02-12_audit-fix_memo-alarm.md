---
> 완료일: 2026-02-23
> 아카이브됨
> 진행률: 5/5 (100%)
---

# memo-alarm 감사 수정 계획서

> 출처: `common/docs/audit/2026-02-12_codebase-audit.md`
> 우선순위: P1
> 상태: 구현완료

## 항목

### [x] 1. 🟡 memos.svelte.ts 리팩토링 (1356줄)
- **위치**: `src/lib/stores/memos.svelte.ts`
- **완료**: 3개 모듈 분리 — `utils/memoIdGenerator.ts` (ID 생성), `utils/reminderHelpers.ts` (리마인더 유틸), `services/memoMapper.ts` (DB 매핑) — 약 166줄 이동

### 2. [x] localStorage 캐시 에러 무시
- **위치**: `src/lib/stores/memos.svelte.ts:123-145`
- **작업**: 캐시 에러 시 적절한 폴백 및 로깅
- **완료**: loadCacheFromStorage catch에 console.warn 추가

### 3. [x] any 타입 사용
- **위치**: `src/lib/stores/memos.svelte.ts:196-202`
- **작업**: 구체적 타입으로 교체
- **완료**: SupabaseMemoRow 타입 정의, supabaseToMemo/memoToSupabase 타입 개선

### [x] 4. 🟡 +page.svelte 577줄
- **위치**: `src/routes/+page.svelte`
- **완료**: 5개 대시보드 섹션 컴포넌트 분리 — `PinnedMemosSection`, `TodayTodosSection`, `FavoriteMemosSection`, `UpcomingRemindersSection`, `RecentMemosSection` — `src/lib/components/dashboard/` 하위로 추출. 577줄 → 467줄로 축소

### 5. [x] wrangler.toml 환경변수 누락
- **작업**: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY 등 추가
- **완료**: [vars] 섹션 추가
