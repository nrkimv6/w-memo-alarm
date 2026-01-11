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

## Phase 8: Supabase 마이그레이션 + 백그라운드 알림 (Phase 3)
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

- [ ] **5. FCM 연동 (백그라운드 알림)**
  - [ ] Firebase 웹 앱 설정 (VAPID 키 발급)
  - [ ] `src/lib/fcm.ts` 작성
  - [ ] `static/firebase-messaging-sw.js` Service Worker 작성
  - [ ] `+layout.svelte`에서 앱 시작 시 FCM 토큰 등록
  - [ ] 참고: `common/docs/guide/background-notification-web-pwa.md`

- [ ] **6. 알림 시스템 통합**
  - [ ] 기존 Web Push (VAPID) 시스템 평가
  - [ ] 메모 알림 → `alarm_schedules` 테이블에 저장 (`app_name='memo-alarm'`)
  - [ ] 기존 Capacitor Local Notifications + Web Push 제거 또는 통합

- [ ] **7. 테스트 & 배포**
  - [ ] 로컬 테스트: 메모 CRUD, 알림 수신
  - [ ] Android 빌드 및 FCM 토큰 등록 확인
  - [ ] 백그라운드 알림 테스트
  - [ ] Cloudflare Workers 배포
  - [ ] D1 바인딩 제거 (`wrangler.toml`)

---

## 개선 아이디어

### P2 (중간)
- [ ] **캐시 초기화 기능 추가**
  > **참고**: `common/docs/plan/cache-clear-feature.md`

  - [ ] Service Worker 메시지 핸들러 추가 (`src/service-worker.ts`)
  - [ ] 캐시 초기화 함수 구현
    - 참고: `gifticon-manager/src/lib/components/settings/SettingsAppInfoSection.svelte:31-69`
  - [ ] 설정 > 앱 정보 섹션에 버튼 추가
    - "앱 업데이트 확인" 버튼
    - 안내: "새 버전이 있으면 캐시를 초기화하고 업데이트합니다. 저장된 메모는 유지됩니다."

### P3 (낮음)
- [ ] **다국어 지원 (i18n)**: 영어 UI 추가

---

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk
```
