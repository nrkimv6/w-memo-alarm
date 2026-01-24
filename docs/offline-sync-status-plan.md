# 오프라인 동기화 상태 표시 기능 계획서

## 개요

사용자가 클라우드 동기화 지연 중에도 불안감 없이 앱을 사용할 수 있도록, 메모의 동기화 상태를 시각적으로 표시하는 기능을 구현합니다.

---

## 목표

1. **즉시 로딩 경험**: PWA 실행 시 서버 응답을 기다리지 않고 로컬 캐시를 즉시 표시
2. **동기화 상태 가시성**: 각 메모가 어떤 상태인지 사용자가 한눈에 파악
3. **충돌 인지**: 로컬 전용 메모와 서버 동기화된 메모를 구분하여 잠재적 충돌 상황 인지

---

## 현재 상태 분석

### 이미 구현된 것들 ✅

| 항목 | 상태 | 위치 |
|------|------|------|
| `syncStatus` 필드 | 존재 (`pending`, `synced`, `failed`) | `memos.svelte.ts` |
| localStorage 캐시 | 존재 (`memo-alarm-memos-cache`) | `memos.svelte.ts` |
| SyncQueue 서비스 | 존재 (오프라인 큐잉) | `syncQueue.ts` |
| 네트워크 상태 감지 | 존재 | `networkStatus.ts` |
| Optimistic Update | 구현됨 | `memos.svelte.ts` |

### 부족한 부분 ❌

1. **캐시 우선 로딩**: 현재는 Supabase 응답을 기다린 후 UI 표시
2. **상태 시각화**: `syncStatus`가 있지만 UI에서 표시하지 않음
3. **세분화된 상태**: '로컬 전용 캐시'와 '서버에서 가져온 최신'을 구분 못함

---

## 동기화 상태 정의

### 새로운 상태 체계

```typescript
type SyncStatus =
  | 'local-only'    // 🔵 로컬에만 있음 (캐시에서 로드, 서버 미확인)
  | 'synced'        // ✅ 서버와 동기화 완료
  | 'pending'       // 🟡 동기화 대기 중 (방금 추가/수정, 서버 반영 중)
  | 'failed'        // 🔴 동기화 실패 (재시도 필요)
```

### 상태별 의미와 시나리오

| 상태 | 의미 | 발생 시나리오 |
|------|------|--------------|
| `local-only` | 로컬 캐시에서 로드됨 | 앱 시작 시 서버 응답 전, 오프라인 상태 |
| `synced` | 서버와 완전히 동기화됨 | 서버에서 로드 완료, 저장 성공 |
| `pending` | 서버에 반영 중 | 메모 추가/수정 직후 (Optimistic Update) |
| `failed` | 동기화 실패 | 네트워크 오류, 충돌 발생 |

---

## UI/UX 설계

### 1. 상태 아이콘 디자인

메모 카드 우측 상단(또는 하단)에 작은 아이콘으로 표시:

```
┌─────────────────────────────┐
│ 메모 제목              🔵   │  ← 상태 아이콘
│                             │
│ 메모 내용...                │
│                             │
│ 📅 2025-01-24              │
└─────────────────────────────┘
```

### 2. 상태별 시각 표현

| 상태 | 아이콘 | 색상 | 툴팁 |
|------|--------|------|------|
| `local-only` | ☁️ (점선) 또는 📱 | 파란색 (`#3B82F6`) | "로컬에 저장됨 - 동기화 대기" |
| `synced` | ☁️ ✓ 또는 없음 | 초록색 (`#22C55E`) | "서버와 동기화됨" |
| `pending` | 🔄 (회전) | 노란색/주황색 (`#F59E0B`) | "동기화 중..." |
| `failed` | ⚠️ 또는 ☁️ ✗ | 빨간색 (`#EF4444`) | "동기화 실패 - 탭하여 재시도" |

### 3. 아이콘 표시 전략 (제안)

**옵션 A: 항상 표시**
- 모든 상태를 항상 아이콘으로 표시
- 장점: 일관성, 명확함
- 단점: UI가 복잡해질 수 있음

**옵션 B: 문제 상태만 표시 (권장)**
- `synced` 상태는 아이콘 숨김 (정상이므로)
- `local-only`, `pending`, `failed`만 표시
- 장점: 깔끔한 UI, 문제 상황에만 주의 환기
- 단점: 사용자가 동기화 완료를 명시적으로 못 봄

**옵션 C: 호버/탭 시 표시**
- 기본적으로 숨기고 호버/탭 시 상태 표시
- 장점: 가장 깔끔한 UI
- 단점: 모바일에서 호버 불가, 발견성 낮음

**권장안**: 옵션 B (문제 상태만 표시) + `synced`는 아주 작은 점으로 표시

### 4. 글로벌 동기화 상태 표시

앱 상단 또는 하단에 전체 동기화 상태 표시:

```
┌─────────────────────────────────────┐
│ 📝 메모          [🔄 3개 동기화 중] │  ← 헤더에 표시
├─────────────────────────────────────┤
│                                     │
│    메모 목록...                     │
│                                     │
└─────────────────────────────────────┘
```

또는 하단 토스트 스타일:

```
┌─────────────────────────────────────┐
│    메모 목록...                     │
│                                     │
├─────────────────────────────────────┤
│ ☁️ 오프라인 모드 - 변경사항 로컬 저장 │  ← 하단 배너
└─────────────────────────────────────┘
```

---

## 기술 구현 계획

### Phase 1: 캐시 우선 로딩 (Cache-First Loading)

**목표**: 앱 시작 시 로컬 캐시를 즉시 표시하고, 백그라운드에서 서버 동기화

**변경 파일**: `src/lib/stores/memos.svelte.ts`

```typescript
// 현재 로직
async function init() {
  if (authStore.isAuthenticated) {
    // Supabase에서 로드 (시간 소요)
    const { data } = await supabase.from('memos').select();
    memos = data;
  }
}

// 개선된 로직
async function init() {
  // 1. 즉시 캐시 로드 (동기)
  const cached = loadCacheFromStorage();
  if (cached.length > 0) {
    memos = cached.map(m => ({ ...m, syncStatus: 'local-only' }));
    loading = false;  // UI 즉시 표시
  }

  if (authStore.isAuthenticated) {
    // 2. 백그라운드에서 서버 동기화
    syncingFromServer = true;
    const { data } = await supabase.from('memos').select();

    // 3. 서버 데이터로 병합/업데이트
    memos = mergeMemos(cached, data);  // 서버 데이터 우선, 로컬 변경 보존
    syncingFromServer = false;
  }
}
```

### Phase 2: 상태 표시 컴포넌트

**새 파일**: `src/lib/components/SyncStatusIcon.svelte`

```svelte
<script lang="ts">
  import type { SyncStatus } from '$lib/types';

  export let status: SyncStatus;
  export let size: 'sm' | 'md' = 'sm';
</script>

{#if status === 'local-only'}
  <div class="sync-icon local" title="로컬에 저장됨">
    <CloudIcon variant="dotted" />
  </div>
{:else if status === 'pending'}
  <div class="sync-icon pending" title="동기화 중...">
    <SpinnerIcon />
  </div>
{:else if status === 'failed'}
  <div class="sync-icon failed" title="동기화 실패">
    <CloudOffIcon />
  </div>
{:else}
  <!-- synced: 작은 체크 또는 숨김 -->
{/if}
```

### Phase 3: 메모 카드에 적용

**변경 파일**: `src/lib/components/MemoCard.svelte`

```svelte
<div class="memo-card">
  <div class="memo-header">
    <h3>{memo.title}</h3>
    <SyncStatusIcon status={memo.syncStatus} />  <!-- 추가 -->
  </div>
  <!-- ... -->
</div>
```

### Phase 4: 글로벌 상태 표시

**변경 파일**: `src/routes/+layout.svelte` 또는 헤더 컴포넌트

```svelte
{#if memosStore.pendingCount > 0}
  <div class="sync-banner">
    🔄 {memosStore.pendingCount}개 메모 동기화 중...
  </div>
{/if}

{#if !networkStatus.isOnline}
  <div class="offline-banner">
    📴 오프라인 모드 - 변경사항은 로컬에 저장됩니다
  </div>
{/if}
```

---

## 상태 전이 다이어그램

```
                    ┌─────────────┐
                    │   앱 시작   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ 캐시 로드   │
                    │ local-only  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       [오프라인]    [서버 동기화]  [서버 실패]
              │            │            │
              ▼            ▼            ▼
        local-only     synced       local-only
              │            │            │
              │            │            │
    ┌─────────┼────────────┼────────────┤
    │    사용자 메모 추가/수정           │
    └─────────┬────────────┬────────────┘
              │            │
              ▼            ▼
           pending      pending
              │            │
      ┌───────┼───────┐    │
      │       │       │    │
   [실패]  [성공]  [오프라인] │
      │       │       │    │
      ▼       ▼       ▼    ▼
   failed   synced  pending synced
      │               │
      │ [재시도]       │ [온라인 복구]
      │               │
      └───────────────┘
```

---

## 데이터 병합 전략

서버 데이터와 로컬 캐시를 병합할 때:

### 규칙

1. **서버에 있는 메모**: 서버 버전 사용 (최신)
2. **로컬에만 있는 메모** (localId로 식별):
   - `pending` 상태면 유지 (아직 동기화 중)
   - `failed` 상태면 유지 (재시도 대기)
3. **양쪽에 있지만 버전 다름**: 서버 버전 우선 (충돌 방지)

### 구현 예시

```typescript
function mergeMemos(cached: Memo[], server: Memo[]): Memo[] {
  const serverMap = new Map(server.map(m => [m.id, m]));
  const result: Memo[] = [];

  // 1. 서버 메모 추가 (synced)
  for (const memo of server) {
    result.push({ ...memo, syncStatus: 'synced' });
  }

  // 2. 로컬 전용 메모 추가 (pending/failed 유지)
  for (const memo of cached) {
    if (memo.id?.startsWith('local_') && !serverMap.has(memo.id)) {
      result.push(memo);  // pending/failed 상태 유지
    }
  }

  return result;
}
```

---

## 내 의견 및 제안

### 1. 상태 표시 위치

**권장**: 메모 카드 우측 상단 작은 아이콘
- 시선이 자연스럽게 가는 위치
- 메모 내용을 방해하지 않음
- 모바일에서도 탭 가능한 크기 유지

### 2. 색상 체계

기존 앱의 색상 팔레트와 조화를 이루도록:
- 다크모드 대응 필수
- 색맹 사용자 고려 (색상만으로 구분 X, 아이콘 형태도 다르게)

### 3. 성능 고려

- 상태 아이콘은 CSS-only 애니메이션 사용 (JS 애니메이션 피함)
- `pending` 스피너는 `transform` 기반 (reflow 방지)
- 대량의 메모가 있을 때 아이콘 렌더링 최적화

### 4. 사용자 교육

- 첫 실행 시 간단한 온보딩 툴팁 추가 고려
- "이 아이콘은 동기화 상태를 나타냅니다" 설명

### 5. 추가 고려사항

**오프라인 배너**: 앱 전체가 오프라인일 때 상단/하단에 배너 표시
- 개별 메모 아이콘보다 먼저 눈에 들어옴
- 사용자가 "왜 동기화가 안 되지?" 의문 해소

**자동 재시도 피드백**:
- SyncQueue가 백그라운드에서 재시도할 때 사용자에게 피드백
- "3개 메모 동기화 완료" 토스트 메시지

---

## 구현 우선순위

### MVP (필수)

1. ✅ 캐시 우선 로딩 구현
2. ✅ `SyncStatusIcon` 컴포넌트 생성
3. ✅ 메모 카드에 상태 아이콘 적용
4. ✅ 오프라인 배너 추가

### Phase 2 (권장)

5. 글로벌 동기화 상태 표시 (헤더)
6. 동기화 완료 토스트 메시지
7. 실패 시 탭하여 재시도 기능

### Phase 3 (선택)

8. 온보딩 툴팁
9. 동기화 상세 보기 (설정에서)
10. 충돌 발생 시 사용자 선택 UI

---

## 예상 작업량

| 작업 | 파일 | 예상 난이도 |
|------|------|-------------|
| 캐시 우선 로딩 | `memos.svelte.ts` | 중 |
| SyncStatusIcon 컴포넌트 | 신규 파일 | 하 |
| 메모 카드 수정 | `MemoCard.svelte` 등 | 하 |
| 오프라인 배너 | `+layout.svelte` | 하 |
| 글로벌 상태 표시 | 헤더 컴포넌트 | 중 |
| 스타일링 (다크모드 포함) | CSS | 하 |

---

## 테스트 시나리오

1. **앱 시작 테스트**
   - 오프라인 상태로 앱 시작 → 캐시된 메모 표시 (local-only)
   - 온라인 상태로 앱 시작 → 캐시 먼저 표시 후 서버 동기화

2. **메모 추가 테스트**
   - 온라인: 추가 → pending → synced
   - 오프라인: 추가 → pending (유지)

3. **네트워크 전환 테스트**
   - 온라인 → 오프라인: 배너 표시
   - 오프라인 → 온라인: pending 메모들 자동 동기화 → synced

4. **동기화 실패 테스트**
   - 서버 오류 시 → failed 상태 + 재시도 버튼

---

## 결론

이 기능은 사용자 경험을 크게 개선할 것입니다:

1. **즉각적인 피드백**: 앱 시작 시 빈 화면 대신 캐시된 메모 즉시 표시
2. **투명성**: 각 메모의 상태를 명확히 알 수 있어 안심하고 사용
3. **신뢰성**: 오프라인에서도 데이터 손실 걱정 없이 작업 가능

기존 코드베이스에 `syncStatus` 필드와 관련 인프라가 이미 있어서, 비교적 적은 변경으로 구현 가능합니다.
