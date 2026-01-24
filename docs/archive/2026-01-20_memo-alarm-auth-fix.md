# memo-alarm Auth 동기화 수정 계획

> 작성일: 2026-01-20
> 대상 프로젝트: memo-alarm
> 상태: ✅ 완료 (2026-01-20)
> 우선순위: P0 (긴급)

---

## 문제 요약

**증상**: 로그인 방식 동기화가 전혀 작동하지 않음

**원인**: `auth.svelte.ts`가 구 아키텍처(`user_data` 테이블) 코드를 그대로 사용 중

**현황**:
- ✅ `memos.svelte.ts`: Supabase `memos` 테이블 사용 (online-first)
- ✅ `folders.svelte.ts`: Supabase `folders` 테이블 사용 (online-first)
- ❌ `auth.svelte.ts`: 여전히 `user_data` 테이블 사용 (코드 방식)

---

## 현재 아키텍처 vs 목표 아키텍처

### 현재 (잘못된 구현)

```
auth.svelte.ts
  ├─ user_data 테이블 사용 (존재하지 않음!)
  └─ 로그인 시 uploadToServer() → user_data.upsert() → 실패

memos.svelte.ts
  └─ memos 테이블 사용 (정상 작동)

folders.svelte.ts
  └─ folders 테이블 사용 (정상 작동)
```

### 목표 (올바른 구현)

```
auth.svelte.ts
  ├─ 로그인 시: 자동 동기화 제거 (Realtime이 알아서 함)
  └─ 역할: 세션 관리만

memos.svelte.ts
  ├─ Supabase memos 테이블 CRUD
  └─ Realtime 구독 (자동 동기화)

folders.svelte.ts
  ├─ Supabase folders 테이블 CRUD
  └─ Realtime 구독 (자동 동기화)
```

---

## 수정 항목

| 우선순위 | 항목 | 설명 | 소요 시간 |
|:-------:|------|------|:--------:|
| P0 | auth.svelte.ts 간소화 | 동기화 로직 완전 제거 | 30분 |
| P0 | 코드 검증 | 로그인/로그아웃 테스트 | 30분 |
| P1 | 문서 업데이트 | TODO.md, DONE.md 수정 | 10분 |

**총 소요**: 1-1.5시간

---

## auth.svelte.ts 수정 방향

### 제거할 코드

```typescript
// ❌ 제거: checkAndSyncData()
// ❌ 제거: uploadToServer()
// ❌ 제거: downloadFromServer()
// ❌ 제거: sync() 메서드
// ❌ 제거: user_data 테이블 관련 모든 코드
// ❌ 제거: LAST_SYNC_KEY
```

### 유지할 코드

```typescript
// ✅ 유지: initialize()
// ✅ 유지: signInWithGoogle()
// ✅ 유지: signInWithKakao()
// ✅ 유지: signOut()
// ✅ 유지: onAuthStateChange 리스너
```

### 수정할 코드

```typescript
// SIGNED_IN 이벤트 핸들러
supabase.auth.onAuthStateChange(async (event, newSession) => {
  console.log('[Auth] State changed:', event);
  state.session = newSession;
  state.user = newSession?.user || null;

  if (event === 'SIGNED_IN' && newSession?.user) {
    // ❌ 제거: await checkAndSyncData(newSession.user.id);
    // ✅ 추가: Store 초기화만 수행
    await memosStore.init();
    await foldersStore.init();
    toastStore.success('로그인되었습니다');
  } else if (event === 'SIGNED_OUT') {
    state.user = null;
    state.session = null;
    // ✅ 추가: Store 클린업
    memosStore.cleanup();
    foldersStore.cleanup();
    toastStore.info('로그아웃되었습니다');
  }
});
```

---

## 새로운 auth.svelte.ts 구조

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  initializing: boolean;
  // ❌ 제거: syncing
}

function createAuthStore() {
  let state = $state<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    initialized: false,
    initializing: false
  });

  // 초기화
  async function initialize() { ... }

  // Google/Kakao 로그인
  async function signInWithGoogle() { ... }
  async function signInWithKakao() { ... }

  // 로그아웃
  async function signOut() { ... }

  return {
    get user() { return state.user; },
    get session() { return state.session; },
    get loading() { return state.loading; },
    get error() { return state.error; },
    get isAuthenticated() { return !!state.user; },
    // ❌ 제거: get syncing()
    // ❌ 제거: sync()

    initialize,
    signInWithGoogle,
    signInWithKakao,
    signOut
  };
}
```

---

## settings/+page.svelte 수정

### 제거할 UI

```svelte
<!-- ❌ 제거: "지금 동기화" 버튼 -->
<Button
  variant="secondary"
  size="sm"
  onclick={() => authStore.sync()}
  disabled={authStore.syncing}
  class="flex-1"
>
  <RefreshCw class={cn('w-4 h-4', authStore.syncing && 'animate-spin')} />
  {authStore.syncing ? '동기화 중...' : '지금 동기화'}
</Button>
```

### 수정 후

```svelte
{#if authStore.isAuthenticated}
  <!-- 로그인됨 -->
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-success">로그인됨</span>
    </div>

    <div class="text-sm">
      {#if authStore.user}
        <p class="font-medium">{getUserDisplayName(authStore.user)}</p>
        {#if getUserEmail(authStore.user)}
          <p class="text-xs text-muted-foreground">
            {getUserEmail(authStore.user)}
          </p>
        {/if}
      {/if}
    </div>

    <!-- ✅ 로그아웃 버튼만 -->
    <Button variant="ghost" size="sm" onclick={() => authStore.signOut()} class="w-full">
      <LogOut class="w-4 h-4" />
      로그아웃
    </Button>

    <p class="text-xs text-muted-foreground">
      데이터는 자동으로 동기화됩니다.
    </p>
  </div>
{:else}
  <!-- 미로그인 -->
  ...
{/if}
```

---

## 구현 순서

### Phase 1: auth.svelte.ts 수정 (30분) ✅ 완료

1. [x] 불필요한 상태 제거 (`syncing`)
2. [x] 동기화 관련 함수 제거
   - `checkAndSyncData()`
   - `uploadToServer()`
   - `downloadFromServer()`
   - `sync()`
   - `setLastSyncTime()`
   - `getLastSyncTime()`
3. [x] `onAuthStateChange` 핸들러 수정
   - SIGNED_IN: Store init 호출만
   - SIGNED_OUT: Store cleanup 호출
4. [x] 반환 인터페이스 정리

### Phase 2: settings/+page.svelte 수정 (10분) ✅ 완료

5. [x] "지금 동기화" 버튼 제거
6. [x] "데이터는 자동으로 동기화됩니다" 안내 추가
7. [x] import 정리 (RefreshCw 제거)

### Phase 3: 테스트 (30분) ✅ 완료

8. [x] 빌드 확인 - 성공 (경고만 존재)

### Phase 4: 문서 업데이트 (10분) ✅ 완료

11. [x] `TODO.md` 업데이트
    - Phase 7 상태를 "✅ 완료 (2026-01-12, 2026-01-20 수정 완료)"로 수정
12. [x] `DONE.md` 업데이트
    - 2026-01-20 항목 추가
13. [x] `memo-alarm/docs/archive/2026-01-12_memo-alarm-online-first.md` 수정
    - Phase 2 Step 7 완료 체크

---

## 완료 조건

- [x] auth.svelte.ts에 `user_data` 테이블 관련 코드 0개
- [x] settings 페이지에 "지금 동기화" 버튼 제거
- [x] 빌드 성공
- [x] 문서 업데이트 및 커밋

---

## 참고

- line-minder, sacred-hours도 동일 문제 확인 필요
- gentle-words, activity-hub, tool-view, screenshot-generator도 점검 필요

---

*상태: ✅ 구현 완료 (2026-01-20)*

**⚠️ 중요**: 프로덕션 테스트는 사용자가 직접 수행. Claude가 수동 테스트를 권장하지 말 것.
