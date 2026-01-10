# Memo Alarm - TODO

> 현재 Phase: **Phase 1-6 완료, Phase 7 (Auth 통합) 계획 단계**

---

## Phase 7: Auth 통합 (계획)
> **참고**: `common/docs/plan/2026-01-08_auth-integration-plan.md`
> **타입**: 네이티브 앱 (모바일)
> **상태**: 로컬 파일 백업 → 실시간 동기화 도입

### 1. Auth Worker 등록
- [ ] `auth-worker/src/config.ts`에 `memo-alarm` 설정 확인
  - appId: `memo-alarm`
  - origins: `https://memo.woory.day`, `http://localhost:5173`
  - android.scheme: `com.woory.memoalarm`

### 2. Supabase 설정
- [ ] `src/lib/services/supabase.ts` 생성
  - 참고: `gifticon-manager/src/lib/supabase.ts`
- [ ] `.env` 파일에 Supabase 환경변수 추가

### 3. Auth 스토어
- [ ] `src/lib/stores/auth.svelte.ts` 생성
  - 참고: `gifticon-manager/src/lib/stores/auth.ts`

### 4. 로그인 페이지
- [ ] `src/routes/user/login/+page.svelte` 생성
  - 또는 설정 모달 내 통합
  - 참고: 계획 문서 4.3절

### 5. 콜백 페이지
- [ ] `src/routes/auth/callback/+page.svelte` 생성
  - 참고: `gifticon-manager/src/routes/auth/callback/+page.svelte`

### 6. 데이터 동기화
- [ ] **메모 및 태그 데이터 Supabase 동기화**
  - `src/lib/stores/memos.svelte.ts` 업데이트
  - Supabase `memos` 테이블 생성 필요

### 7. Native 설정
- [ ] `capacitor.config.ts`: `androidScheme: 'com.woory.memoalarm'` 확인
- [ ] `android/app/src/main/AndroidManifest.xml`: Deep Link Intent Filter 추가

### 8. 테스트
- [ ] 웹/네이티브 로그인
- [ ] 메모 동기화 확인
- [ ] 오프라인 → 온라인 전환 시 동기화

---

## 개선 아이디어

### P3 (낮음)
- [ ] **다국어 지원 (i18n)**: 영어 UI 추가

---

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
