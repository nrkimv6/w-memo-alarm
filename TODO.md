# Memo Alarm - TODO

> 현재 Phase: **Phase 1-8 완료 ✅**

---

## Pending

### 🔴 메모/할일 버그 수정 (P0) — [계획서](docs/plan/2026-02-05_fix-memo-todo-bugs.md)
- [ ] **B1-1**: `memos.svelte.ts` — `reinit()` 경쟁 상태 수정 (Promise 기반 동시 호출 대기)
- [ ] **B1-2**: `folders.svelte.ts` — 동일 reinit 경쟁 조건 수정
- [ ] **B1-3**: `auth/callback/+page.svelte` — `finishLogin()` 방어 코드 추가
- [ ] **B2-1**: `filter.svelte.ts` — `getFilteredMemos()`에 todo 제외 필터 추가
- [ ] **B2-2**: `+page.svelte` (홈) — `pinnedMemos`에서 todo 제외
- [ ] **B2-3**: `+page.svelte` (홈) — `favoriteMemos`에서 todo 제외
- [ ] **B2-4**: `+page.svelte` (홈) — `recentMemos`에서 todo 제외
- [ ] **V-1**: 빌드 성공 확인
- [ ] **V-2**: 커밋 및 푸시

---

## 관련 계획서

### ⚙️ 코드 정리 (P2)
- [x] **$derived 패턴 오류 수정** — [2026-02-04_derived-pattern-fix.md](docs/plan/2026-02-04_derived-pattern-fix.md) ✅ 2026-02-04 완료
  - MA-1 (MEDIUM): $derived 패턴 5개소 수정 완료
  - `$derived(() => {})` → `$derived.by(() => {})`로 변경
  - 호출부 괄호 제거
  - 커밋: 1c8ad9a

---

## Phase 7: Auth 통합 ✅
> **참고**: `memo-alarm/docs/archive/2026-01-12_memo-alarm-online-first.md`
> **타입**: 네이티브 앱 (모바일)
> **상태**: ✅ 완료 (2026-01-12, 2026-01-20 수정 완료)
> **아키텍처**: D1 + localStorage (offline-first) → Supabase (online-first)

### 완료된 작업

#### 1. Auth Worker 등록 ✅
- [x] `auth-worker/src/config.ts`에 `memo-alarm` 설정 완료
  - appId: `memo-alarm`
  - origins: `https://memo.woory.day`, `http://localhost:5179`
  - android.scheme: `com.woory.memoalarm`

#### 2. Supabase 설정 ✅
- [x] `src/lib/services/supabase.ts` 생성
- [x] `.env` 파일에 Supabase 환경변수 추가
- [x] Supabase DB 마이그레이션 파일 작성 (`data/migrations/004_supabase_online_first.sql`)

#### 3. Auth 스토어 ✅
- [x] `src/lib/stores/auth.svelte.ts` 생성
  - Google/Kakao 로그인 지원
  - Auth Worker 통합
  - 자동 동기화 기능

#### 4. 로그인 UI ✅
- [x] 설정 페이지에 로그인 UI 통합
  - Google/Kakao 로그인 버튼
  - 로그인 상태 표시
  - 동기화 상태 표시

#### 5. 콜백 페이지 ✅
- [x] `src/routes/auth/callback/+page.svelte` 생성
  - 웹/네이티브 콜백 처리
  - 세션 복원

#### 6. 데이터 동기화 ✅
- [x] **메모 및 폴더 데이터 Supabase 동기화**
  - `src/lib/stores/memos.svelte.ts` 완전 리팩토링
    - Supabase CRUD (async)
    - Realtime 구독 (INSERT/UPDATE/DELETE)
    - 버전 기반 충돌 감지
    - 오프라인 폴백 (localStorage)
  - `src/lib/stores/folders.svelte.ts` 리팩토링
    - Supabase CRUD + Realtime
    - 오프라인 지원
  - D1 코드 제거 (`sync.svelte.ts`, `api/sync/+server.ts`)

#### 7. Native 설정 ✅
- [x] `capacitor.config.ts`: `androidScheme: 'com.woory.memoalarm'` 설정
- [x] Deep Link 설정 완료

#### 8. 테스트 ✅
- [x] 빌드 성공 확인
- [x] Capacitor 모듈 외부화
- [x] 접근성 개선

---

## Phase 8: Supabase 마이그레이션 + 백그라운드 알림 ✅
> **상태**: ✅ 완료 (2026-02-03)

### 완료된 작업
- [x] FCM (Firebase Cloud Messaging) 통합 — `src/lib/fcm.ts`, `static/firebase-messaging-sw.js`
- [x] alarm_schedules 테이블 연동 — `src/lib/services/alarmSchedules.ts`
- [x] Service Worker 기반 메모 알림 스케줄 — `src/service-worker.ts`
- [x] 개발자 모드 알림 디버그 UI — `src/routes/settings/+page.svelte`
- [x] Safe Area / Android 네비바 겹침 수정 — `src/app.css`, `BottomNav.svelte` 등
- [x] 코드 품질 개선 — console 정리, SW 메시지 상수화, 시간 포맷 유틸리티
- [x] 참고: `docs/ARCHITECTURE_FCM.md`, `docs/archive/2026-02-02_memo-notification-fix-plan.md`

---

## 개선 아이디어

### ✅ P2 (중간) - 완료 (2026-01-19)
- [x] **캐시 초기화 기능 추가**
  > **참고**: `common/docs/plan/cache-clear-feature.md`

  - [x] Service Worker 메시지 핸들러 추가 (`src/service-worker.ts`)
  - [x] 캐시 초기화 함수 구현
  - [x] 설정 > 앱 정보 섹션에 버튼 추가
    - "앱 업데이트 확인" 버튼

### P3 (낮음)
- [ ] **다국어 지원 (i18n)**: 영어 UI 추가

---

## 버전 관리 (P0)
> **참고**: `common/docs/plan/versioning-implementation.md`, `docs/VERSIONING.md`
> **상태**: ✅ Phase 0-1 완료 (config.ts, CHANGELOG.md 생성 완료)
> **현재 버전**: 0.0.1
> **사용법**: `cd memo-alarm && ..\common\scripts\bump-version-template.ps1 -Version "0.1.0"`

- [x] **1. config.ts 생성**
  - [x] `src/lib/config.ts` 생성 완료
  - [x] APP_VERSION, CACHE_VERSION 상수 정의

- [x] **2. CHANGELOG.md 생성**
  - [x] 초기 버전 0.0.1 기록

- [x] **3. 설정 페이지에 버전 표시**
  - [x] `/settings` 페이지에 `v{APP_VERSION}` 표시 완료 (2026-01-30)

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
