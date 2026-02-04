# 로그아웃 상태에서 "모든 메모 삭제" 시 1개 잔존 버그 수정 계획

## 진행 상태

- [x] Task 1: `remove()` 함수의 stale index 방어 코드 추가
  - [x] 1-1. await 이후 memoIndex 재조회 로직 추가
  - [x] 1-2. 재조회 인덱스가 -1이면 조기 종료
  - [x] 1-3. 롤백 코드에서도 재조회 인덱스 사용
- [x] Task 2: `removeAll()` 벌크 삭제 메서드 추가
  - [x] 2-1. removeAll() 함수 신규 작성
  - [x] 2-2. 알림 취소 처리 (네이티브/웹/FCM/todo)
  - [x] 2-3. 로컬 상태 일괄 초기화
  - [x] 2-4. 서버 일괄 삭제 (로그인 시)
  - [x] 2-5. return 객체에 removeAll export
- [x] Task 3: `clearAllData()`가 `removeAll()`을 사용하도록 변경
  - [x] 3-1. async 시그니처로 변경
  - [x] 3-2. removeAll() 사용으로 교체
  - [x] 3-3. 폴더 삭제도 순차 await로 변경
- [x] Task 4: `clearAllData()` 호출부에 `await` 추가
  - [x] 4-1. confirmClearAll()을 async로 변경
  - [x] 4-2. await 추가
- [x] Task 5: 빌드 검증
  - [x] 5-1. svelte-check 통과 (변경 파일 에러 0건, 기존 에러만 존재)
- [ ] Task 6: 수동 테스트 (사용자 확인 필요)

## 버그 현상

- **재현 경로**: 로그아웃 상태 → 설정 → "모든 메모 삭제" 실행
- **기대 동작**: 모든 메모가 삭제됨
- **실제 동작**: 메모 1개가 삭제되지 않고 남아있음

---

## 원인 분석

### 핵심 원인: async 함수의 동시 실행으로 인한 stale index 레이스 컨디션

`clearAllData()` (`src/lib/utils/data.ts:169-172`)에서 `forEach`로 `memosStore.remove(id)`를 호출하는데, `remove()`는 async 함수임에도 `await` 없이 호출합니다.

`remove()` (`src/lib/stores/memos.svelte.ts:689-748`)는 함수 시작 시 `memoIndex`를 캡처한 뒤, `await isNative()` (706행)에서 실행이 중단됩니다. `forEach`가 `await` 없이 돌기 때문에 모든 `remove()` 호출이 동시에 시작되고, 각각이 같은 시점의 배열 기준으로 인덱스를 캡처합니다.

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

`foldersStore.remove()`는 비로그인 시 `await` 없이 동기적으로 처리(`src/lib/stores/folders.svelte.ts:232-240`)하므로 이 버그의 영향을 받지 않습니다.

### 참고: 이미 존재하는 clearAll() 메서드

`memos.svelte.ts:971-979`에 `clearAll()` 메서드가 이미 있습니다. 비로그인 시 `memos = []`로 일괄 초기화하는 올바른 로직이지만, `clearAllData()`에서 사용하지 않고 있습니다. 로그인 시에는 에러 토스트만 띄우고 동작하지 않는 한계가 있습니다.

---

## 수정 작업 목록

방법 2 + 3 조합을 채택합니다. `removeAll()` 벌크 삭제와 `remove()` 방어 코드를 함께 적용합니다.

### Task 1: `remove()` 함수의 stale index 방어 코드 추가

- **파일**: `src/lib/stores/memos.svelte.ts`
- **위치**: `remove()` 함수 (689행~)
- **할 일**:
  - [ ] 1-1. 689~694행의 기존 로직에서 `memoIndex` 변수를 `await` **이전**에 한 번, `await` **이후**(727행 직전)에 한 번 더 조회하도록 변경
  - [ ] 1-2. 727행의 배열 slice 직전에 `memoIndex`를 `memos.findIndex((m) => m.id === id)`로 **재조회**
  - [ ] 1-3. 재조회한 인덱스가 `-1`이면 (이미 다른 호출에서 삭제됨) `return false`로 조기 종료
  - [ ] 1-4. 736행 이후의 서버 삭제 실패 시 롤백 코드(740~744행)에서도 재조회한 인덱스를 사용하도록 수정

### Task 2: `removeAll()` 벌크 삭제 메서드 추가

- **파일**: `src/lib/stores/memos.svelte.ts`
- **위치**: 기존 `clearAll()` 함수(971행) 바로 아래
- **할 일**:
  - [ ] 2-1. `async function removeAll(): Promise<void>` 함수 신규 작성
  - [ ] 2-2. 함수 내부 — 현재 `memos` 배열을 복사해둔 뒤, 각 메모에 대해 알림 취소 처리:
    - 네이티브(`isNative()`)면 `cancelNotification(memo.id)` 호출
    - 웹이면 `notificationStore.removeReminderFromServiceWorker(memo.id)` 호출
    - 로그인 상태면 `deleteMemoAlarms(memo.id)` 호출
    - todo 타입이면 `cancelTodoNotifications(memo.id)` 호출
  - [ ] 2-3. 함수 내부 — 알림 취소 후 `memos = []`와 `saveCacheToStorage([])`로 로컬 상태 일괄 초기화
  - [ ] 2-4. 함수 내부 — `authStore.isAuthenticated`이면 `supabase.from('ma_memos').delete().eq('user_id', authStore.user?.id)`로 서버 일괄 삭제, 에러 시 `toastStore.error()` 표시
  - [ ] 2-5. 1158행의 return 객체에 `removeAll`을 추가하여 외부에서 호출 가능하게 export

### Task 3: `clearAllData()`가 `removeAll()`을 사용하도록 변경

- **파일**: `src/lib/utils/data.ts`
- **위치**: `clearAllData()` 함수 (169행)
- **할 일**:
  - [ ] 3-1. 함수 시그니처를 `export function clearAllData(): void`에서 `export async function clearAllData(): Promise<void>`로 변경
  - [ ] 3-2. 메모 삭제 로직을 `forEach` + 개별 `remove()` 대신 `await memosStore.removeAll()` 한 줄로 교체
  - [ ] 3-3. 폴더 삭제 로직도 `forEach` 대신 `for...of` + `await`로 순차 실행되게 변경

### Task 4: `clearAllData()` 호출부에 `await` 추가

- **파일**: `src/routes/settings/+page.svelte`
- **위치**: `confirmClearAll()` 함수 (565행)
- **할 일**:
  - [ ] 4-1. `confirmClearAll()` 함수를 `async function confirmClearAll()`로 변경
  - [ ] 4-2. `clearAllData()` 호출 앞에 `await` 추가

### Task 5: 빌드 검증

- **할 일**:
  - [ ] 5-1. `npm run build` 실행하여 타입 에러 및 빌드 에러 없는지 확인
  - [ ] 5-2. 에러 발생 시 해당 파일 수정

### Task 6: 수동 테스트

- **할 일**:
  - [ ] 6-1. 로그아웃 상태에서 메모 3개 이상 존재 → "모든 메모 삭제" → 메모 0개 확인
  - [ ] 6-2. 로그아웃 상태에서 메모 1개만 존재 → "모든 메모 삭제" → 메모 0개 확인
  - [ ] 6-3. 로그인 상태에서 메모 N개 존재 → "모든 메모 삭제" → 메모 0개 + Supabase에서도 삭제 확인
  - [ ] 6-4. 개별 메모 삭제(스와이프/삭제 버튼)가 여전히 정상 동작하는지 확인
  - [ ] 6-5. 알림이 설정된 메모를 전체 삭제한 뒤, 해당 시간에 알림이 오지 않는지 확인

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/memos.svelte.ts` | `removeAll()` 메서드 추가, `remove()` 내 방어적 인덱스 재조회 |
| `src/lib/utils/data.ts` | `clearAllData()`를 async로 변경, `removeAll()` 사용 |
| `src/routes/settings/+page.svelte` | `confirmClearAll()`을 async로 변경, `await` 추가 |

## 작업 순서 및 의존 관계

```
Task 1 (remove 방어코드) ─┐
                           ├──→ Task 3 (clearAllData 변경) ──→ Task 4 (호출부 await) ──→ Task 5 (빌드) ──→ Task 6 (테스트)
Task 2 (removeAll 추가) ──┘
```

- Task 1, 2는 서로 독립적이므로 병렬 작업 가능
- Task 3은 Task 2에 의존 (`removeAll`을 사용하므로)
- Task 4는 Task 3에 의존 (async 시그니처 변경이 선행되어야 함)
- Task 5, 6은 모든 코드 변경 이후 순차 진행
