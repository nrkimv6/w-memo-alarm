# Memo Alarm - TODO

> 현재 Phase: **Phase 1-7 완료 ✅, Phase 8 (Supabase 마이그레이션) 진행 중**

---

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

## Phase 8: Supabase 마이그레이션 + 백그라운드 알림 (🚫 Claude 자동 실행 불가 - 권장 금지)
> **경고**: Firebase Console 설정, DB 마이그레이션 등 수동 작업 필요. Claude가 "다음 작업"으로 이것을 권하지 말 것.
> **참고**: `common/docs/guide/background-notification-system.md`
> **목표**: D1 → Supabase 이동, 서버 기반 백그라운드 알림 통합
> **상태**: ✅ line-minder 구현 완료 (재사용 가능)
> **현황**: memo-alarm은 이미 Web Push (VAPID) + Cron 시스템 보유

**✅ 이미 구현된 인프라 (line-minder에서):**
- Supabase DB 스키마 (멀티 앱 지원, `app_name='memo-alarm'`로 구분)
- Edge Function `send-notifications` (FCM API v1, 멀티 앱 지원)
- pg_cron 설정 (1분마다 자동 실행, 모든 앱 공통)
- 참고: `common/docs/guide/background-notification-multi-app.md`

**기존 시스템 통합 고려:**
- memo-alarm은 이미 **Web Push (VAPID) + D1 Cron** 시스템 보유
- 옵션 1: 기존 Web Push 유지 + Supabase 마이그레이션 (DB만)
- 옵션 2: FCM 기반 통합 알림 시스템으로 완전 전환

**Firebase 설정:**
- **권장**: line-minder와 동일한 Firebase 프로젝트 사용
- Firebase Console → Android 앱 추가: `com.woory.memoalarm`
- `google-services.json` 다운로드 → `android/app/` 복사

---

- [ ] **1. Firebase 설정**
  - [ ] Firebase Console에서 `com.woory.memoalarm` Android 앱 등록
  - [ ] `google-services.json` 다운로드 및 `android/app/` 복사
  - [ ] (Firebase 프로젝트는 line-minder와 공유)

- [ ] **2. Supabase 프로젝트 설정**
  - [ ] line-minder와 동일한 Supabase 프로젝트 사용 (이미 설정됨)
  - [ ] `.env` 파일에 Supabase 환경변수 추가
  - [ ] D1 데이터 백업 (기존 데이터 추출)

- [ ] **3. DB 마이그레이션**
  - [ ] Supabase에 앱 데이터용 테이블 재생성 (기존 D1 스키마 기반)
  - [ ] 알림용 테이블은 이미 존재 (`user_devices`, `alarm_schedules`, `notification_logs`)
  - [ ] D1 데이터 → Supabase 이전

- [ ] **4. 앱 코드 수정**
  - [ ] `src/lib/db.ts`: D1 Client → Supabase Client 교체
  - [ ] 모든 쿼리 SQLite → Postgres 문법 변경
  - [ ] Supabase RLS (Row Level Security) 설정

- [x] **5. FCM 연동 (백그라운드 알림)** ✅ (2026-01-19)
  - [x] Firebase 웹 앱 설정 - 공통 .env 사용 (line-minder와 동일 프로젝트)
  - [x] `src/lib/fcm.ts` 작성
  - [x] `static/firebase-messaging-sw.js` Service Worker 작성
  - [x] `+layout.svelte`에서 앱 시작 시 FCM 토큰 등록

- [x] **6. 알림 시스템 통합** ✅ (2026-01-19)
  - [x] 메모 알림 → `alarm_schedules` 테이블에 저장 (`app_name='memo-alarm'`)
  - [x] `src/lib/services/alarmSchedules.ts` 작성
  - [x] `memos.svelte.ts`에서 알림 자동 생성/갱신/삭제
  - [ ] 기존 Capacitor Local Notifications 유지 (병행 사용)

- [ ] **7. 테스트 & 배포**
  - [ ] 로컬 테스트: 메모 CRUD, 알림 수신
  - [ ] Android 빌드 및 FCM 토큰 등록 확인
  - [ ] 백그라운드 알림 테스트
  - [ ] Cloudflare Workers 배포
  - [ ] D1 바인딩 제거 (`wrangler.toml`)

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
> **상태**: 대기 (공통 스크립트 완료 후 진행)
> **초기 버전**: 0.1.0

- [ ] **1. 공통 스크립트 복사**
  - [ ] `common/scripts/bump-version.ps1` → 프로젝트 루트 복사

- [ ] **2. config.ts 생성**
  - [ ] `src/lib/config.ts` 생성
    ```typescript
    export const APP_VERSION = '0.1.0';
    export const CACHE_VERSION = `memo-alarm-v${APP_VERSION}`;
    ```

- [ ] **3. 버전 파일 업데이트**
  - [ ] `package.json` version → `0.1.0`
  - [ ] `android/app/build.gradle` versionName → `"0.1.0"`, versionCode → `1`

- [ ] **4. CHANGELOG.md 생성**
  - [ ] 초기 버전 기록

- [ ] **5. 설정 페이지에 버전 표시**
  - [ ] `/settings` 페이지에 `v{APP_VERSION}` 표시

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
