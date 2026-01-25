# memo-alarm 기본알림 + 사용자 지정알림 구분 기능

> 작성일: 2026-01-25
> 대상 프로젝트: memo-alarm
> 상태: ✅ 완료 (2026-01-25)

---

## 개요

현재 memo-alarm은 메모별로 알림을 개별 설정하는 방식입니다. 사용자가 원하는 기능:

1. **기본알림**: 메모 생성 시 자동 적용 (글로벌 설정 시간 사용)
2. **사용자 지정알림**: 개별 메모에 커스텀 시간 설정
3. **기본알림 시간 변경 시**: 기본알림이 적용된 모든 메모의 알림 시간 일괄 변경

### 현재 구조

```typescript
// memo.ts - Reminder 인터페이스
interface Reminder {
  enabled: boolean;
  time: string;      // HH:mm
  days: number[];    // 0-6 (일-토)
  autoOpen: boolean;
  type?: 'repeat' | 'once';
  date?: string;     // YYYY-MM-DD (일회성)
}

// settings.svelte.ts - 기본 알림 설정 (로컬스토리지)
interface DefaultReminderSettings {
  enabled: boolean;
  time: string;      // '09:00'
  days: number[];    // [1,2,3,4,5]
  autoOpen: boolean;
}
```

### 문제점

- 기본 알림 시간이 메모 `reminder.time`에 **복사**되어 저장됨
- 기본 알림 시간 변경 시 기존 메모에는 반영되지 않음
- "기본알림"인지 "사용자 지정알림"인지 구분 불가

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | Reminder 타입 확장 | `isDefault` 필드 추가로 기본/커스텀 구분 | 낮음 |
| P0 | DB 스키마 변경 | memos.reminder에 is_default 필드 추가 | 낮음 |
| P0 | 메모 생성 시 기본알림 자동 적용 | `autoReminderOnCreate: true`일 때 `isDefault: true`로 저장 | 낮음 |
| P1 | 기본알림 시간 변경 시 일괄 업데이트 | `isDefault: true`인 메모들의 알림 시간 일괄 변경 | 중간 |
| P1 | UI: 기본/커스텀 알림 표시 구분 | 알림 설정 UI에서 "기본알림 사용" 체크박스 | 낮음 |
| P2 | 알림 스케줄 일괄 업데이트 | alarm_schedules 테이블 일괄 갱신 | 중간 |

---

## 기술적 고려사항

### 1. 데이터 모델 변경

```typescript
// 변경된 Reminder 인터페이스
interface Reminder {
  enabled: boolean;
  time: string;           // HH:mm
  days: number[];         // 0-6 (일-토)
  autoOpen: boolean;
  type?: 'repeat' | 'once';
  date?: string;          // YYYY-MM-DD (일회성)
  isDefault?: boolean;    // ✅ 신규: 기본알림 사용 여부
}
```

### 2. 기본알림 동작 로직

```
메모 생성 시:
  - autoReminderOnCreate = true → reminder.isDefault = true
  - 시간/요일은 settings.defaultReminder에서 가져옴

메모 편집 시:
  - "기본알림 사용" 체크 해제 → isDefault = false (커스텀 시간 유지)
  - "기본알림 사용" 체크 → isDefault = true (시간이 defaultReminder로 변경됨)

기본알림 시간 변경 시:
  - isDefault = true인 모든 메모의 reminder.time 일괄 변경
  - alarm_schedules 테이블도 일괄 갱신
```

### 3. 일괄 업데이트 전략

```sql
-- Supabase에서 isDefault=true인 메모들 일괄 업데이트
UPDATE memos
SET reminder = jsonb_set(reminder, '{time}', '"08:30"')
WHERE user_id = $1
  AND reminder->>'isDefault' = 'true';
```

### 4. 시간 표시 UI 로직

```
기본알림 (isDefault: true):
  → "기본알림 (09:00, 월-금)" 표시
  → 설정에서 시간 변경하면 자동 갱신

커스텀 알림 (isDefault: false 또는 undefined):
  → "사용자 지정 (14:30, 매일)" 표시
  → 개별 메모에서만 수정 가능
```

### 5. 마이그레이션 고려

- 기존 메모의 `reminder.isDefault`는 `undefined`
- `undefined`는 **커스텀 알림**으로 취급 (기존 동작 유지)
- 새로 생성되는 메모만 `isDefault: true/false` 명시

---

## 구현 순서

### Phase 1: 데이터 모델 변경 (P0) ✅

1. [x] `src/lib/types/memo.ts` - Reminder 인터페이스에 `isDefault?: boolean` 추가
2. [x] `src/lib/stores/memos.svelte.ts` - 메모 생성 시 `isDefault` 설정
3. [x] DB는 JSONB이므로 별도 마이그레이션 불필요

### Phase 2: UI 구현 (P1) ✅

4. [x] 메모 편집 폼 - "기본알림 사용" 체크박스 추가
5. [x] 알림 표시 - 기본/커스텀 구분 라벨 표시

### Phase 3: 일괄 업데이트 기능 (P1) ✅

6. [x] `settingsStore` - 기본알림 시간 변경 시 일괄 업데이트 함수
7. [x] `memosStore` - `updateDefaultReminderMemos()` 함수 추가
8. [x] 알림 스케줄 일괄 업데이트 (기존 update 함수로 처리)

### Phase 4: 테스트 및 배포 (P2)

9. [ ] 기존 메모 호환성 테스트
10. [ ] 일괄 업데이트 성능 테스트
11. [ ] 배포

---

## UI 와이어프레임

### 메모 편집 - 알림 설정 섹션

```
┌─────────────────────────────────────┐
│ 🔔 알림 설정                         │
├─────────────────────────────────────┤
│ ☑ 알림 사용                          │
│                                      │
│ ◉ 기본알림 사용 (09:00, 월-금)       │  ← 라디오 선택 시 시간 편집 불가
│ ○ 사용자 지정                        │
│                                      │
│   시간: [ 14:30 ]                    │  ← "사용자 지정" 선택 시만 활성화
│   요일: ○일 ●월 ●화 ●수 ●목 ●금 ○토  │
│                                      │
│ ☐ 알림 시 URL 자동 열기              │
└─────────────────────────────────────┘
```

### 설정 페이지 - 기본 알림 설정

```
┌─────────────────────────────────────┐
│ 기본 알림 설정                        │
├─────────────────────────────────────┤
│ 기본 시간: [ 09:00 ]                 │
│ 기본 요일: ○일 ●월 ●화 ●수 ●목 ●금 ○토│
│                                      │
│ ⚠️ 변경 시 기본알림을 사용하는        │
│    모든 메모(12개)에 적용됩니다.      │
│                                      │
│ [ 저장 ] [ 취소 ]                    │
└─────────────────────────────────────┘
```

---

## 예상 영향

| 영역 | 변경 사항 |
|------|----------|
| `types/memo.ts` | Reminder에 `isDefault` 추가 |
| `stores/memos.svelte.ts` | 생성 시 `isDefault` 설정, 일괄 업데이트 함수 |
| `stores/settings.svelte.ts` | 시간 변경 시 일괄 업데이트 호출 |
| `services/alarmSchedules.ts` | 일괄 업데이트 API |
| 메모 편집 컴포넌트 | 기본/커스텀 선택 UI |
| 설정 페이지 | 변경 영향 안내 문구 |

---

*상태: 검토 대기*
