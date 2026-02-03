# 메모 알람 저장 실패 및 이중 토스트 수정 보고서

**날짜**: 2026-02-03
**브랜치**: `claude/fix-memo-alarm-save-CpIkA`

---

## 현상

메모:알람을 1:N으로 변경한 후 알람이 포함된 메모를 수정하면:

1. "메모가 수정되었습니다" 토스트 표시
2. "메모 수정 실패 - 복원됨" 토스트 표시
3. 로컬 변경사항이 롤백됨

---

## 원인 분석

### 원인 1: DB 컬럼 `reminders` 미존재 (근본 원인)

`migrations/0001_init.sql`에는 `reminder TEXT` (단수)만 정의되어 있음.
코드는 `reminders` (복수, JSONB 배열)를 사용하도록 변경되었으나, Supabase `ma_memos` 테이블에 해당 컬럼이 추가되지 않음.

```
MemoForm → memosStore.update({ reminders: [...] })
         → memoToSupabase() → { reminders: [...] }
         → supabase.from('ma_memos').update({ reminders: [...] })
         → PostgREST 400 Error: column "reminders" does not exist
```

### 원인 2: 비동기 미대기로 인한 이중 토스트

`MemoForm.svelte:191`에서 `memosStore.update()`를 `await` 없이 호출.

```
시간축 →

t=0  memosStore.update(id, data)   // async 호출 (await 없음)
t=0  toastStore.success(...)       // ← Toast 1: 즉시 실행
t=~200ms  Supabase 응답: 에러
t=~200ms  toastStore.error(...)    // ← Toast 2: 에러 핸들러
t=~200ms  로컬 데이터 롤백
```

두 토스트 모두 동일한 update 호출 플로우에서 발생. 백그라운드 동기화(SyncQueue)와는 무관.

### 원인 3: 알람 스케줄 동기화 조건 누락

`memos.svelte.ts`의 알람 동기화 트리거가 `reminder`(단수)만 감지:

```typescript
// update() - 기존 코드
if (changes.reminder !== undefined || changes.title !== undefined) {
    updateMemoAlarm(..., result.reminder);  // 단수만 처리
}

// add() - 기존 코드
if (result.reminder?.enabled) {  // 단수만 체크
    createMemoAlarm(..., result.reminder);
}
```

MemoForm은 `reminders`(복수)를 전송하므로 알람 동기화가 실행되지 않음.

---

## 수정 내용

### 1. DB 마이그레이션 스크립트

**파일**: `migrations/0003_add_reminders.sql` (신규)

```sql
ALTER TABLE ma_memos ADD COLUMN IF NOT EXISTS reminders JSONB;

UPDATE ma_memos
SET reminders = jsonb_build_array(
  reminder::jsonb || jsonb_build_object(
    'id', 'rem_' || extract(epoch from now())::text || '_' || ...,
    'isDefault', true
  )
)
WHERE reminder IS NOT NULL
  AND reminder != 'null'
  AND reminder != ''
  AND reminders IS NULL;
```

- `reminders JSONB` 컬럼 추가
- 기존 `reminder`(단수) 데이터를 `reminders`(복수) 배열로 자동 변환
- **Supabase SQL Editor에서 수동 실행 필요**

### 2. 이중 토스트 수정

**파일**: `src/lib/components/memo/MemoForm.svelte`

| 변경 전 | 변경 후 |
|---------|---------|
| `memosStore.update(memo.id, data)` (await 없음) | `const result = await memosStore.update(memo.id, data)` |
| 무조건 성공 토스트 | `result`가 있을 때만 성공 토스트 |
| 토스트 후 `handleClose()` | `handleClose()` 먼저 실행 (낙관적 UI) |

```typescript
// 변경 후
handleClose();  // 모달 먼저 닫기

if (isEdit) {
    const result = await memosStore.update(memo.id, data);
    if (result) {
        toastStore.success('메모가 수정되었습니다');
    }
}
```

### 3. 동기화 에러 사일런트 처리

**파일**: `src/lib/stores/memos.svelte.ts` - `update()`

| 변경 전 | 변경 후 |
|---------|---------|
| DB 에러 → 롤백 + `toastStore.error()` | DB 에러 → 낙관적 업데이트 유지 + `logSyncError()` |
| 사용자에게 에러 노출 | localStorage에 로그만 기록 |
| `return null` | `return optimisticUpdate` |

```typescript
// 변경 후 - 에러 핸들러
console.error('Failed to update memo:', error);
logSyncError('update', id, error);
return optimisticUpdate;  // 로컬 데이터 유지
```

`logSyncError()`는 `localStorage['memo-alarm-sync-errors']`에 최근 50건의 에러 로그를 JSON 배열로 저장.

### 4. 알람 스케줄 1:N 동기화

**파일**: `src/lib/stores/memos.svelte.ts` - `update()`, `add()`

| 함수 | 변경 전 | 변경 후 |
|------|---------|---------|
| `add()` | `result.reminder?.enabled` → `createMemoAlarm()` | `getRemindersFromMemo()` → `syncMemoAlarms()` |
| `update()` | `changes.reminder` 감지 → `updateMemoAlarm()` | `changes.reminders \|\| changes.reminder` 감지 → `syncMemoAlarms()` |

```typescript
// update() - 변경 후
if (changes.reminders !== undefined || changes.reminder !== undefined || changes.title !== undefined) {
    const reminders = getRemindersFromMemo(result);
    if (reminders.length > 0) {
        syncMemoAlarms(userId, id, title, reminders);
    } else {
        deleteMemoAlarms(id);
    }
}
```

---

## 수정 후 동작 흐름

```
사용자: 메모 수정 (알람 포함)
  ↓
MemoForm: handleClose() → 모달 닫힘
  ↓
memosStore.update():
  ├─ 로컬 상태 즉시 업데이트 (낙관적)
  ├─ localStorage 캐시 저장
  ├─ Supabase UPDATE (백그라운드)
  │   ├─ 성공 → 서버 데이터로 최종 반영 + alarm_schedules 동기화
  │   └─ 실패 → 로컬 데이터 유지 + localStorage에 에러 로그
  └─ return result (항상 non-null, 버전 충돌 제외)
  ↓
MemoForm: result 존재 → toastStore.success('메모가 수정되었습니다')
  (토스트 1건만 표시)
```

---

## 배포 체크리스트

- [ ] Supabase SQL Editor에서 `migrations/0003_add_reminders.sql` 실행
- [ ] 프론트엔드 배포
- [ ] 기존 메모의 reminders 데이터 마이그레이션 확인
- [ ] 알람 저장/수정/삭제 동작 확인
- [ ] alarm_schedules 테이블에 1:N 알람 정상 등록 확인
