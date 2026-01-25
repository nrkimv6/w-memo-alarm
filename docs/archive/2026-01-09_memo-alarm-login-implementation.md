# memo-alarm 로그인 기능 구현

> 작성일: 2026-01-09
> 대상 프로젝트: memo-alarm
> 상태: 🟢 대부분 완료
> 구현율: ~85%
> 완료: P0-P2 (Supabase 서비스, Auth 스토어, 로그인/콜백 페이지, 동기화 통합)
> 미구현: P3 (Native 앱 Deep Link 설정)
> 점검일: 2026-01-19
> 참고 프로젝트: line-minder, gifticon-manager

---

## 개요

### 배경

현재 memo-alarm은 로컬 동기화 시스템(`src/lib/stores/sync.svelte.ts`)만 구현되어 있어 다음과 같은 문제가 있습니다:

1. **멀티디바이스 지원 불가**: 6자리 코드 기반 로컬 동기화만 가능
2. **데이터 손실 위험**: 서버 재시작 시 동기화 데이터 손실 가능
3. **사용자 인증 부재**: 클라우드 기반 인증 시스템 없음
4. **다른 앱과의 일관성 부족**: line-minder, sacred-hours는 Supabase OAuth 사용 중

### 목적

line-minder의 검증된 로그인 구현을 참고하여 memo-alarm에 Supabase 기반 Google/Kakao OAuth 로그인을 추가합니다.

### 참고 구현

| 앱 | 상태 | 참고 사항 |
|---|---|---|
| **line-minder** | ✅ 동작 중 | 주요 참고 (구조가 memo-alarm과 유사) |
| **gifticon-manager** | ✅ 동작 중 | 보조 참고 (sync.ts 참고) |
| **sacred-hours** | ⚠️ 동작 안함 | 참고 불가 |

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 | 예상 파일 |
|:-------:|------|------|:------:|----------|
| **P0** | 패키지 설치 | @supabase/supabase-js, @capacitor/browser 설치 | 낮음 | package.json |
| **P0** | Supabase 서비스 생성 | authService, syncService 구현 | 중간 | src/lib/services/supabase.ts |
| **P0** | 환경변수 설정 | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY | 낮음 | .env |
| **P1** | Auth 스토어 생성 | 인증 상태 관리 (user, session, loading) | 중간 | src/lib/stores/auth.svelte.ts |
| **P1** | 로그인 페이지 | Google/Kakao 로그인 버튼 UI | 중간 | src/routes/login/+page.svelte |
| **P1** | 콜백 페이지 | OAuth 토큰 처리 (Query + Hash fragment) | 중간 | src/routes/auth/callback/+page.svelte |
| **P2** | 메모 동기화 통합 | memos.svelte.ts에 Supabase 동기화 추가 | 높음 | src/lib/stores/memos.svelte.ts |
| **P2** | Supabase 테이블 설계 | memos, folders 테이블 스키마 | 중간 | supabase/migrations/ |
| **P2** | 설정 페이지 업데이트 | 로그인/로그아웃 버튼 추가 | 낮음 | src/routes/settings/+page.svelte |
| **P3** | Native 앱 설정 | Deep Link 설정 (android.scheme) | 중간 | capacitor.config.ts, AndroidManifest.xml |
| **P3** | 테스트 | 웹/네이티브 로그인, 동기화 테스트 | 중간 | - |

---

## 기술적 고려사항

### 1. 로그인 플로우 (line-minder 기준)

```
사용자 클릭 (Google/Kakao)
  ↓
authStore.signInWithGoogle/Kakao()
  ↓
Auth Worker로 리다이렉트
  https://auth.woory.day/google?appId=memo-alarm&returnTo=/&native=true
  ↓
[Auth Worker: OAuth 처리]
  ↓
/auth/callback으로 복귀
  ↓
parseQueryParams() / parseHashFragment()
  ↓
supabase.auth.setSession() or signInWithIdToken()
  ↓
authStore 자동 초기화 (onAuthStateChange)
  ↓
메모 동기화 (checkAndSyncData)
  ↓
홈으로 이동
```

### 2. 데이터 동기화 전략

**line-minder 방식 (추천)**:
```typescript
async function checkAndSyncData(userId: string) {
  // 1. 서버 데이터 확인
  const serverData = await syncService.downloadUserData(userId);

  // 2. 로컬 데이터 확인
  const hasLocalData = memosStore.memos.length > 0;
  const hasServerData = serverData?.memos?.length > 0;

  // 3. 병합 전략
  if (hasLocalData && !hasServerData) {
    await uploadToServer(userId);        // 로컬만 → 업로드
  } else if (!hasLocalData && hasServerData) {
    await downloadFromServer(serverData); // 서버만 → 다운로드
  } else if (hasLocalData && hasServerData) {
    // 최신 버전 확인 (updated_at 비교)
    const lastSync = syncService.getLastSyncTime();
    const serverUpdated = new Date(serverData.updated_at);

    if (!lastSync || serverUpdated > lastSync) {
      await downloadFromServer(serverData);
    }
  }

  syncService.setLastSyncTime(new Date());
}
```

**gifticon-manager 방식** (참고용):
- 더 정교한 병합 로직 (중복 감지, 항목별 비교)
- memo-alarm에는 line-minder 방식이 더 적합

### 3. Supabase 테이블 스키마 (초안)

```sql
-- user_data 테이블 (line-minder 방식)
CREATE TABLE user_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  memos JSONB NOT NULL DEFAULT '[]',
  folders JSONB NOT NULL DEFAULT '[]',
  settings JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 또는 정규화된 테이블 (gifticon-manager 방식)
CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  emoji TEXT,
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  reminder_time TIMESTAMP WITH TIME ZONE,
  folder_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**권장**: line-minder 방식 (JSONB)을 먼저 구현 → 나중에 정규화 고려

### 4. Auth Worker 설정

memo-alarm은 이미 `auth-worker/src/config.ts`에 등록되어 있는지 확인 필요:

```typescript
// auth-worker/src/config.ts
export const APP_CONFIGS = {
  // ...
  'memo-alarm': {
    origins: [
      'https://memo.woory.day',
      'http://localhost:5173'
    ],
    android: {
      scheme: 'com.woory.memoalarm'
    }
  }
};
```

### 5. Native 앱 Deep Link 설정

**capacitor.config.ts**:
```typescript
{
  appId: 'com.woory.memoalarm',
  server: {
    androidScheme: 'com.woory.memoalarm'
  }
}
```

**AndroidManifest.xml**:
```xml
<activity ...>
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.woory.memoalarm" />
  </intent-filter>
</activity>
```

### 6. 기존 로컬 동기화와의 관계

**현재**: `src/lib/stores/sync.svelte.ts` (6자리 코드 기반)

**계획**:
1. **Phase 1**: Supabase 로그인 추가 (로컬 동기화와 병행)
2. **Phase 2**: 로그인 사용자는 Supabase 동기화 우선
3. **Phase 3**: 로컬 동기화 deprecated 또는 보조 기능으로 유지

---

## 구현 순서

### Phase 1: 기반 작업 (P0)

1. **패키지 설치**
   ```bash
   npm install @supabase/supabase-js
   npm install @capacitor/browser
   ```

2. **환경변수 설정** (`.env`)
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. **Supabase 서비스 생성** (`src/lib/services/supabase.ts`)
   - line-minder 코드 복사 (174줄)
   - `appId` → `memo-alarm`으로 변경
   - `syncService.uploadLocalData` → memos, folders 필드로 수정

### Phase 2: 인증 UI (P1)

4. **Auth 스토어 생성** (`src/lib/stores/auth.svelte.ts`)
   - line-minder 코드 복사 (173줄)
   - `linesStore`, `historyStore` → `memosStore`, `foldersStore`로 변경

5. **로그인 페이지** (`src/routes/login/+page.svelte`)
   - line-minder 코드 복사 (164줄)
   - 타이틀/설명 → "메모 알람" 맞춤

6. **콜백 페이지** (`src/routes/auth/callback/+page.svelte`)
   - line-minder 코드 복사 (235줄)
   - returnTo → `/` 기본값

7. **설정 페이지 업데이트** (`src/routes/settings/+page.svelte`)
   - 로그인 버튼 추가 (authStore.isAuthenticated 확인)
   - 로그아웃 버튼 추가
   - 동기화 상태 표시 (authStore.syncing)

### Phase 3: 데이터 동기화 (P2)

8. **Supabase 테이블 생성** (Supabase 콘솔)
   - `user_data` 테이블 생성 (JSONB 방식)
   - RLS 정책 추가 (user_id 기반)

9. **메모 스토어 업데이트** (`src/lib/stores/memos.svelte.ts`)
   - `createMemo`, `updateMemo`, `deleteMemo`에 Supabase 동기화 추가
   - `importData` 함수 추가 (서버 → 로컬)
   - 오프라인 대기열 처리 (선택)

### Phase 4: 네이티브 앱 (P3)

10. **Native 설정 확인**
    - `capacitor.config.ts` 확인
    - `AndroidManifest.xml` Deep Link 확인
    - Auth Worker 설정 확인

11. **테스트**
    - [ ] 웹 Google 로그인
    - [ ] 웹 Kakao 로그인
    - [ ] 네이티브 Google 로그인
    - [ ] 네이티브 Kakao 로그인
    - [ ] 메모 생성 → 서버 업로드
    - [ ] 다른 기기에서 로그인 → 메모 다운로드
    - [ ] 로그아웃 → 로컬 데이터 유지 확인

---

## 파일별 작업 내역

### 신규 생성

| 파일 | 설명 | 참고 소스 | 라인 수 |
|------|------|-----------|---------|
| `src/lib/services/supabase.ts` | Supabase 클라이언트, authService, syncService | line-minder | ~174줄 |
| `src/lib/stores/auth.svelte.ts` | 인증 상태 관리 스토어 | line-minder | ~173줄 |
| `src/routes/login/+page.svelte` | 로그인 페이지 (Google/Kakao) | line-minder | ~164줄 |
| `src/routes/auth/callback/+page.svelte` | OAuth 콜백 처리 | line-minder | ~235줄 |

### 수정

| 파일 | 변경 사항 |
|------|-----------|
| `package.json` | @supabase/supabase-js, @capacitor/browser 추가 |
| `.env` | Supabase 환경변수 추가 |
| `src/routes/settings/+page.svelte` | 로그인/로그아웃 버튼, 동기화 상태 표시 |
| `src/lib/stores/memos.svelte.ts` | Supabase 동기화 로직 추가 |
| `capacitor.config.ts` | androidScheme 확인 |
| `android/app/src/main/AndroidManifest.xml` | Deep Link Intent Filter 확인 |

---

## 테스트 시나리오

### 시나리오 1: 신규 사용자 로그인

1. 로그인 페이지 접속
2. Google로 로그인 클릭
3. Auth Worker로 리다이렉트
4. Google 로그인 완료
5. `/auth/callback`으로 복귀
6. 홈(`/`)으로 이동
7. 메모 생성
8. Supabase에 업로드 확인

### 시나리오 2: 로컬 데이터 → 클라우드 업로드

1. 로그인하지 않은 상태에서 메모 3개 생성 (로컬 저장)
2. 로그인 페이지에서 Google 로그인
3. `checkAndSyncData` 실행
4. "로컬에만 데이터 있음" → 자동 업로드
5. Supabase에서 데이터 확인

### 시나리오 3: 멀티디바이스 동기화

1. **기기 A**: 로그인 후 메모 5개 생성
2. **기기 B**: 같은 계정으로 로그인
3. `checkAndSyncData` 실행
4. "서버에만 데이터 있음" → 자동 다운로드
5. 기기 B에서 메모 5개 확인

### 시나리오 4: 네이티브 앱 로그인

1. Android 앱 실행
2. 로그인 버튼 클릭 → In-App Browser 열림
3. Auth Worker에서 Google 로그인
4. Deep Link로 앱 복귀 (`com.woory.memoalarm://auth/callback#...`)
5. 콜백 페이지에서 토큰 파싱 (Hash fragment)
6. 로그인 완료

---

## 위험 요소 및 대응

### 1. 기존 로컬 동기화와 충돌

**위험**: `sync.svelte.ts`와 Supabase 동기화가 동시 실행

**대응**:
- 로그인 사용자는 Supabase만 사용
- `isAuthenticated` 체크 후 분기
- 로컬 동기화는 "로그인 없이 사용" 모드에서만 활성화

### 2. 데이터 손실

**위험**: 동기화 중 앱 종료 시 데이터 손실

**대응**:
- 동기화 전 로컬 백업
- 트랜잭션 방식 업데이트
- 실패 시 재시도 큐

### 3. Auth Worker 미등록

**위험**: memo-alarm이 Auth Worker에 등록되지 않음

**대응**:
- Auth Worker 리포지토리 확인
- 필요 시 등록 요청
- 임시로 line-minder appId 사용 (테스트용)

### 4. Native Deep Link 실패

**위험**: Android 앱에서 콜백 복귀 실패

**대응**:
- AndroidManifest.xml 확인
- `adb logcat` 디버깅
- Capacitor Browser 로그 확인

---

## 성공 기준

### Phase 1 완료 기준
- [ ] 웹에서 Google 로그인 성공
- [ ] authStore.user가 정상적으로 설정됨
- [ ] 콜백 페이지 토큰 파싱 성공

### Phase 2 완료 기준
- [ ] 메모 생성 시 Supabase 업로드
- [ ] 다른 기기에서 로그인 시 메모 다운로드
- [ ] 로컬 데이터와 서버 데이터 병합 성공

### Phase 3 완료 기준
- [ ] Android 앱에서 로그인 성공
- [ ] Deep Link 복귀 성공
- [ ] 네이티브 알림과 동기화 통합

### 최종 완료 기준
- [ ] 모든 테스트 시나리오 통과
- [ ] 로컬 동기화와 클라우드 동기화 공존
- [ ] 오프라인 → 온라인 전환 시 자동 동기화
- [ ] 로그아웃 시 로컬 데이터 유지

---

## 후속 작업 (Phase 4+)

### P4: 충돌 해결 UI
- 로컬/서버 데이터 충돌 시 사용자 선택 UI
- "로컬 유지" / "서버 유지" / "병합" 옵션

### P5: 실시간 동기화
- Supabase Realtime 활용
- 다른 기기에서 메모 수정 시 실시간 반영

### P6: 오프라인 큐
- 오프라인 상태에서 생성/수정된 메모 대기열
- 온라인 복귀 시 자동 업로드

### P7: 로컬 동기화 제거
- Supabase 동기화가 안정화되면 로컬 동기화 deprecated
- 마이그레이션 가이드 제공

---

## 참고 자료

### line-minder (주요 참고)
- `src/lib/services/supabase.ts` (174줄)
- `src/lib/stores/auth.svelte.ts` (173줄)
- `src/routes/login/+page.svelte` (164줄)
- `src/routes/auth/callback/+page.svelte` (235줄)

### gifticon-manager (보조 참고)
- `src/lib/services/sync.ts` (336줄) - 정교한 동기화 로직
- 중복 감지, 병합 전략 참고

### 공통 문서
- `common/docs/plan/2026-01-08_auth-integration-plan.md` (전체 Auth 통합 계획)
- `common/docs/history/` (Auth Worker 마이그레이션 히스토리)

---

*상태: 검토 대기*
