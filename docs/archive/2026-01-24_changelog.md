# 변경사항 (2026-01-24)

## 0. 메모 삭제/수정 시 UI 즉시 반영 안 되는 문제 해결

### 문제
메모를 삭제하거나 수정해도 리스트에 바로 반영되지 않고, 새로고침해야 변경사항이 보임.

### 원인 분석

**기존 동작 방식 (문제 있음)**:
```
사용자 삭제 클릭 → Supabase 삭제 요청 → 응답 대기 → Realtime 이벤트 수신 → UI 업데이트
```

- `remove()` 함수가 Supabase 삭제 완료 후 Realtime 이벤트에 의존하여 로컬 리스트 업데이트
- Realtime 이벤트가 지연되거나 누락되면 UI에 반영되지 않음
- `update()` 함수도 동일한 문제 존재

**코드 문제점** (`memos.svelte.ts:445-482`):
```typescript
// 로그인 상태에서 로컬 배열 제거 없이 Supabase만 삭제
const { error } = await supabase.from('memos').delete().eq('id', id);
// 로컬 memos 배열에서 제거하는 코드 없음!
// Realtime 이벤트(DELETE)에만 의존
```

### 해결 방법

**낙관적 업데이트(Optimistic Update) 패턴 적용**:
```
사용자 삭제 클릭 → 즉시 로컬 리스트에서 제거 → 백그라운드에서 Supabase 삭제 → 실패 시 롤백
```

**삭제 (`remove`) 수정**:
1. 즉시 로컬 `memos` 배열에서 제거
2. `localStorage` 캐시 저장
3. 백그라운드에서 Supabase 삭제 요청
4. 실패 시 원본 메모 복원 (롤백)

**수정 (`update`) 수정**:
1. 즉시 로컬 `memos` 배열 업데이트
2. `localStorage` 캐시 저장
3. 백그라운드에서 Supabase 동기화
4. 버전 충돌 시 서버 데이터로 새로고침
5. 기타 오류 시 원본으로 롤백
6. 성공 시 서버 응답(version 등)으로 최종 반영

### 수정 전/후 비교

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| UI 반영 시점 | Realtime 이벤트 수신 후 | 즉시 |
| 실패 처리 | 토스트만 표시 | 롤백 + 토스트 |
| 사용자 경험 | 지연/누락 가능 | 즉각 반응 |

### 변경 파일
- `src/lib/stores/memos.svelte.ts` - `update()`, `remove()` 함수 낙관적 업데이트 적용

---

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
| `src/lib/stores/memos.svelte.ts` | silent 모드 업데이트, **낙관적 업데이트 패턴 적용** |
| `src/lib/components/memo/QuickMemoInput.svelte` | URL 자동 북마크 기능 |
| `src/lib/components/memo/MemoForm.svelte` | 필수 입력 완화 |
| `src/lib/components/memo/MemoCard.svelte` | ultraCompact 링크 아이콘, Link2 아이콘 |
| `src/lib/components/memo/MemoDetailModal.svelte` | Link2 아이콘 |

---

## DDL 마이그레이션

이번 변경사항에는 데이터베이스 스키마 변경이 필요하지 않습니다. 기존 필드(`url`, `emoji` 등)를 활용합니다.
