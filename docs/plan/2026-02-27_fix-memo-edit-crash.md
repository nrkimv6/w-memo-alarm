# 메모 수정 버튼 클릭 시 crash 수정

- **상태**: 미시작
- **날짜**: 2026-02-27
- **프로젝트**: memo-alarm
- **심각도**: 높음 (기능 불가)

## 현상

메모 선택 → 수정 버튼 클릭 시 crash 발생:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
```

## 원인 분석

### 직접 원인
`MemoDetailModal.svelte:119`의 `formatReminderSchedule()` 함수에서 `reminder.days`가 `undefined`일 때 `.map()` 호출.

```typescript
// 현재 코드 (line 119)
return reminder.days.map(getDayLabel).join(', ');
```

**실패 경로**: `reminder.type === 'once'` + `reminder.date`가 falsy → if문 통과 실패 → `reminder.days.map()`으로 떨어짐 → once 타입은 `days` 필드 없음 → crash

### 기여 원인
`memos.svelte.ts:75-84`의 `normalizeMemo()`가 `migrateToMultipleReminders()`를 호출하지 않아, localStorage 캐시된 레거시 메모의 `reminder` 객체가 raw 상태로 남음.

## 수정 계획

### TODO

- [ ] **1. MemoDetailModal.svelte:119 — null guard 추가**
  - `reminder.days` 접근 전 방어 코드 추가
  - `return (reminder.days ?? []).map(getDayLabel).join(', ');`
  - once 타입에서 date 없는 경우도 처리: `if (reminder.type === 'once') return reminder.date ? ... : '';`

- [ ] **2. ReminderCard.svelte — formatDays 방어 강화**
  - `formatDays()` 함수 내부에 `if (!days || days.length === 0) return '';` 추가
  - 현재는 call site에서 guard하지만, 함수 자체가 방어적이어야 함

- [ ] **3. memos.svelte.ts — normalizeMemo에서 reminder 마이그레이션 호출**
  - `normalizeMemo()` 내부에서 `migrateToMultipleReminders()` 호출 추가
  - localStorage 캐시 메모도 새 구조로 정규화되도록 보장

- [ ] **4. 빌드 확인**
  - `npm run build` 성공 확인
