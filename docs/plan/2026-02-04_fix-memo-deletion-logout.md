# 로그아웃 상태에서 "모든 메모 삭제" 시 1개 잔존 버그 수정 계획

## 버그 현상

- **재현 경로**: 로그아웃 상태 → 설정 → "모든 메모 삭제" 실행
- **기대 동작**: 모든 메모가 삭제됨
- **실제 동작**: 메모 1개가 삭제되지 않고 남아있음

---

## 원인 분석

### 핵심 원인: async 함수의 동시 실행으로 인한 stale index 레이스 컨디션

**`clearAllData()`** (`src/lib/utils/data.ts:169-179`):
```typescript
export function clearAllData(): void {
    const memoIds = memosStore.memos.map((m) => m.id);
    memoIds.forEach((id) => memosStore.remove(id));  // ❌ await 없이 async 함수 호출
    // ...
}
```

**`memosStore.remove()`** (`src/lib/stores/memos.svelte.ts:689-748`):
```typescript
async function remove(id: string): Promise<boolean> {
    const memoIndex = memos.findIndex((m) => m.id === id);  // (1) 인덱스 캡처
    // ...
    if (await isNative()) {   // (2) 첫 번째 await → 여기서 실행이 중단됨
        cancelNotification(id);
    }
    // ...
    // (3) 재개 후 캡처된 stale 인덱스로 배열 조작
    memos = [...memos.slice(0, memoIndex), ...memos.slice(memoIndex + 1)];
}
```

### 레이스 컨디션 발생 과정 (샘플 메모 3개: A, B, C)

`forEach`는 `await` 없이 3개의 `remove()`를 **동시에** 호출합니다:

**Phase 1 — 동기 실행 (await 이전)**:
| 호출 | 캡처된 memoIndex | 배열 상태 |
|------|-----------------|----------|
| `remove(A)` | 0 | [A, B, C] |
| `remove(B)` | 1 | [A, B, C] |
| `remove(C)` | 2 | [A, B, C] |

3개 모두 `await isNative()`에서 중단됩니다.

**Phase 2 — await 이후 재개 (stale index 사용)**:
| 순서 | 사용 인덱스 | 실제 배열 | slice 결과 | 삭제된 항목 |
|------|-----------|----------|-----------|-----------|
| `remove(A)` 재개 | 0 | [A, B, C] | slice(0,0) + slice(1) | A 삭제 ✅ |
| `remove(B)` 재개 | 1 (stale!) | [B, C] | slice(0,1) + slice(2) | C 삭제 ❌ (B 대신 C 삭제) |
| `remove(C)` 재개 | 2 (stale!) | [B] | slice(0,2) + slice(3) | 아무것도 안됨 ❌ (범위 초과) |

**결과**: `[B]` — 메모 1개 잔존

### 왜 로그아웃 상태에서만 눈에 띄는가?

로그인 상태에서도 동일한 레이스 컨디션이 존재하지만, 서버 삭제(`supabase.delete()`) 후 Realtime 구독을 통해 서버 상태가 다시 동기화되므로 문제가 표면적으로 드러나지 않습니다. 로그아웃 상태에서는 서버 동기화가 없으므로 localStorage의 잘못된 상태가 그대로 유지됩니다.

### 부차적 문제: folders.remove()

`foldersStore.remove()`는 비로그인 시 `await` 없이 동기적으로 처리하므로 이 버그의 영향을 받지 않습니다:
```typescript
async function remove(id: string): Promise<boolean> {
    if (!authStore.isAuthenticated) {
        // await 없이 즉시 처리 → 레이스 컨디션 없음
        const index = folders.findIndex((f) => f.id === id);
        folders = [...folders.slice(0, index), ...folders.slice(index + 1)];
        return true;
    }
    // ...
}
```

---

## 수정 계획

### 방법 1: `clearAllData()`에 순차 await 적용 (최소 수정)

**파일**: `src/lib/utils/data.ts`

```typescript
// Before (버그)
export function clearAllData(): void {
    const memoIds = memosStore.memos.map((m) => m.id);
    memoIds.forEach((id) => memosStore.remove(id));
    // ...
}

// After (수정)
export async function clearAllData(): Promise<void> {
    // Clear memos (순차 실행으로 레이스 컨디션 방지)
    const memoIds = memosStore.memos.map((m) => m.id);
    for (const id of memoIds) {
        await memosStore.remove(id);
    }

    // Clear folders
    const folderIds = foldersStore.folders.map((f) => f.id);
    for (const id of folderIds) {
        await foldersStore.remove(id);
    }

    toastStore.success('모든 데이터가 삭제되었습니다');
}
```

- **장점**: 변경 최소화, 원인 직접 해결
- **단점**: N개 메모에 대해 N번의 순차 await → 메모 수가 많으면 느림

### 방법 2: `removeAll()` 벌크 삭제 메서드 추가 (권장)

**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
async function removeAll(): Promise<void> {
    // 1. 모든 알림 일괄 취소
    for (const memo of memos) {
        if (await isNative()) {
            cancelNotification(memo.id);
        } else {
            notificationStore.removeReminderFromServiceWorker(memo.id);
        }
    }

    // 2. 로컬 상태 일괄 초기화
    memos = [];
    saveCacheToStorage([]);

    // 3. 서버 일괄 삭제 (로그인 시)
    if (authStore.isAuthenticated) {
        const { error } = await supabase
            .from('ma_memos')
            .delete()
            .eq('user_id', authStore.user?.id);

        if (error) {
            console.error('Failed to delete all memos from server:', error);
            toastStore.error('서버 메모 삭제 실패');
        }
    }
}
```

**파일**: `src/lib/utils/data.ts`

```typescript
export async function clearAllData(): Promise<void> {
    await memosStore.removeAll();

    const folderIds = foldersStore.folders.map((f) => f.id);
    for (const id of folderIds) {
        await foldersStore.remove(id);
    }

    toastStore.success('모든 데이터가 삭제되었습니다');
}
```

- **장점**: 성능 최적화 (개별 삭제 대신 벌크 처리), 레이스 컨디션 근본적 제거
- **단점**: 새 메서드 추가 필요

### 방법 3: `remove()` 내부 방어적 인덱스 재조회 (근본 방어)

**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
async function remove(id: string): Promise<boolean> {
    const memoToDelete = memos.find((m) => m.id === id);
    if (!memoToDelete) return false;

    // ... 알림 취소 (await 포함) ...

    // await 이후 인덱스를 다시 조회 (stale index 방지)
    const currentIndex = memos.findIndex((m) => m.id === id);
    if (currentIndex === -1) return false;  // 이미 다른 호출에서 삭제됨

    memos = [...memos.slice(0, currentIndex), ...memos.slice(currentIndex + 1)];
    saveCacheToStorage(memos);
    // ...
}
```

- **장점**: `remove()` 자체가 동시 호출에 안전해짐, 다른 호출처에서도 안전
- **단점**: 레이스 컨디션 가능성은 여전히 존재 (window가 좁아질 뿐)

---

## 권장 수정 방안

**방법 2 + 3 조합** 권장:

1. `removeAll()` 벌크 삭제 메서드 추가 → `clearAllData()`에서 사용
2. `remove()` 내부에 방어적 인덱스 재조회 추가 → 다른 곳에서의 동시 호출도 안전하게

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `removeAll()` 메서드 추가, `remove()` 내 방어적 인덱스 재조회 |
| `src/lib/utils/data.ts` | `clearAllData()`를 async로 변경, `removeAll()` 사용 |
| `src/routes/settings/+page.svelte` | `clearAllData()` 호출부에 `await` 추가 |

## 검증 방법

1. 로그아웃 상태에서 메모 3개 존재 → "모든 메모 삭제" → 메모 0개 확인
2. 로그인 상태에서 메모 N개 존재 → "모든 메모 삭제" → 메모 0개 + 서버 확인
3. 개별 메모 삭제가 정상 동작하는지 확인
4. `npm run build` 성공 확인
