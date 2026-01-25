# 헤더 통합 계획서

## 개요

현재 두 개의 헤더가 존재하며 이를 하나로 통합합니다.

| 현재 헤더 | 위치 | 역할 |
|-----------|------|------|
| `GlobalNav.svelte` | +layout.svelte | "우리공방" 로고 + Family Sites 드롭다운 |
| `Header.svelte` | 각 페이지 개별 | "메모알람" 로고 + 동기화 상태 + 테마 토글 |

## 문제점

1. **화면 공간 낭비**: 두 헤더가 총 112px(56px × 2) 차지
2. **인지 부하**: 두 개의 브랜드가 동시에 표시되어 혼란
3. **코드 중복**: 각 페이지에서 Header를 개별적으로 import
4. **z-index 복잡성**: GlobalNav(z-100), Header(z-40) 별도 관리

## 통합 설계

### 통합 헤더 구조

```
┌──────────────────────────────────────────────────────────────┐
│ 🏠 │  📒 메모알람  │         ☁️  🌙  ≡(Family Sites)         │
└──────────────────────────────────────────────────────────────┘
 좌측     중앙(앱명)              우측(액션들)
```

### 구성 요소

| 위치 | 요소 | 설명 |
|------|------|------|
| 좌측 | 홈 아이콘 | 우리공방 포털 링크 (https://woory.day) |
| 중앙 | 앱 로고 | "📒 메모알람" (현재 앱으로 이동) |
| 우측 | 동기화 상태 | 오프라인/동기화중/실패 등 표시 |
| 우측 | 테마 토글 | 다크/라이트 모드 전환 |
| 우측 | Family Sites | 형제 앱 드롭다운 메뉴 |

### 파일 구조 변경

```
src/lib/components/
├── GlobalNav.svelte          # 삭제
├── layout/
│   ├── Header.svelte         # 삭제
│   ├── UnifiedHeader.svelte  # 신규 - 통합 헤더
│   └── index.ts              # 수정 - export 변경
```

## 구현 단계

### 1단계: 통합 헤더 컴포넌트 생성

`UnifiedHeader.svelte` 생성:
- GlobalNav의 Family Sites 드롭다운 통합
- Header의 동기화 상태, 테마 토글 통합
- 알림 권한 배너 유지

### 2단계: 레이아웃 수정

`+layout.svelte`:
- GlobalNav → UnifiedHeader 교체

### 3단계: 페이지별 Header 제거

다음 파일에서 Header import 및 사용 제거:
- `/src/routes/+page.svelte`
- `/src/routes/memos/+page.svelte`
- `/src/routes/settings/+page.svelte`

### 4단계: 기존 파일 정리

- `GlobalNav.svelte` 삭제
- `layout/Header.svelte` 삭제

## 마이그레이션 체크리스트

- [ ] `UnifiedHeader.svelte` 생성
- [ ] `+layout.svelte` 수정 (GlobalNav → UnifiedHeader)
- [ ] `+page.svelte` Header 제거
- [ ] `memos/+page.svelte` Header 제거
- [ ] `settings/+page.svelte` Header 제거
- [ ] `GlobalNav.svelte` 삭제
- [ ] `layout/Header.svelte` 삭제
- [ ] `layout/index.ts` export 수정
- [ ] 동작 테스트

## 예상 결과

- 헤더 높이: 112px → 56px (50% 절약)
- 컴포넌트 수: 2개 → 1개
- z-index 레이어: 2개 → 1개
- 페이지별 import: 필요 없음 (레이아웃에서 일괄 처리)
