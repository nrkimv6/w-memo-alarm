# Memo Alarm - Product Requirements Document

## 1. 개요

### 1.1 제품 비전
메모 + 북마크 + 알림을 하나로 통합한 개인 기록 앱.
메모에 URL을 첨부하고, 원하는 시간에 알림을 받으세요.

### 1.2 핵심 콘셉트
```
┌─────────────────────────────────┐
│           📝 메모               │
│  ┌─────────────────────────┐   │
│  │ 제목, 내용, 태그         │   │
│  ├─────────────────────────┤   │
│  │ 🔗 URL (선택)           │   │  ← 북마크 속성
│  │ ⏰ 알림 (선택)          │   │  ← 알림 속성
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### 1.3 타겟 사용자
- 메모와 관련 링크를 함께 저장하고 싶은 사람
- 특정 시간에 메모 알림을 받고 싶은 사람
- 링크를 자동으로 열고 싶은 사람

### 1.4 플랫폼
- **Web:** PWA
- **Mobile:** Capacitor (Android/iOS)
- **배포:** Cloudflare Pages

---

## 2. 참조 프로젝트

두 아카이브 프로젝트의 디자인/기능을 믹스:

| 항목 | gentle-notes | v0-bookmark |
|------|--------------|-------------|
| **색상 테마** | `archive/gentle-notes-main/src/index.css` | `archive/v0-bookmark-collection-page-main/app/globals.css` |
| **데이터 타입** | `archive/gentle-notes-main/src/types/memo.ts` | `archive/v0-bookmark-collection-page-main/lib/bookmarks-data.ts` |
| **카드 컴포넌트** | `archive/gentle-notes-main/src/components/memo/MemoCard.tsx` | `archive/v0-bookmark-collection-page-main/components/bookmark-item.tsx` |

---

## 3. 핵심 기능

### 3.1 메모 기본
| 기능 | 설명 |
|------|------|
| 메모 CRUD | 제목, 내용, 태그 |
| 태그 시스템 | 자동완성, 다중 태그, 태그별 필터 |
| 핀 고정 | 중요 메모 상단 고정 |
| 즐겨찾기 | 별표 표시 |
| 뷰 모드 | 그리드 / 리스트 전환 |
| 활성/비활성 | 사용하지 않는 메모 숨김 처리 |

### 3.2 북마크 속성 (메모에 첨부)
| 기능 | 설명 |
|------|------|
| URL 첨부 | 메모에 링크 추가 (선택) |
| 이모지 | 링크 시각적 구분 |
| 열람 추적 | 클릭 횟수, 열람 기록 |
| 빠른 열기 | 메모 카드에서 바로 링크 열기 |
| 자동 열기 | 알림 시 URL 자동 오픈 |

### 3.3 알림 시스템
| 기능 | 설명 |
|------|------|
| 알림 시간 | 특정 날짜/시간 설정 |
| 반복 알림 | 없음 / 매일 / 매주 / 매월 |
| 푸시 알림 | PWA + Capacitor 네이티브 |
| 알림 동작 | 알림 탭 → 메모 열기 (URL 있으면 자동 오픈 옵션) |

### 3.4 검색/필터
- 제목, 내용, 태그, URL 통합 검색
- 필터: 핀됨, 즐겨찾기, URL 있음, 알림 있음

---

## 4. 데이터 모델

```typescript
// gentle-notes의 Memo + v0-bookmark의 Bookmark 속성 결합

interface Memo {
  id: string;

  // === gentle-notes 기본 속성 (src/types/memo.ts:1-12) ===
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isFavorite: boolean;

  // === v0-bookmark 속성 (lib/bookmarks-data.ts:6-20) ===
  // 북마크 (선택)
  bookmark?: {
    url: string;
    emoji: string;                    // 이모지 식별자
    openCount: number;
    openHistory: { id: string; openedAt: Date }[];
    autoOpenOnAlarm: boolean;         // 알림 시 자동 열기
  };

  // 활성 상태 (v0-bookmark의 active)
  isActive: boolean;

  // 알림 (gentle-notes의 reminder 확장)
  alarm?: {
    datetime: Date;
    repeat: 'none' | 'daily' | 'weekly' | 'monthly';
    enabled: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. UI/UX 디자인

### 5.1 색상 테마 (두 프로젝트 믹스)

```css
/*
 * gentle-notes 기반 (src/index.css:10-76)
 * + v0-bookmark 포인트 색상 (app/globals.css, components/bookmark-item.tsx)
 */

:root {
  /* === gentle-notes 베이스 색상 (HSL) === */
  --background: 40 33% 97%;           /* warm cream */
  --foreground: 30 10% 15%;
  --card: 40 30% 95%;
  --primary: 150 35% 40%;             /* sage green */
  --secondary: 15 75% 65%;            /* warm coral (pins) */
  --accent: 170 40% 45%;              /* soft teal */
  --muted: 40 20% 92%;
  --muted-foreground: 30 10% 45%;

  /* === v0-bookmark 포인트 색상 === */
  --link: 210 50% 63%;                /* #6b9bd1 - URL 링크 */
  --pin-highlight: 25 70% 70%;        /* #e8a87c - 핀/즐겨찾기 */

  /* === gentle-notes 커스텀 토큰 === */
  --memo-pinned-bg: 15 65% 95%;
  --memo-pinned-border: 15 75% 65%;
  --tag-bg: 150 30% 92%;
  --tag-text: 150 35% 30%;

  /* === v0-bookmark sketchy 스타일 === */
  --sketchy-shadow: 0 0% 0% / 0.08;
}
```

### 5.2 컴포넌트 스타일 (믹스)

```css
/*
 * gentle-notes 카드 스타일 (src/index.css:157-220)
 * + v0-bookmark sketchy 요소 (app/globals.css:130-184)
 */

/* === gentle-notes 메모 카드 === */
.memo-card {
  @apply bg-card rounded-xl border border-border p-6;
  box-shadow: 0 2px 8px -2px hsl(var(--shadow-color) / 0.08);
}
.memo-card:hover {
  @apply -translate-y-0.5;
  box-shadow: 0 8px 20px -4px hsl(var(--shadow-color) / 0.12);
}
.memo-card-pinned {
  background: hsl(var(--memo-pinned-bg));
  border-left: 4px solid hsl(var(--memo-pinned-border));
}

/* === v0-bookmark sketchy 요소 (포인트로 사용) === */
.sketchy-link {
  background-image: linear-gradient(90deg, hsl(var(--link)) 0%, hsl(var(--link)) 100%);
  background-repeat: no-repeat;
  background-size: 0% 2px;
  background-position: 0 100%;
  transition: background-size 0.3s ease;
}
.sketchy-link:hover {
  background-size: 100% 2px;
}

.sketchy-tag {
  box-shadow: 1px 1px 0 hsl(var(--sketchy-shadow));
  transform: rotate(-0.5deg);
}

/* === 토글 스위치 (v0-bookmark bookmark-item.tsx:81-93) === */
.toggle-switch {
  @apply w-10 h-5 rounded-full border-2 border-dashed relative;
}
.toggle-switch.active {
  @apply bg-[hsl(var(--link))] border-[hsl(var(--link))];
}
```

### 5.3 메모 카드 레이아웃 (병합)

```
참조:
- gentle-notes MemoCard.tsx:25-133
- v0-bookmark bookmark-item.tsx:23-94

┌─────────────────────────────────────┐
│ 📌 ⭐                          ⋮   │  ← 핀/즐겨찾기 (gentle-notes 스타일)
├─────────────────────────────────────┤
│ 회의 준비사항                        │  ← 제목 (line-clamp-2)
│ 내일 오전 10시 회의 안건 정리...     │  ← 내용 미리보기 (line-clamp-3)
├─────────────────────────────────────┤
│ 🔗 notion.so/meeting    (12)       │  ← URL + 열람수 (v0-bookmark 스타일)
│ ⏰ 내일 09:30  🔁 매일              │  ← 알림 (gentle-notes reminder 확장)
├─────────────────────────────────────┤
│ #회의  #업무  +2                    │  ← 태그 (sketchy-tag 스타일)
├─────────────────────────────────────┤
│ 2시간 전                      ○━━  │  ← 시간 + 활성토글 (v0-bookmark)
└─────────────────────────────────────┘
```

### 5.4 액션 버튼 (hover 시 표시)

```typescript
// gentle-notes MemoCard.tsx:49-89 스타일 유지

<div class="opacity-0 group-hover:opacity-100 transition-opacity">
  <button onclick={togglePin}>    // 📌 핀 토글
  <button onclick={toggleFavorite}> // ⭐ 즐겨찾기
  <button onclick={edit}>          // ✏️ 편집
  <button onclick={delete}>        // 🗑️ 삭제
</div>

// v0-bookmark의 활성/비활성 토글 추가
<button class="toggle-switch">     // ○━━ 활성 토글
```

### 5.5 화면 구성

```
┌─────────────────────────────────────┐
│  ⏰ Memo Alarm           🔍  ⚙️  + │
├─────────────────────────────────────┤
│  [전체] [📌핀] [⭐즐겨찾기] [⏰알림] [🔗URL] │  ← 필터 탭
├─────────────────────────────────────┤
│  🔔 오늘의 알림                      │
│  ┌────────────────────────────┐    │
│  │ 09:30 회의 준비  🔗 자동열기 │    │  ← URL 있으면 자동열기 표시
│  │ 14:00 약 복용               │    │
│  └────────────────────────────┘    │
├─────────────────────────────────────┤
│  📌 고정됨                          │
│  ┌─────────┐ ┌─────────┐           │
│  │ MemoCard │ │ MemoCard │           │  ← 그리드 뷰 (gentle-notes)
│  └─────────┘ └─────────┘           │
├─────────────────────────────────────┤
│  🏷️ 최근                           │
│  ├ MemoItem ────────────────┤      │  ← 리스트 뷰 (v0-bookmark)
│  ├ MemoItem ────────────────┤      │
└─────────────────────────────────────┘
```

### 5.6 메모 작성/편집 모달

```
┌─────────────────────────────────────┐
│  새 메모                        ✕  │
├─────────────────────────────────────┤
│  제목 ___________________          │
│                                     │
│  내용                              │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  태그: [#업무] [#회의] [+]         │
├─────────────────────────────────────┤
│  🔗 URL 추가 (선택)                │
│  ┌─────────────────────────────┐   │
│  │ https://...                 │   │
│  │ 이모지: 📄 📁 🔗 📌 ...      │   │
│  │ ☐ 알림 시 자동 열기          │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ⏰ 알림 설정 (선택)               │
│  ┌─────────────────────────────┐   │
│  │ 날짜: 2024-01-15            │   │
│  │ 시간: 09:30                 │   │
│  │ 반복: [매일 ▼]              │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│              [ 저장 ]              │
└─────────────────────────────────────┘
```

---

## 6. 기술 스택

| 카테고리 | 선택 |
|---------|------|
| 프레임워크 | SvelteKit 2 + Svelte 5 |
| 언어 | TypeScript 5 |
| 스타일링 | Tailwind CSS 4 |
| UI | bits-ui, lucide-svelte |
| PWA | vite-plugin-pwa |
| 모바일 | Capacitor 6 |
| 알림 | @capacitor/local-notifications |
| 저장소 | localStorage → IndexedDB |
| 배포 | Cloudflare Pages (adapter-static) |

---

## 7. 개발 단계

### Phase 1: 기반 구축
- [ ] SvelteKit + Tailwind + PWA 설정
- [ ] 공통 컴포넌트 (Button, Input, Modal, Card)
- [ ] 데이터 스토어 (Svelte stores + localStorage)
- [ ] 기본 레이아웃

### Phase 2: 메모 핵심
- [ ] 메모 CRUD
- [ ] 태그 시스템
- [ ] 핀/즐겨찾기
- [ ] 검색/필터
- [ ] 그리드/리스트 뷰

### Phase 3: 북마크 속성
- [ ] URL 입력 UI
- [ ] 이모지 선택
- [ ] 열람 추적
- [ ] 링크 열기 동작

### Phase 4: 알림 시스템
- [ ] 알림 설정 UI
- [ ] 알림 스케줄러
- [ ] PWA 푸시 알림
- [ ] 자동 URL 열기

### Phase 5: Capacitor
- [ ] Capacitor 설정
- [ ] 네이티브 알림
- [ ] Android/iOS 빌드

### Phase 6: 마무리
- [ ] 다크모드
- [ ] 데이터 내보내기/가져오기
- [ ] 온보딩

---

## 8. 배포 정보

| 항목 | 값 |
|------|-----|
| 프로젝트 폴더 | `wtools/memo-alarm/` |
| 리포지토리 | github.com/nrkimv6/wservice-memo-alarm |
| 도메인 | memo-alarm.woory.day |
| Pages URL | memo-alarm.pages.dev |
