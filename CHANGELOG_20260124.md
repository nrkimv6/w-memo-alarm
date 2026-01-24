# 변경사항 (2026-01-24)

## 1. 토스트 중복 표시 문제 해결

### 문제
메인 화면에서 북마크 링크를 클릭 후 뒤로가기 시 두 개의 토스트가 동시에 표시됨:
- "다른 기기에서 수정됨. 최신 데이터로 새로고침합니다."
- "로그인되었습니다."

### 해결 방법
- **auth.svelte.ts**: 로그인 토스트가 실제 새 로그인 시에만 표시되도록 `hasShownLoginToast` 플래그 추가
- **memos.svelte.ts**: `incrementOpenCount`, `addOpenHistory` 등 백그라운드 업데이트 시 `silent` 모드로 실행하여 충돌 토스트 미표시

### 변경 파일
- `src/lib/stores/auth.svelte.ts`
- `src/lib/stores/memos.svelte.ts`

---

## 2. 빠른 메모 URL 자동 북마크 기능

### 기능 설명
빠른 메모 입력창에 URL을 입력하면 자동으로 북마크로 저장됩니다.

### 동작 방식
1. URL 패턴(`https://...` 또는 `http://...`) 감지
2. URL인 경우:
   - 도메인을 제목으로 자동 설정
   - URL 필드에 전체 URL 저장
   - 기본 이모지 설정
3. 저장 시 "북마크 저장됨" 토스트 표시

### 변경 파일
- `src/lib/components/memo/QuickMemoInput.svelte`

---

## 3. 메모 필수 입력 완화

### 기능 설명
메모 저장 시 제목/내용/URL 중 하나만 입력해도 저장 가능합니다.

### 동작 방식
- 제목만 입력: 그대로 저장
- URL만 입력: 도메인을 제목으로 자동 설정
- 내용만 입력: 내용 첫 줄(최대 50자)을 제목으로 자동 설정

### 변경 파일
- `src/lib/components/memo/MemoForm.svelte`

---

## 4. 접힌 메모(ultraCompact)에서 북마크 아이콘 표시

### 기능 설명
접힌(초소형) 메모 뷰에서 북마크가 있는 경우 링크 아이콘을 표시하고, 클릭 시 해당 URL로 이동합니다.

### 동작 방식
1. `ultraCompact` 모드에서 `memo.url`이 있으면 Link2 아이콘 표시
2. 아이콘 클릭 시 새 탭에서 URL 열기
3. 아이콘에 마우스 호버 시 도메인 툴팁 표시

### 변경 파일
- `src/lib/components/memo/MemoCard.svelte`

---

## 5. 클립 아이콘 라이브러리화

### 기능 설명
기본 북마크 이모지(🔗)를 lucide-svelte의 `Link2` 아이콘으로 변경합니다.

### 동작 방식
- 사용자가 선택한 이모지가 있으면(`memo.emoji !== '🔗'`): 이모지 표시
- 기본값(🔗) 또는 이모지 미설정: Link2 아이콘 표시

### 변경 파일
- `src/lib/components/memo/MemoCard.svelte`
- `src/lib/components/memo/MemoDetailModal.svelte`

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/auth.svelte.ts` | 로그인 토스트 중복 방지 |
| `src/lib/stores/memos.svelte.ts` | silent 모드 업데이트 지원 |
| `src/lib/components/memo/QuickMemoInput.svelte` | URL 자동 북마크 기능 |
| `src/lib/components/memo/MemoForm.svelte` | 필수 입력 완화 |
| `src/lib/components/memo/MemoCard.svelte` | ultraCompact 링크 아이콘, Link2 아이콘 |
| `src/lib/components/memo/MemoDetailModal.svelte` | Link2 아이콘 |

---

## DDL 마이그레이션

이번 변경사항에는 데이터베이스 스키마 변경이 필요하지 않습니다. 기존 필드(`url`, `emoji` 등)를 활용합니다.
