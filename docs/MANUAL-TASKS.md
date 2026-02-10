# 수동 테스트 체크리스트

이 문서는 코드 변경 후 수동으로 수행해야 하는 테스트 항목들을 정리합니다.

---

## DB 마이그레이션 - Todo URL & Pung

> 관련 계획서: `docs/plan/2026-02-10_todo-enhancement-features.md`
> 마이그레이션 파일: `data/migrations/010_todo_urls_and_pung.sql`

### 실행 방법

Supabase Dashboard에서 SQL Editor를 열고 `010_todo_urls_and_pung.sql` 파일 내용을 실행:

```sql
-- Todo URL 목록 컬럼 추가 (JSONB)
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS todo_urls JSONB DEFAULT '[]'::jsonb;

-- Todo URL 존재 여부 인덱스
CREATE INDEX IF NOT EXISTS idx_ma_memos_todo_urls_exists
  ON ma_memos ((todo_urls IS NOT NULL AND todo_urls != '[]'::jsonb))
  WHERE is_active = true;

-- Pung(자동삭제) 설정 컬럼 추가
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS auto_pung BOOLEAN DEFAULT false;
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS pung_delay INTEGER DEFAULT 0;

-- Pung 활성화 할일 인덱스 (기한 초과 체크용)
CREATE INDEX IF NOT EXISTS idx_ma_memos_auto_pung
  ON ma_memos (auto_pung, todo_status, due_date)
  WHERE auto_pung = true AND is_active = true;
```

- [ ] Supabase에서 마이그레이션 실행 완료

---



## 메모 전체 삭제 (fix-memo-deletion-logout)

> 관련 계획서: `docs/plan/2026-02-04_fix-memo-deletion-logout.md`

- [ ] 로그아웃 상태에서 메모 3개 이상 존재 → "모든 메모 삭제" → 메모 0개 확인
- [ ] 로그아웃 상태에서 메모 1개만 존재 → "모든 메모 삭제" → 메모 0개 확인
- [ ] 로그인 상태에서 메모 N개 존재 → "모든 메모 삭제" → 메모 0개 + Supabase에서도 삭제 확인
- [ ] 개별 메모 삭제(스와이프/삭제 버튼)가 여전히 정상 동작하는지 확인
- [ ] 알림이 설정된 메모를 전체 삭제한 뒤, 해당 시간에 알림이 오지 않는지 확인


---


## 홈탭 스크롤바 문제 수정

- 원본 문서: `docs/fix-scrollbar-issues.md` 
- 관련 이슈: 홈탭 세로/가로 스크롤바 및 스와이프 터치 이벤트 문제

---

### 1. 세로 스크롤 테스트

| # | 테스트 항목 | 상태 |
|---|------------|------|
| 1.1 | 홈탭: 메모가 적을 때 불필요한 스크롤바 없음 | [ ] |
| 1.2 | 메모탭: 메모가 적을 때 불필요한 스크롤바 없음 | [ ] |
| 1.3 | 할일탭: 할일이 적을 때 불필요한 스크롤바 없음 | [ ] |
| 1.4 | 설정탭: 스크롤바 적절하게 동작 | [ ] |
| 1.5 | 알림탭: 알림이 적을 때 불필요한 스크롤바 없음 | [ ] |
| 1.6 | 콘텐츠가 많을 때 스크롤이 정상 동작함 | [ ] |
| 1.7 | 하단 BottomNav에 콘텐츠가 가려지지 않음 | [ ] |

---

### 2. 가로 스크롤 테스트

| # | 테스트 항목 | 상태 |
|---|------------|------|
| 2.1 | **홈탭** 320px 너비에서 가로 스크롤바 없음 | [ ] |
| 2.2 | **메모탭** 320px 너비에서 가로 스크롤바 없음 | [ ] |
| 2.3 | **할일탭** 320px 너비에서 가로 스크롤바 없음 | [ ] |
| 2.4 | FilterTabs가 좁은 화면에서 올바르게 가로 스크롤됨 | [ ] |
| 2.5 | UnifiedHeader가 오버플로우되지 않음 | [ ] |
| 2.6 | 섹션 헤더("고정된 메모" 등)가 오버플로우되지 않음 | [ ] |

---

### 3. 스와이프 테스트

| # | 테스트 항목 | 상태 |
|---|------------|------|
| 3.1 | **홈탭** 메모 카드 스와이프 시 화면 전체가 움직이지 않음 | [ ] |
| 3.2 | **메모탭** 메모 카드 스와이프 시 화면 전체가 움직이지 않음 | [ ] |
| 3.3 | 세로 스크롤 중 가로 스와이프 시도 시 충돌 없음 | [ ] |
| 3.4 | 가로 스와이프 중 세로 스크롤 시도 시 충돌 없음 | [ ] |
| 3.5 | 왼쪽 스와이프 → 삭제 기능 정상 동작 | [ ] |
| 3.6 | 오른쪽 스와이프 → 핀 기능 정상 동작 | [ ] |
| 3.7 | 스와이프 후 원위치 복귀 정상 동작 | [ ] |

---

### 4. 반응형 테스트

| # | 해상도 | 설명 | 상태 |
|---|--------|------|------|
| 4.1 | 320px | iPhone SE - 최소 너비 | [ ] |
| 4.2 | 390px | iPhone 12/13/14 - 일반 모바일 | [ ] |
| 4.3 | 428px | iPhone Plus/Max - 대형 모바일 | [ ] |
| 4.4 | 768px | iPad Mini - 태블릿 시작점 | [ ] |
| 4.5 | 1024px | iPad - 태블릿 | [ ] |
| 4.6 | 1200px+ | Desktop - 데스크톱 | [ ] |

---

### 5. 플랫폼별 테스트

| # | 플랫폼 | 상태 |
|---|--------|------|
| 5.1 | Chrome 개발자 도구 (시뮬레이션) | [ ] |
| 5.2 | 실제 iOS 기기 (Safari) | [ ] |
| 5.3 | 실제 Android 기기 (Chrome) | [ ] |
| 5.4 | PWA 모드에서 테스트 | [ ] |

---

### 6. 엣지 케이스 테스트

| # | 테스트 항목 | 상태 |
|---|------------|------|
| 6.1 | 메모가 0개일 때 빈 화면 레이아웃 | [ ] |
| 6.2 | 메모가 100개 이상일 때 스크롤 성능 | [ ] |
| 6.3 | 긴 제목의 메모가 있을 때 레이아웃 | [ ] |
| 6.4 | 화면 회전 (세로 ↔ 가로) 시 레이아웃 | [ ] |
