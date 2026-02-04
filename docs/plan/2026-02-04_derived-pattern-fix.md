# Memo Alarm - $derived 패턴 오류 수정

> **작성일**: 2026-02-04
> **상태**: TODO
> **우선순위**: MEDIUM
> **원본**: common/docs/plan/2026-02-04_gentle-words-memo-alarm-defect-fix.md (프로젝트별 분리됨)
> **감사 기반**: 소스 코드 정적 분석 결과

---

## 문제

**심각도**: MEDIUM - `$derived`가 함수를 반환하여, 값이 아닌 함수 참조가 됨

**현상**: Svelte 5의 `$derived(expression)`은 표현식을 즉시 평가하지만, `$derived(() => {...})`는 화살표 함수 자체를 파생 값으로 저장한다. 즉, `filteredLogs`는 배열이 아니라 "배열을 반환하는 함수"가 된다. 복잡한 계산이 필요한 경우 `$derived.by(() => {...})`를 사용해야 한다.

---

## 영향받는 파일 (5개소)

### 1. `src/routes/settings/+page.svelte` (71행)

```typescript
// 현재 (잘못된 패턴)
const filteredLogs = $derived(() => {
    const logs = devLogStore.logs;
    if (logFilter === 'all') return logs.slice(-100);
    return logs.filter(l => l.source === logFilter).slice(-100);
});
// filteredLogs는 함수임. 사용 시 filteredLogs()로 호출 필요 → 의도와 불일치
```

### 2. `src/routes/+page.svelte` (54행)

```typescript
// 현재 (잘못된 패턴)
const upcomingReminders = $derived(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(0, 0, 0, 0);

    return memosStore.memos
        .filter((m) => {
            if (!m.isActive || !m.reminder?.enabled || !m.reminder?.datetime) return false;
            const reminderDate = new Date(m.reminder.datetime);
            return reminderDate >= now && reminderDate < tomorrow;
        })
        .sort((a, b) => {
            const dateA = new Date(a.reminder!.datetime!).getTime();
            const dateB = new Date(b.reminder!.datetime!).getTime();
            return dateA - dateB;
        })
        .slice(0, MAX_ITEMS_PER_SECTION);
});
```

### 3-5. `src/routes/notifications/+page.svelte` (19, 56, 74행)

```typescript
const filteredHistories = $derived(() => {
    let result: NotificationHistory[] = notificationHistoryStore.histories;
    // ...필터 로직...
    return result;
});

const visibleGrouped = $derived(() => {
    const visible = filteredHistories().slice(0, displayCount);
    // ...그룹핑 로직...
    return g;
});

const filterMemoTitle = $derived(() => {
    if (!memoIdFilter) return '';
    const record = notificationHistoryStore.histories.find((h) => h.memoId === memoIdFilter);
    return record?.memoTitle || memoIdFilter;
});
```

---

## 수정 방법

모든 5개소를 `$derived.by()`로 변경:

```typescript
// 수정: $derived(() => {...}) → $derived.by(() => {...})

// 예시 1: settings/+page.svelte 71행
const filteredLogs = $derived.by(() => {
    const logs = devLogStore.logs;
    if (logFilter === 'all') return logs.slice(-100);
    return logs.filter(l => l.source === logFilter).slice(-100);
});

// 예시 2: +page.svelte 54행
const upcomingReminders = $derived.by(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(0, 0, 0, 0);

    return memosStore.memos
        .filter((m) => {
            if (!m.isActive || !m.reminder?.enabled || !m.reminder?.datetime) return false;
            const reminderDate = new Date(m.reminder.datetime);
            return reminderDate >= now && reminderDate < tomorrow;
        })
        .sort((a, b) => {
            const dateA = new Date(a.reminder!.datetime!).getTime();
            const dateB = new Date(b.reminder!.datetime!).getTime();
            return dateA - dateB;
        })
        .slice(0, MAX_ITEMS_PER_SECTION);
});

// 예시 3~5: notifications/+page.svelte (19, 56, 74행)
const filteredHistories = $derived.by(() => { ... });
const visibleGrouped = $derived.by(() => { ... });
const filterMemoTitle = $derived.by(() => { ... });
```

---

## 추가 수정: 호출부 괄호 제거

`$derived.by()`로 변경하면 `filteredHistories`가 값(배열)이 되므로, 호출부에서 `filteredHistories()` 형태가 있다면 `filteredHistories`로 변경해야 한다.

### 확인 필요한 호출부 (`notifications/+page.svelte`)

```typescript
// notifications/+page.svelte 51~53행
const filteredCount = $derived(filteredHistories().length);   // → filteredHistories.length
const totalCount = $derived(notificationHistoryStore.histories.length);
const hasMore = $derived(filteredCount > displayCount);

// notifications/+page.svelte 57행
const visible = filteredHistories().slice(0, displayCount);   // → filteredHistories.slice(...)

// notifications/+page.svelte 67행
Object.keys(visibleGrouped()).sort(...)                       // → visibleGrouped (이미 객체)
```

---

## 작업 체크리스트

- [ ] `src/routes/settings/+page.svelte:71` — `$derived.by()` 변경
- [ ] `src/routes/+page.svelte:54` — `$derived.by()` 변경
- [ ] `src/routes/notifications/+page.svelte:19` — `$derived.by()` 변경
- [ ] `src/routes/notifications/+page.svelte:56` — `$derived.by()` 변경
- [ ] `src/routes/notifications/+page.svelte:74` — `$derived.by()` 변경
- [ ] `src/routes/notifications/+page.svelte:51-53, 57, 67` — 호출부 괄호 제거

---

## 테스트 체크리스트

- [ ] 홈 페이지(`/`)에서 `upcomingReminders` 섹션이 정상 렌더링되는가?
- [ ] 설정 페이지에서 로그 필터 변경 시 로그 목록이 즉시 갱신되는가?
- [ ] 알림 히스토리 페이지에서 필터(상태, 기간, memoId) 변경 시 목록이 즉시 갱신되는가?
- [ ] 알림 히스토리의 날짜별 그룹핑이 정상 표시되는가?
- [ ] `filteredCount`, `hasMore` 등 파생 값이 올바른 숫자를 표시하는가?
