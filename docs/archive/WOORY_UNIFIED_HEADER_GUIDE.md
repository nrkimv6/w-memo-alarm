# Woory Apps 통합 헤더 가이드

## 개요

우리공방(Woory) 형제 앱들이 일관된 사용자 경험을 제공하기 위한 통합 헤더 컴포넌트 설계 가이드입니다.

## 문제점 (As-Is)

기존에 각 앱은 두 개의 헤더를 사용:
1. **GlobalNav**: "우리공방" 브랜드 + Family Sites 메뉴
2. **App Header**: 개별 앱 로고 + 앱별 액션

### 문제
- 화면 공간 낭비 (112px)
- 인지 부하 (두 개의 브랜드)
- 코드 중복
- 앱별 불일치

## 해결책 (To-Be)

### 통합 헤더 구조

```
┌─────────────────────────────────────────────────────────────┐
│ 🏠 │      📒 [앱 이름]      │   [앱별 액션] 🌙 ≡          │
└─────────────────────────────────────────────────────────────┘
```

| 영역 | 내용 | 비고 |
|------|------|------|
| 좌측 | 포털 홈 아이콘 | woory.day 링크 |
| 중앙 | 앱 이모지 + 앱 이름 | 앱 홈으로 이동 |
| 우측 | 앱별 액션 슬롯 | 동기화 상태 등 |
| 우측 | 테마 토글 | 다크/라이트 모드 |
| 우측 | Family Sites | 형제 앱 메뉴 |

### 컴포넌트 Props

```typescript
interface UnifiedHeaderProps {
  // 앱 정보
  appName: string;           // "메모알람"
  appEmoji: string;          // "📒"
  appHomeUrl?: string;       // "/" (기본값)

  // 포털 링크
  portalUrl?: string;        // "https://woory.day" (기본값)

  // 슬롯
  // <slot name="actions" /> - 앱별 커스텀 액션
}
```

### 사용 예시

```svelte
<UnifiedHeader appName="메모알람" appEmoji="📒">
  <svelte:fragment slot="actions">
    <SyncStatusIcon />
  </svelte:fragment>
</UnifiedHeader>
```

## Family Sites 목록

| 앱 이름 | URL | 이모지 |
|---------|-----|--------|
| 기도시간 | sacred-hours.woory.day | 🙏 |
| 명언집 | gentle-words.woory.day | 📖 |
| 문센 다모아 | activity.woory.day | 🏃 |
| 스크린샷 생성기 | screenshot.woory.day | 📱 |
| 메모알람 | memo.woory.day | 📒 |
| 회선 관리 | line-minder.woory.day | 📞 |
| 우리공방 | woory.day | 🏠 |

## 마이그레이션 체크리스트

각 앱에서 수행할 작업:

### 1단계: 컴포넌트 생성
- [ ] `UnifiedHeader.svelte` 복사 또는 공유 패키지 import
- [ ] 앱별 props 설정 (appName, appEmoji)

### 2단계: 레이아웃 수정
- [ ] `+layout.svelte`에서 GlobalNav → UnifiedHeader 교체

### 3단계: 페이지 정리
- [ ] 각 페이지에서 기존 Header import 제거
- [ ] Header 컴포넌트 사용 제거

### 4단계: 기존 파일 삭제
- [ ] `GlobalNav.svelte` 삭제
- [ ] `Header.svelte` 삭제

### 5단계: 테스트
- [ ] 모든 페이지 렌더링 확인
- [ ] 반응형 레이아웃 확인
- [ ] Family Sites 메뉴 동작 확인
- [ ] 테마 토글 동작 확인

## 공유 패키지 구조 (향후)

```
@woory/ui
├── components/
│   ├── UnifiedHeader.svelte
│   ├── ThemeToggle.svelte
│   ├── FamilySitesMenu.svelte
│   └── index.ts
├── stores/
│   └── theme.svelte.ts
└── config/
    └── family-sites.ts
```

### 설치 및 사용

```bash
npm install @woory/ui
```

```svelte
<script>
  import { UnifiedHeader } from '@woory/ui';
</script>

<UnifiedHeader appName="새 앱" appEmoji="✨">
  <svelte:fragment slot="actions">
    <!-- 앱별 액션 -->
  </svelte:fragment>
</UnifiedHeader>
```

## 스타일 가이드

### 높이
- 헤더 높이: `h-14` (56px)

### z-index
- 헤더: `z-50`
- 드롭다운 메뉴: `z-50` (헤더 내부)

### 색상
- 배경: `bg-background/95` with `backdrop-blur`
- 테두리: `border-b border-border/40`

### 반응형
- 모바일: 앱 이름만 표시
- 데스크톱: 전체 요소 표시

## 참고

- 메모알람 구현 예시: `src/lib/components/layout/UnifiedHeader.svelte`
- 계획서: `docs/2026-01-25_header-unification.md`
