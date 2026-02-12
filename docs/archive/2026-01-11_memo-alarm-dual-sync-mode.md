# Memo Alarm - 이중 동기화 모드 구현 계획

> **작성일**: 2026-01-11
> **업데이트**: 2026-01-28
> **대상 프로젝트**: memo-alarm
> **상태**: ❌ 취소됨 (단일 모드 채택)
> **구현율**: 100% (Supabase Auth만 구현)
> **결정**: D1 코드 동기화 제거, Supabase 로그인 방식만 사용
> **우선순위**: N/A (계획 변경)

---

## ⚠️ 계획 변경 공지 (2026-01-28)

**원래 계획**: 코드 방식(D1) + 로그인 방식(Supabase) 이중 모드 지원

**실제 구현**: 로그인 방식(Supabase) 단일 모드만 채택

**변경 이유**:
- Phase 7 (Auth 통합) 진행 중 D1 코드 동기화 전면 제거 결정
- Supabase online-first 아키텍처로 전환 완료
- 보안 및 유지보수 측면에서 단일 모드가 더 효율적

**현재 상태**:
- ✅ Supabase Auth (Google/Kakao 로그인) 완료
- ✅ Realtime 동기화 완료
- ✅ 오프라인 폴백 (localStorage) 구현 완료
- ❌ D1 코드 동기화 제거됨

**참고 문서**: `memo-alarm/docs/archive/2026-01-12_memo-alarm-online-first.md`

---

## 1. 개요 (원본 계획)

memo-alarm에 **코드 방식 동기화**와 **로그인 방식 동기화**를 모두 지원하는 이중 모드를 구현합니다.

### 원래 목표 (취소됨)

사용자가 **선택**할 수 있도록 두 방식을 모두 제공:
- ~~**간편 모드**: 6자리 코드 (빠른 연결, 보안 약함)~~ → **제거됨**
- **안전 모드**: 로그인 (OAuth, 보안 강화, 계정 복구 가능) → **✅ 구현 완료**

---

## 2. 사용자 시나리오

### 시나리오 A: 간편 모드 (코드 방식)
```
사용자 → 설정 → "간편 동기화" 선택
     → 6자리 코드 생성/입력
     → D1 데이터베이스에 저장
     → 다른 기기에서 동일 코드 입력으로 연결
```

**장점**:
- 로그인 불필요
- 즉시 사용 가능
- 간편한 기기 간 연결

**단점**:
- 코드 유출 시 타인 접근 가능
- 코드 분실 시 복구 불가
- Brute-force 공격 취약

### 시나리오 B: 안전 모드 (로그인 방식)
```
사용자 → 설정 → "안전 동기화" 선택
     → Google/Kakao 로그인
     → Supabase Auth 세션 생성
     → Supabase 데이터베이스에 저장
     → 다른 기기에서 동일 계정으로 자동 동기화
```

**장점**:
- OAuth 기반 보안
- 계정 복구 가능
- 기기 관리 가능
- Brute-force 방지

**단점**:
- 로그인 필요
- 외부 의존성 (Supabase)

---

## 3. 아키텍처 설계

### 3.1 데이터 흐름

```
┌─────────────────────────────────────────────────────┐
│                   memo-alarm App                     │
│                                                       │
│  ┌───────────────┐          ┌──────────────────┐   │
│  │  Sync Store   │          │   Auth Store     │   │
│  │  (코드 방식)   │          │   (로그인 방식)    │   │
│  └───────┬───────┘          └────────┬─────────┘   │
│          │                           │              │
│          ▼                           ▼              │
│  ┌───────────────┐          ┌──────────────────┐   │
│  │  Sync Mode    │◄─────────┤  Sync Mode       │   │
│  │  Selector     │  사용자 선택 │  Selector       │   │
│  └───────┬───────┘          └────────┬─────────┘   │
│          │                           │              │
└──────────┼───────────────────────────┼──────────────┘
           │                           │
           ▼                           ▼
  ┌────────────────┐          ┌────────────────┐
  │  D1 Database   │          │    Supabase    │
  │  (Workers)     │          │  (Auth + DB)   │
  └────────────────┘          └────────────────┘
```

### 3.2 모드 전환 로직

| 현재 모드 | 전환 → | 새 모드 | 데이터 처리 |
|----------|--------|---------|------------|
| 없음 | → | 코드 방식 | 신규 코드 생성, D1 저장 |
| 없음 | → | 로그인 방식 | OAuth 로그인, Supabase 저장 |
| 코드 방식 | → | 로그인 방식 | **마이그레이션**: D1 데이터 → Supabase 복사 |
| 로그인 방식 | → | 코드 방식 | **경고 후 허용**: Supabase 데이터 유지, 코드 병행 |

**중요**: 두 방식 **동시 활성화 가능** (고급 사용자용)

---

## 4. 구현 계획

### Phase 1: 기반 구축 (P0)

#### 1.1 동기화 모드 타입 정의

```typescript
// src/lib/types/sync.ts (추가)

export type SyncMode = 'none' | 'code' | 'auth' | 'both';

export interface SyncConfig {
  mode: SyncMode;
  codeSync?: {
    enabled: boolean;
    syncCode?: string;
    lastSyncAt?: number;
  };
  authSync?: {
    enabled: boolean;
    provider?: 'google' | 'kakao';
    lastSyncAt?: number;
  };
}
```

#### 1.2 통합 동기화 스토어 생성

```typescript
// src/lib/stores/unifiedSync.svelte.ts (신규)

import { syncStore } from './sync.svelte'; // 기존 코드 방식
import { authStore } from './auth.svelte'; // 신규 로그인 방식

class UnifiedSyncStore {
  config = $state<SyncConfig>({
    mode: 'none'
  });

  // 코드 방식 동기화 시작
  async enableCodeSync(deviceName?: string) {
    await syncStore.register(deviceName);
    this.config.mode = this.config.mode === 'auth' ? 'both' : 'code';
    this.config.codeSync = { enabled: true };
  }

  // 로그인 방식 동기화 시작
  async enableAuthSync(provider: 'google' | 'kakao') {
    await authStore.login(provider);
    this.config.mode = this.config.mode === 'code' ? 'both' : 'auth';
    this.config.authSync = { enabled: true, provider };
  }

  // 모드별 동기화 실행
  async sync() {
    const promises: Promise<boolean>[] = [];

    if (this.config.codeSync?.enabled) {
      promises.push(syncStore.sync());
    }

    if (this.config.authSync?.enabled) {
      promises.push(authStore.sync());
    }

    return Promise.all(promises);
  }

  // 코드 방식 비활성화
  async disableCodeSync() {
    syncStore.disconnect();
    this.config.codeSync = { enabled: false };
    this.updateMode();
  }

  // 로그인 방식 비활성화
  async disableAuthSync() {
    await authStore.signOut();
    this.config.authSync = { enabled: false };
    this.updateMode();
  }

  private updateMode() {
    const hasCode = this.config.codeSync?.enabled;
    const hasAuth = this.config.authSync?.enabled;

    if (hasCode && hasAuth) this.config.mode = 'both';
    else if (hasCode) this.config.mode = 'code';
    else if (hasAuth) this.config.mode = 'auth';
    else this.config.mode = 'none';
  }
}

export const unifiedSyncStore = new UnifiedSyncStore();
```

### Phase 2: Auth 시스템 구현 (P0)

> **참고**: [2026-01-09_memo-alarm-auth-system.md](2026-01-09_memo-alarm-auth-system.md)

#### 2.1 Supabase 설정

- [x] `@supabase/supabase-js` 패키지 설치
- [ ] `.env` 파일에 환경변수 추가
  ```env
  VITE_SUPABASE_URL=https://xxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJxxx...
  ```
- [ ] `src/lib/services/supabase.ts` 생성

#### 2.2 Auth Worker 설정

- [ ] `auth-worker/src/config.ts`에 `memo-alarm` 등록 확인
  - appId: `memo-alarm`
  - origins: `https://memo.woory.day`, `http://localhost:5173`
  - androidScheme: `day.woory.memoalarm`

#### 2.3 Auth 스토어 구현

- [ ] `src/lib/stores/auth.svelte.ts` 생성
  - 참고: `line-minder/src/lib/stores/auth.svelte.ts`
  - 세션 관리, 로그인/로그아웃, 자동 동기화

#### 2.4 로그인 UI

- [ ] `src/routes/settings/login/+page.svelte` 생성
  - Google/Kakao 로그인 버튼
  - Auth Worker 리다이렉트 처리

#### 2.5 콜백 페이지

- [ ] `src/routes/auth/callback/+page.svelte` 생성
  - 참고: `line-minder/src/routes/auth/callback/+page.svelte`
  - Query params & Hash fragment 파싱
  - `signInWithIdToken` 처리

#### 2.6 Supabase 데이터베이스 스키마

```sql
-- Supabase: memos 테이블
CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  emoji TEXT,
  tags TEXT[], -- PostgreSQL array
  is_pinned BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  open_count INTEGER DEFAULT 0,
  folder_id TEXT,
  checklist JSONB,
  reminder JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Supabase: folders 테이블
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_memos_user_id ON memos(user_id);
CREATE INDEX idx_memos_deleted_at ON memos(deleted_at);
CREATE INDEX idx_folders_user_id ON folders(user_id);
```

### Phase 3: UI 통합 (P1)

#### 3.1 설정 페이지 개선

```svelte
<!-- src/routes/settings/+page.svelte -->

<section class="space-y-4">
  <h2 class="font-semibold flex items-center gap-2">
    <Cloud class="w-5 h-5" />
    동기화 설정
  </h2>

  <div class="bg-card rounded-xl border border-border p-5 space-y-4">
    <!-- 동기화 모드 선택 -->
    <div class="flex gap-2">
      <button
        onclick={() => setMode('code')}
        class="flex-1 p-4 rounded-lg border {mode === 'code' || mode === 'both' ? 'border-primary bg-primary/5' : 'border-border'}"
      >
        <div class="text-sm font-semibold">간편 동기화</div>
        <div class="text-xs text-muted-foreground">6자리 코드</div>
      </button>

      <button
        onclick={() => setMode('auth')}
        class="flex-1 p-4 rounded-lg border {mode === 'auth' || mode === 'both' ? 'border-primary bg-primary/5' : 'border-border'}"
      >
        <div class="text-sm font-semibold">안전 동기화</div>
        <div class="text-xs text-muted-foreground">로그인 필요</div>
      </button>
    </div>

    <!-- 코드 방식 UI -->
    {#if mode === 'code' || mode === 'both'}
      <div class="border-t pt-4">
        <h3 class="text-sm font-semibold mb-2">간편 동기화 (코드 방식)</h3>
        {#if unifiedSyncStore.config.codeSync?.enabled}
          <div class="flex items-center gap-2">
            <span class="font-mono text-lg">{syncStore.user?.syncCode}</span>
            <Button size="sm" onclick={copyCode}>
              {copied ? <Check class="w-4 h-4" /> : <Copy class="w-4 h-4" />}
            </Button>
          </div>
          <Button variant="outline" size="sm" onclick={() => unifiedSyncStore.disableCodeSync()}>
            연결 해제
          </Button>
        {:else}
          <Input bind:value={syncCodeInput} placeholder="코드 입력 (6자리)" />
          <div class="flex gap-2">
            <Button onclick={handleCodeConnect}>코드로 연결</Button>
            <Button variant="outline" onclick={handleCodeRegister}>새 코드 생성</Button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- 로그인 방식 UI -->
    {#if mode === 'auth' || mode === 'both'}
      <div class="border-t pt-4">
        <h3 class="text-sm font-semibold mb-2">안전 동기화 (로그인)</h3>
        {#if authStore.user}
          <div class="flex items-center gap-2">
            <span>{authStore.user.email}</span>
            <Badge>{authStore.user.app_metadata.provider}</Badge>
          </div>
          <Button variant="outline" size="sm" onclick={() => unifiedSyncStore.disableAuthSync()}>
            로그아웃
          </Button>
        {:else}
          <div class="flex gap-2">
            <Button onclick={() => handleAuthLogin('google')}>
              Google로 로그인
            </Button>
            <Button onclick={() => handleAuthLogin('kakao')}>
              Kakao로 로그인
            </Button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- 동기화 상태 -->
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted-foreground">마지막 동기화</span>
      <span>{lastSyncTime || '없음'}</span>
    </div>

    <!-- 수동 동기화 버튼 -->
    <Button
      onclick={() => unifiedSyncStore.sync()}
      disabled={mode === 'none'}
      class="w-full"
    >
      <RefreshCw class="w-4 h-4 mr-2" />
      지금 동기화
    </Button>
  </div>
</section>
```

#### 3.2 모드별 안내 메시지

```svelte
<!-- 모드 선택 시 안내 -->
{#if showModeInfo}
  <div class="alert alert-info">
    {#if selectedMode === 'code'}
      <p class="text-sm">
        <strong>간편 동기화</strong>: 6자리 코드로 빠르게 기기를 연결할 수 있습니다.
        <br/>⚠️ 코드 유출 시 타인이 접근할 수 있으니 주의하세요.
      </p>
    {:else if selectedMode === 'auth'}
      <p class="text-sm">
        <strong>안전 동기화</strong>: Google/Kakao 로그인으로 안전하게 데이터를 보호합니다.
        <br/>✅ 계정 복구 가능, 기기 관리 지원
      </p>
    {/if}
  </div>
{/if}
```

### Phase 4: 데이터 마이그레이션 (P1)

#### 4.1 코드 → 로그인 마이그레이션

```typescript
// src/lib/utils/migration.ts (신규)

export async function migrateCodeToAuth() {
  // 1. 현재 코드 방식 데이터 가져오기 (D1)
  const localData = {
    memos: memosStore.memos,
    folders: foldersStore.folders
  };

  // 2. Supabase에 업로드
  const { error } = await supabase
    .from('memos')
    .upsert(localData.memos.map(memoToSupabase));

  if (error) {
    console.error('Migration failed:', error);
    return false;
  }

  // 3. 마이그레이션 완료 플래그 저장
  localStorage.setItem('migrated_to_auth', 'true');

  return true;
}

function memoToSupabase(memo: Memo) {
  return {
    id: memo.id,
    user_id: authStore.user?.id,
    title: memo.title,
    content: memo.content,
    url: memo.url,
    emoji: memo.emoji,
    tags: memo.tags,
    is_pinned: memo.isPinned,
    is_favorite: memo.isFavorite,
    open_count: memo.openCount || 0,
    folder_id: memo.folderId,
    checklist: memo.checklist,
    reminder: memo.reminder,
    created_at: new Date(memo.createdAt).toISOString(),
    updated_at: new Date(memo.updatedAt).toISOString()
  };
}
```

#### 4.2 마이그레이션 UI

```svelte
<!-- 설정 페이지에 마이그레이션 버튼 추가 -->
{#if mode === 'code' && authStore.user}
  <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <h3 class="text-sm font-semibold mb-2">데이터 이전</h3>
    <p class="text-xs text-muted-foreground mb-3">
      간편 동기화 데이터를 안전 동기화로 이전하시겠습니까?
    </p>
    <Button size="sm" onclick={handleMigration}>
      데이터 이전하기
    </Button>
  </div>
{/if}
```

### Phase 5: Native 앱 설정 (P1)

#### 5.1 Capacitor 설정

```typescript
// capacitor.config.ts (수정)
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'day.woory.memoalarm',
  appName: 'Memo Alarm',
  webDir: 'build',
  server: {
    androidScheme: 'day.woory.memoalarm' // Deep Link 스킴
  }
};

export default config;
```

#### 5.2 AndroidManifest.xml

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<activity
  android:name=".MainActivity"
  android:exported="true"
  android:launchMode="singleTask">

  <!-- 기존 launcher intent -->
  <intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>

  <!-- Deep Link Intent Filter 추가 -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="day.woory.memoalarm" />
  </intent-filter>
</activity>
```

---

## 5. 충돌 해결 전략

### 5.1 동시 활성화 시 (both 모드)

```typescript
// 두 방식 모두 활성화 시 동기화 순서
async function syncBothModes() {
  // 1. 코드 방식 동기화 (D1)
  const codeResult = await syncStore.sync();

  // 2. 로그인 방식 동기화 (Supabase)
  const authResult = await authStore.sync();

  // 3. 충돌 확인 및 해결
  if (codeResult && authResult) {
    await resolveConflicts();
  }
}

async function resolveConflicts() {
  // 최신 타임스탬프 우선 전략
  const codeMemos = memosStore.memos; // D1에서 가져온 데이터
  const authMemos = await fetchSupabaseMemos(); // Supabase에서 가져온 데이터

  const mergedMemos = mergeMemosByTimestamp(codeMemos, authMemos);
  memosStore.setMemos(mergedMemos);
}

function mergeMemosByTimestamp(source1: Memo[], source2: Memo[]): Memo[] {
  const memoMap = new Map<string, Memo>();

  // 모든 메모를 맵에 추가, 최신 것만 유지
  [...source1, ...source2].forEach(memo => {
    const existing = memoMap.get(memo.id);
    if (!existing || memo.updatedAt > existing.updatedAt) {
      memoMap.set(memo.id, memo);
    }
  });

  return Array.from(memoMap.values());
}
```

### 5.2 충돌 UI 알림

```svelte
{#if hasConflicts}
  <div class="alert alert-warning">
    <p class="text-sm">
      동기화 충돌이 감지되었습니다. 최신 데이터를 자동으로 병합했습니다.
    </p>
    <Button size="sm" onclick={viewConflictLog}>상세 보기</Button>
  </div>
{/if}
```

---

## 6. 보안 고려사항

### 6.1 코드 방식 보안 개선

```typescript
// D1 API 엔드포인트에 Rate Limiting 추가
// src/routes/api/sync/+server.ts

const RATE_LIMIT = 10; // 10분당 최대 시도 횟수
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST({ request, platform }) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Rate Limiting 체크
  const now = Date.now();
  const limit = rateLimitMap.get(clientIP);

  if (limit && limit.resetAt > now) {
    if (limit.count >= RATE_LIMIT) {
      return json({ success: false, error: '너무 많은 시도입니다. 나중에 다시 시도하세요.' }, { status: 429 });
    }
    limit.count++;
  } else {
    rateLimitMap.set(clientIP, { count: 1, resetAt: now + 10 * 60 * 1000 });
  }

  // 기존 로직...
}
```

### 6.2 로그인 방식 보안

- Supabase RLS (Row Level Security) 활성화
- JWT 토큰 자동 갱신
- HTTPS 강제

---

## 7. 테스트 계획

### 7.1 단위 테스트

| 테스트 항목 | 설명 |
|-----------|------|
| 코드 생성 | 6자리 코드 생성 정상 작동 |
| 코드 연결 | 올바른 코드로 연결 성공 |
| 로그인 | Google/Kakao 로그인 정상 작동 |
| 동기화 (코드) | D1 데이터 push/pull 정상 |
| 동기화 (Auth) | Supabase 데이터 push/pull 정상 |
| 모드 전환 | 코드 ↔ Auth 전환 정상 |
| 마이그레이션 | 코드 → Auth 데이터 이전 정상 |
| 충돌 해결 | 최신 데이터 우선 병합 확인 |

### 7.2 통합 테스트

| 시나리오 | 예상 결과 |
|---------|----------|
| 코드 방식만 사용 | D1 동기화만 작동 |
| 로그인 방식만 사용 | Supabase 동기화만 작동 |
| 두 방식 동시 사용 | 충돌 없이 병합 |
| 코드 → Auth 전환 | 데이터 손실 없음 |
| Auth → 코드 전환 | 경고 표시 후 허용 |

### 7.3 실사용 테스트

- [ ] 웹: 코드 방식 동기화
- [ ] 웹: 로그인 방식 동기화 (Google)
- [ ] 웹: 로그인 방식 동기화 (Kakao)
- [ ] 네이티브: 코드 방식 동기화
- [ ] 네이티브: 로그인 방식 동기화 (Google)
- [ ] 네이티브: 로그인 방식 동기화 (Kakao)
- [ ] 두 방식 동시 사용 (both 모드)
- [ ] 마이그레이션 테스트

---

## 8. 파일 변경 목록

### 신규 파일

| 파일 | 설명 |
|------|------|
| `src/lib/stores/auth.svelte.ts` | Auth 스토어 (로그인 방식) |
| `src/lib/stores/unifiedSync.svelte.ts` | 통합 동기화 스토어 |
| `src/lib/services/supabase.ts` | Supabase 클라이언트 |
| `src/lib/utils/migration.ts` | 마이그레이션 유틸 |
| `src/routes/settings/login/+page.svelte` | 로그인 페이지 |
| `src/routes/auth/callback/+page.svelte` | OAuth 콜백 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/types/sync.ts` | `SyncMode`, `SyncConfig` 타입 추가 |
| `src/routes/settings/+page.svelte` | 동기화 모드 선택 UI 추가 |
| `capacitor.config.ts` | `androidScheme` 추가 |
| `android/app/src/main/AndroidManifest.xml` | Deep Link Intent Filter 추가 |
| `package.json` | `@supabase/supabase-js` 추가 |
| `.env` | Supabase 환경변수 추가 |

---

## 9. 환경 변수

```env
# Supabase (로그인 방식)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Cloudflare (코드 방식, 기존)
# wrangler.toml에서 관리
```

---

## 10. 다음 단계

1. **Phase 1 완료**: 타입 정의 및 통합 스토어 생성
2. **Phase 2 완료**: Auth 시스템 구현 (Supabase + Auth Worker)
3. **Phase 3 완료**: UI 통합 (설정 페이지 개선)
4. **Phase 4 완료**: 마이그레이션 기능 구현
5. **Phase 5 완료**: Native 앱 설정
6. **테스트**: 모든 시나리오 검증
7. **배포**: Cloudflare Workers + Android APK 빌드

---

## 11. 참고 문서

- [Auth Worker 통합 계획](2026-01-08_auth-integration-plan.md)
- [Memo Alarm Auth 시스템](2026-01-09_memo-alarm-auth-system.md)
- 참고 구현: `line-minder`, `sacred-hours` (Auth 완료)
- Supabase 공식 문서: https://supabase.com/docs/guides/auth

---

**작성자**: Claude
**검토자**: 대기 중
**승인**: 대기 중
