# memo-alarm 패턴 크로스 프로젝트 적용 계획

> **⚠️ 문서 상태**: 이 문서는 프로젝트별로 분리되었습니다.
>
> **새 문서 위치**:
> - [Sacred Hours - Capacitor ESM Import 점검](../../sacred-hours/docs/plan/2026-02-04_capacitor-esm-import-check.md)
> - [Line Minder - 캐시 우선 로딩 및 동기화 상태 UI](../../line-minder/docs/plan/2026-02-04_cache-first-loading-sync-status.md)
> - [TB Wish - 캐시 우선 로딩 적용 검토](../../tb-wish/docs/plan/2026-02-04_cache-first-loading-consideration.md)
> - [Story Weaver - 캐시 우선 로딩 적용 검토](../../story-weaver/docs/plan/2026-02-04_cache-first-loading-consideration.md)

---

> 작성일: 2026-02-04
> 상태: ARCHIVED (프로젝트별 분리됨)
> 출처: memo-alarm 문서 정리 과정에서 식별된 적용 가능 패턴

---

## 개요

memo-alarm에서 구현된 다음 3가지 패턴을 다른 프로젝트에 적용할지 검토합니다.

---

## 1. Capacitor ESM 동적 import 패턴

### 문제
`@capacitor/core` 등을 top-level에서 정적 import하면, Cloudflare Workers 등 웹 배포 환경에서 `Failed to resolve module specifier "@capacitor/core"` 에러 발생.

### 해결 패턴
```typescript
// ❌ 잘못된 패턴
import { Capacitor } from '@capacitor/core';
export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}

// ✅ 올바른 패턴
export async function isNative(): Promise<boolean> {
    try {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}
```

### 프로젝트별 검토

| 프로젝트 | `@capacitor/core` 정적 import | `@capacitor/*` 정적 import | 웹 배포 | 수정 필요 |
|---------|:---:|:---:|:---:|:---:|
| memo-alarm | ✅ 수정됨 | ✅ 수정됨 | Cloudflare | 완료 |
| sacred-hours | 확인 필요 | 확인 필요 | Cloudflare | **검토** |
| line-minder | 확인 필요 | 확인 필요 | Cloudflare | **검토** |

### 확인 방법
```powershell
# 각 프로젝트에서 정적 import 검색
Select-String -Path "src\**\*.ts","src\**\*.svelte" -Pattern "import.*from '@capacitor/" -Recurse
```

### 가이드 문서
`common/docs/guide/mobile/capacitor-ssr-build-fix.md` (업데이트 완료)

---

## 2. 캐시 우선 로딩 (Cache-First Loading)

### 문제
Supabase 기반 앱에서 새로고침 시 서버 응답을 기다리는 동안 빈 화면이 표시됨 (체감 로딩 지연).

### 해결 패턴
```
앱 시작 → 로컬 캐시 즉시 표시 (local-only 상태)
        → 백그라운드에서 서버 동기화
        → 서버 데이터로 교체 (synced 상태)
```

- localStorage에 캐시된 데이터를 즉시 로드하여 UI 표시
- 백그라운드에서 Supabase fetch → 데이터 교체
- 각 항목에 `syncStatus` 표시 (local-only → synced)

### 프로젝트별 적용 검토

| 프로젝트 | DB | 데이터 로딩 방식 | 적용 가치 |
|---------|-----|----------------|----------|
| memo-alarm | Supabase | ✅ Cache-First 적용됨 | 완료 |
| **line-minder** | Supabase | 서버 대기 방식 | **높음** — 메인 데이터(lines)가 많아 체감 지연 클 수 있음 |
| sacred-hours | LocalStorage | 이미 로컬 우선 | 불필요 |
| tb-wish | Supabase | 서버 대기 방식 | **중간** — 위시리스트 데이터 로딩 시 적용 가능 |
| story-weaver | Supabase | 서버 대기 방식 | **낮음** — 에디터 특성상 최신 데이터가 중요 |

### 구현 시 필요 사항

1. `SyncStatus` 타입 추가: `'local-only' | 'pending' | 'synced' | 'failed'`
2. Store의 `init()` 함수에 캐시 우선 로드 로직
3. (선택) SyncStatusBanner 컴포넌트
4. (선택) 각 카드에 동기화 상태 아이콘

---

## 3. 동기화 상태 UI

### 패턴
- **SyncStatusBanner** — 하단 플로팅 배너로 전체 동기화 상태 표시 (오프라인/동기화중/실패)
- **카드별 아이콘** — local-only(CloudOff), pending(RefreshCw 회전), failed(AlertTriangle), synced(없음)
- **헤더 배지** — 우측에 작은 상태 아이콘

### 프로젝트별 적용 검토

| 프로젝트 | 적용 가치 | 사유 |
|---------|----------|------|
| memo-alarm | ✅ 적용됨 | - |
| **line-minder** | **높음** | Supabase 기반, 오프라인 사용 시나리오 있음 |
| tb-wish | 중간 | 위시 데이터 동기화 상태 표시 유용 |
| story-weaver | 낮음 | 에디터 저장 시 이미 상태 표시 |

---

## 작업 순서 권장

1. **line-minder**: 캐시 우선 로딩 + 동기화 상태 UI (가장 큰 효과)
2. **sacred-hours / line-minder**: Capacitor ESM import 점검
3. **tb-wish**: 캐시 우선 로딩 적용 검토

---

## 참고 문서

- `memo-alarm/docs/archive/2026-01-24_changelog-detail.md` 섹션 8 — 캐시 우선 로딩 구현 상세
- `memo-alarm/docs/archive/2026-01-23_fix-capacitor-core-esm-error.md` — ESM 에러 수정 상세
- `common/docs/guide/mobile/capacitor-ssr-build-fix.md` — 동적 import 가이드
- `common/docs/guide/architecture/async-store-pattern.md` — 비동기 Store 패턴
