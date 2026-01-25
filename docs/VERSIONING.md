# Memo Alarm 버전 관리

> 공통 가이드: `common/docs/guide/VERSIONING.md`

## 앱 유형

**네이티브 앱** (Capacitor + Android)

## 버전 정의 파일

| 파일 | 필드 | 용도 |
|------|------|------|
| `package.json` | `version` | npm 패키지 버전 |
| `android/app/build.gradle` | `versionName` | 사용자에게 보이는 버전 |
| `android/app/build.gradle` | `versionCode` | Play Store 내부 버전 (정수) |
| `src/lib/config.ts` | `APP_VERSION` | 앱 내 표시 / 캐시 키 |

## 버전 업데이트 절차

### 1. 스크립트 사용 (권장)

```powershell
.\bump-version.ps1 -Version 0.2.0
```

### 2. 수동 업데이트

#### package.json
```json
{
  "version": "0.2.0"
}
```

#### android/app/build.gradle
```gradle
defaultConfig {
    versionCode 2          // 이전 값 + 1
    versionName "0.2.0"    // 새 버전
}
```

#### src/lib/config.ts
```typescript
export const APP_VERSION = '0.2.0';
```

### 3. Git 태그

```powershell
git tag v0.2.0
git push origin v0.2.0
```

## 버전 표시 위치

설정 페이지 (`/settings` 또는 정보 섹션):

```svelte
<script>
  import { APP_VERSION } from '$lib/config';
</script>

<div class="text-sm text-muted-foreground">
  v{APP_VERSION}
</div>
```

## 릴리스 체크리스트

- [ ] `bump-version.ps1` 실행 또는 수동 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] 빌드 테스트: `npm run build`
- [ ] Android 빌드: `npm run build && npx cap sync android`
- [ ] 커밋: `git commit -m "chore: bump version to 0.2.0"`
- [ ] 태그 푸시: `git push --tags`

## versionCode 규칙

- Play Store 업로드마다 **반드시** 증가
- 절대 감소 불가
- 같은 versionName이라도 수정 시 versionCode 증가 필요

| 버전 | versionCode |
|------|-------------|
| 0.1.0 | 1 |
| 0.1.1 | 2 |
| 0.2.0 | 3 |
| 1.0.0 | 4 |

## 캐시 전략

```typescript
// src/lib/config.ts
export const APP_VERSION = '0.2.0';
export const CACHE_VERSION = `memo-alarm-v${APP_VERSION}`;
```

Service Worker나 localStorage에서 `CACHE_VERSION` 사용하여 버전 변경 시 캐시 무효화.
