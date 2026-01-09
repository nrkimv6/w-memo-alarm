# Memo Alarm - TODO

> 현재 Phase: **모든 Phase 완료!** 🎉

---

## Phase 1: 기반 구축 (완료)

### 1.1 프로젝트 초기화
- [x] SvelteKit 2 프로젝트 생성
- [x] TypeScript 5 설정
- [x] Tailwind CSS 4 설정
- [x] 프로젝트 디렉토리 구조 생성

### 1.2 색상 테마 통합
- [x] app.css 생성 (gentle-notes + v0-bookmark 믹스)
- [x] CSS 변수 정의 (라이트 모드)
- [x] CSS 변수 정의 (다크 모드)

### 1.3 공통 UI 컴포넌트
- [x] Button.svelte
- [x] Input.svelte
- [x] Modal.svelte
- [x] Card.svelte
- [x] Badge.svelte (태그용)
- [x] Toggle.svelte (활성/비활성)

### 1.4 타입 정의
- [x] src/lib/types/memo.ts (Memo 인터페이스)

### 1.5 데이터 스토어
- [x] src/lib/stores/memos.svelte.ts (CRUD 로직)
- [x] src/lib/stores/filter.svelte.ts (필터 상태)
- [x] localStorage 연동

### 1.6 레이아웃
- [x] Header.svelte
- [x] +layout.svelte (기본 레이아웃)
- [x] +page.svelte (메인 페이지)

---

## Phase 2: 메모 핵심 (완료)

### 2.1 메모 CRUD
- [x] MemoForm.svelte (생성/수정 모달)
- [x] DeleteConfirmDialog.svelte

### 2.2 메모 카드
- [x] MemoCard.svelte
- [x] 호버 액션 버튼
- [x] 핀/즐겨찾기 토글

### 2.3 태그 시스템
- [x] TagInput.svelte (자동완성)
- [x] TagFilter.svelte

### 2.4 검색/필터
- [x] SearchBar.svelte
- [x] 필터 탭 UI (FilterTabs.svelte)

### 2.5 뷰 모드
- [x] 그리드/리스트 전환

---

## Phase 3: 북마크 속성 (완료)

- [x] URL 입력 UI
- [x] 이모지 피커 (EmojiPicker.svelte)
- [x] 열람 추적 (openCount)
- [x] 카드에 URL 표시

---

## Phase 4: 알림 시스템 (완료)

- [x] 알림 설정 UI (ReminderSettings.svelte)
- [x] PWA 푸시 알림 (notificationStore)
- [x] 오늘의 알림 섹션 (TodayReminders.svelte)
- [x] 자동 URL 열기

---

## Phase 5: Capacitor (완료)

- [x] Capacitor 설정
- [x] 네이티브 알림 (@capacitor/local-notifications)
- [x] Android 빌드 (app-debug.apk)

---

## Phase 6: 마무리 (완료)

- [x] 다크 모드 (themeStore + 토글)
- [x] 데이터 내보내기/가져오기 (SettingsModal)
- [x] PWA 설정 (manifest.json)

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

---

## 개선 아이디어

### P3 (낮음)
- [ ] **다국어 지원 (i18n)**: 영어 UI 추가

---

## 빌드 결과

```
Web: npm run build → build/
Android: android/app/build/outputs/apk/debug/app-debug.apk

---

## AdSense & SEO Preparation (P1)
> **Goal**: Content enrichment for AdSense approval.
- [x] **Content**: Add 'About Service' section (Usage guide, Introduction) - min 300 words ✅
- [x] **Content**: Add 'FAQ' section (Accordion UI, 5-10 questions) ✅
- [x] **Layout**: Add Footer with Privacy Policy, Terms, Contact links (Link to woory.day) ✅
- [x] **SEO**: Verify meta title, description, and OG tags ✅
- [x] **Nav**: Ensure clear link back to Main Portal (woory.day) ✅

**완료 내역** (2026-01-09):
- `/about` 페이지 대폭 확장 (2500+ 단어): 싱글 태스킹의 힘 (700+ 단어), 기억 보조 도구로서의 메모 알람 (700+ 단어) 섹션 추가
- `/contact` 페이지 FAQ 확장 (8개 → 10개 Q&A: 배터리 최적화 설정, 무료 서비스 등 추가)
- Footer 업데이트 (서비스 소개, 문의하기, Woory.day 포털 링크 추가)
- SEO 메타태그 대폭 개선 (한글 title/description, keywords, OG tags, Twitter Card, canonical)
```
