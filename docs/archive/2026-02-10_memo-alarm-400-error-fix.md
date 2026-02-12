
> ?꾨즺?? 2026-02-11
> ?꾩뭅?대툕??n# memo-alarm 400 에러 수정 보고서

**작성일**: 2026-02-10
**완료일**: 2026-02-10
**프로젝트**: memo-alarm
**상태**: 완료 ✅
**커밋**: `3ad4a54`

---

## 현상

브라우저 콘솔에서 다음 에러 발생:

```
qxiuqztinabmdhclxsuz.supabase.co/rest/v1/ma_memos?select=* → 400 Error
Failed to add memo: {code: '22008', message: 'date/time field value out of range'}
```

**추가 증상**:
- 할일(Todo) 생성 후 재접속 시 메모 탭으로 이동
- DB에 `id`가 빈 문자열(`''`)로 저장됨

---

## 원인 분석

### 원인 1: DB 컬럼 누락

| 코드 필드 | DB 컬럼 | 상태 |
|-----------|---------|------|
| `reminders` | `reminders` | **미존재** |
| `priority` | `priority` | **미존재** |

코드의 필드 매핑(`MEMO_FIELD_MAPPINGS`)에 정의된 컬럼이 DB에 없어서 400 에러 발생.

### 원인 2: 타임스탬프 형식 불일치

```typescript
// 변경 전: toDb 변환 없음
{ memo: 'createdAt', db: 'created_at', toMemo: (v) => new Date(v).getTime() }

// 문제: 밀리초 타임스탬프(1770699876427)가 그대로 DB로 전송
// PostgreSQL timestamp 형식과 불일치 → 400 에러
```

### 원인 3: ID 덮어쓰기 버그

```typescript
// 변경 전: data.id=""가 serverId를 덮어씀
const newMemo = memoToSupabase({
    id: serverId,  // 먼저 설정
    ...data,       // data.id = "" 가 덮어씀!
    ...
});

// 결과: DB에 id=''로 저장 → 재접속 시 조회 실패
```

---

## 수정 내용

### 1. DB 마이그레이션

| 파일 | 내용 |
|------|------|
| `008_add_reminders_column.sql` | `reminders JSONB` 컬럼 + GIN 인덱스 추가 |
| `009_add_priority_column.sql` | `priority TEXT` 컬럼 추가 |

### 2. 타임스탬프 변환 추가

**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
// 변경 후: toDb 변환 추가
{
  memo: 'createdAt',
  db: 'created_at',
  toMemo: (v) => new Date(v).getTime(),
  toDb: (v) => v ? new Date(v).toISOString() : null  // ← 추가
}
```

### 3. ID 스프레드 순서 수정

**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
// 변경 후: id를 마지막에 설정
const newMemo = memoToSupabase({
    ...data,
    id: serverId,  // data.id를 덮어쓰기 위해 마지막에
    ...
});
```

### 4. 잘못된 데이터 정리

```sql
DELETE FROM ma_memos WHERE id = '';  -- 1건 삭제
```

---

## 체크리스트

- [x] `008_add_reminders_column.sql` 마이그레이션 실행
- [x] `009_add_priority_column.sql` 마이그레이션 실행
- [x] `createdAt`/`updatedAt` toDb 변환 추가
- [x] ID 스프레드 순서 수정
- [x] 잘못된 데이터 정리 (id='' 삭제)
- [x] 빌드 및 배포 완료

---

## 교훈

1. **필드 매핑과 DB 스키마 동기화 필수**: 코드에 필드를 추가할 때 마이그레이션도 함께 작성
2. **객체 스프레드 순서 주의**: `{a: 1, ...obj}` vs `{...obj, a: 1}` 결과가 다름
3. **타임스탬프 형식 일치**: JS 밀리초 → ISO 8601 문자열 변환 필요
