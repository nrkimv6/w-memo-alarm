# Memo Alarm - Phase별 개발 계획

> PRD.md 섹션 7을 확장한 세부 구현 계획

---

## Phase 1: 기반 구축

### 1.1 프로젝트 초기화
- [ ] SvelteKit 2 프로젝트 생성 (`npm create svelte@latest`)
- [ ] TypeScript 5 설정
- [ ] Tailwind CSS 4 설정
- [ ] 프로젝트 구조 생성

```
memo-alarm/
├── src/
│   ├── lib/
│   │   ├── components/     # 공통 컴포넌트
│   │   │   ├── ui/         # 기본 UI (Button, Input, Modal)
│   │   │   └── memo/       # 메모 관련 컴포넌트
│   │   ├── stores/         # Svelte stores
│   │   ├── types/          # TypeScript 타입
│   │   └── utils/          # 유틸리티 함수
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   └── app.css             # 글로벌 스타일 (두 프로젝트 믹스)
├── static/
└── svelte.config.js
```

### 1.2 색상 테마 통합
- [ ] gentle-notes HSL 색상 기반 (index.css:10-76)
- [ ] v0-bookmark sketchy 스타일 포인트 색상 추가
- [ ] 라이트/다크 모드 CSS 변수

```css
/* 핵심 색상 (gentle-notes 베이스) */
--background: 40 33% 97%;      /* warm cream */
--primary: 150 35% 40%;         /* sage green */
--secondary: 15 75% 65%;        /* warm coral (pins) */

/* v0-bookmark 포인트 색상 */
--link: 210 50% 63%;            /* #6b9bd1 - URL */
--pin-highlight: 25 70% 70%;    /* #e8a87c - 핀/즐겨찾기 */
```

### 1.3 공통 UI 컴포넌트
- [ ] Button (btn-primary, btn-secondary, btn-ghost)
- [ ] Input (sketchy-input 스타일)
- [ ] Modal (sketchy-modal 애니메이션)
- [ ] Card (memo-card + hover 효과)
- [ ] Badge/Tag (memo-tag + sketchy-tag)
- [ ] Toggle Switch (v0-bookmark 스타일)

### 1.4 레이아웃 구성
- [ ] Header 컴포넌트 (로고, 검색, 설정, 추가 버튼)
- [ ] 메인 레이아웃 (필터 탭 + 컨텐츠 영역)
- [ ] FAB (모바일용 플로팅 버튼)

### 1.5 데이터 스토어 설정
- [ ] Memo 타입 정의 (PRD 섹션 4)
- [ ] memosStore (CRUD 로직)
- [ ] filterStore (검색, 필터 상태)
- [ ] localStorage 연동

---

## Phase 2: 메모 핵심 기능

### 2.1 메모 CRUD
- [ ] 메모 생성 모달 (MemoForm)
  - 제목 입력 (sketchy-input)
  - 내용 입력 (textarea)
  - 저장/취소 버튼
- [ ] 메모 수정 (기존 데이터 로드)
- [ ] 메모 삭제 (확인 다이얼로그)
- [ ] 메모 목록 조회

### 2.2 메모 카드 (MemoCard)
참조: gentle-notes MemoCard.tsx + v0-bookmark bookmark-item.tsx

- [ ] 기본 레이아웃
  - 제목 (line-clamp-2)
  - 내용 미리보기 (line-clamp-3)
  - 시간 표시 (상대 시간)
- [ ] 핀 표시 (memo-card-pinned 스타일)
- [ ] 호버 액션 버튼 (핀, 즐겨찾기, 편집, 삭제)
- [ ] 활성/비활성 토글 (v0-bookmark 스타일)

### 2.3 태그 시스템
- [ ] 태그 입력 UI (자동완성)
- [ ] 다중 태그 지원
- [ ] 태그 칩 표시 (memo-tag + sketchy-tag)
- [ ] 태그 필터 컴포넌트 (TagFilter)

### 2.4 핀/즐겨찾기
- [ ] isPinned 토글
- [ ] isFavorite 토글
- [ ] 핀된 메모 상단 정렬
- [ ] 즐겨찾기 별표 표시

### 2.5 검색/필터
- [ ] SearchBar 컴포넌트 (제목, 내용, 태그 통합 검색)
- [ ] 필터 탭 (전체, 핀됨, 즐겨찾기)
- [ ] 필터 상태 관리 (filterStore)

### 2.6 뷰 모드
- [ ] 그리드 뷰 (gentle-notes 스타일)
- [ ] 리스트 뷰 (v0-bookmark 스타일)
- [ ] 뷰 모드 토글 버튼

---

## Phase 3: 북마크 속성

### 3.1 URL 입력 UI
- [ ] MemoForm에 URL 섹션 추가 (선택적)
- [ ] URL 입력 필드 (sketchy-input)
- [ ] URL 유효성 검사

### 3.2 이모지 선택
- [ ] 이모지 피커 컴포넌트
- [ ] 기본 이모지 세트 (📄 📁 🔗 📌 📚 ...)
- [ ] 선택된 이모지 표시

### 3.3 열람 추적
- [ ] openCount 카운터
- [ ] openHistory 배열 관리
- [ ] 열람 횟수 표시 (카드에 작은 숫자)

### 3.4 링크 열기 동작
- [ ] 카드에서 URL 클릭 시 새 탭 열기
- [ ] 열람 카운트 증가
- [ ] sketchy-link 호버 효과

### 3.5 카드에 URL 정보 표시
- [ ] 이모지 + URL 도메인 (truncate)
- [ ] 열람 횟수 배지
- [ ] 빠른 열기 버튼

---

## Phase 4: 알림 시스템

### 4.1 알림 설정 UI
- [ ] MemoForm에 알림 섹션 추가 (선택적)
- [ ] 날짜 선택 (date input)
- [ ] 시간 선택 (time input)
- [ ] 반복 설정 (none, daily, weekly, monthly)

### 4.2 알림 스케줄러
- [ ] 알림 데이터 저장 (alarm 객체)
- [ ] 알림 활성/비활성 토글
- [ ] 예정된 알림 목록 조회

### 4.3 PWA 푸시 알림
- [ ] Service Worker 설정
- [ ] Notification API 권한 요청
- [ ] 알림 표시 (제목, 내용)
- [ ] 알림 클릭 동작

### 4.4 오늘의 알림 섹션
- [ ] 오늘 예정된 알림 필터
- [ ] 알림 카드 컴포넌트
- [ ] 알림 시간순 정렬

### 4.5 자동 URL 열기
- [ ] autoOpenOnAlarm 옵션
- [ ] 알림 시 URL 자동 오픈 로직
- [ ] 옵션 토글 UI

### 4.6 카드에 알림 정보 표시
- [ ] 알림 시간 표시 (⏰ 아이콘)
- [ ] 반복 여부 표시 (🔁 아이콘)

---

## Phase 5: Capacitor (모바일)

### 5.1 Capacitor 설정
- [ ] Capacitor 6 설치 및 초기화
- [ ] Android 플랫폼 추가
- [ ] iOS 플랫폼 추가
- [ ] capacitor.config.ts 설정

### 5.2 네이티브 알림
- [ ] @capacitor/local-notifications 설치
- [ ] 알림 권한 요청 (네이티브)
- [ ] 알림 스케줄링
- [ ] 알림 탭 핸들링

### 5.3 빌드 및 테스트
- [ ] Android 빌드 (Android Studio)
- [ ] iOS 빌드 (Xcode)
- [ ] 실기기 테스트

---

## Phase 6: 마무리

### 6.1 다크 모드
- [ ] 다크 테마 CSS 변수 (gentle-notes .dark 참조)
- [ ] 테마 토글 버튼
- [ ] 시스템 설정 감지 (prefers-color-scheme)
- [ ] localStorage 테마 저장

### 6.2 데이터 관리
- [ ] 데이터 내보내기 (JSON)
- [ ] 데이터 가져오기 (JSON 파싱)
- [ ] IndexedDB 마이그레이션 (선택)

### 6.3 온보딩
- [ ] 첫 방문 감지
- [ ] 온보딩 모달/가이드
- [ ] 샘플 메모 생성

### 6.4 PWA 설정
- [ ] vite-plugin-pwa 설정
- [ ] manifest.json
- [ ] 아이콘 세트
- [ ] 오프라인 지원

### 6.5 배포
- [ ] adapter-static 설정
- [ ] GitHub 리포지토리 생성 (wservice-memo-alarm)
- [ ] Cloudflare Pages 연결
- [ ] 커스텀 도메인 설정 (memo-alarm.woory.day)

---

## Phase별 예상 산출물

| Phase | 주요 산출물 |
|-------|------------|
| 1 | 프로젝트 구조, 공통 컴포넌트, 레이아웃 |
| 2 | 메모 CRUD, MemoCard, 검색/필터, 태그 |
| 3 | URL 입력, 이모지, 열람 추적 |
| 4 | 알림 UI, PWA 푸시, 오늘의 알림 |
| 5 | Android/iOS 빌드, 네이티브 알림 |
| 6 | 다크 모드, 데이터 관리, 배포 |

---

## 참조 파일 (아카이브)

### gentle-notes (React)
- 색상: `archive/gentle-notes-main/src/index.css`
- 타입: `archive/gentle-notes-main/src/types/memo.ts`
- 카드: `archive/gentle-notes-main/src/components/memo/MemoCard.tsx`
- 폼: `archive/gentle-notes-main/src/components/memo/MemoForm.tsx`

### v0-bookmark (Next.js)
- 색상: `archive/v0-bookmark-collection-page-main/app/globals.css`
- 데이터: `archive/v0-bookmark-collection-page-main/lib/bookmarks-data.ts`
- 아이템: `archive/v0-bookmark-collection-page-main/components/bookmark-item.tsx`
- 리스트: `archive/v0-bookmark-collection-page-main/components/bookmark-list.tsx`
