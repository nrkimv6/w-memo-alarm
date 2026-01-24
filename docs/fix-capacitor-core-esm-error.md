# Capacitor Core ESM 모듈 에러 수정 가이드

## 문제 요약

**에러 메시지:**
```
TypeError: Failed to resolve module specifier "@capacitor/core".
Relative references must start with either "/", "./", or "../".
```

**발생 조건:**
- SvelteKit + Capacitor 하이브리드 앱
- 웹 브라우저에서 실행 시 (Cloudflare Workers 등 배포 환경)
- `@capacitor/core` 또는 `@capacitor/local-notifications`를 top-level에서 import한 경우

**영향:**
- 설정 페이지 등 Capacitor 관련 코드가 있는 페이지 접근 불가
- Google/Kakao 로그인 버튼 동작 안함

---

## 원인 분석

### 문제가 되는 코드 패턴

```typescript
// ❌ 잘못된 패턴: Top-level import
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}
```

### 왜 문제가 되는가?

1. **Capacitor 패키지는 네이티브 빌드용으로 설계됨**
   - Vite/Rollup 번들러가 처리할 때는 정상 작동
   - 하지만 웹 브라우저의 ESM 로더는 `@capacitor/core` 경로를 해석할 수 없음

2. **SSR/SSG 빌드 시 문제**
   - 서버 사이드에서 Capacitor 코드가 실행되면 에러 발생
   - 클라이언트에서도 번들되지 않은 경우 동일 에러

3. **브라우저 ESM의 한계**
   - 브라우저는 bare specifier(`@capacitor/core`)를 직접 해석 불가
   - 상대 경로(`./`, `../`) 또는 절대 경로(`/`, `http://`)만 지원

---

## 해결 방법

### 1. 동적 import + try/catch 패턴 사용

```typescript
// ✅ 올바른 패턴: 동적 import
async function getCapacitor() {
    try {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor;
    } catch {
        return null;
    }
}

async function getLocalNotifications() {
    try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        return LocalNotifications;
    } catch {
        return null;
    }
}

export async function isNative(): Promise<boolean> {
    const Capacitor = await getCapacitor();
    return Capacitor?.isNativePlatform() ?? false;
}
```

### 2. 함수 호출부 async/await로 변경

```typescript
// ❌ 이전: 동기 호출
if (isNative()) {
    scheduleNotification(memo);
}

// ✅ 이후: 비동기 호출
if (await isNative()) {
    scheduleNotification(memo);
}
```

### 3. Capacitor 플러그인 사용 함수 업데이트

```typescript
// ✅ 올바른 패턴
export async function scheduleNotification(memo: Memo): Promise<void> {
    if (!(await isNative()) || !memo.reminder?.enabled) return;

    const LocalNotifications = await getLocalNotifications();
    if (!LocalNotifications) return;

    // ... 알림 스케줄링 로직
    await LocalNotifications.schedule({ notifications });
}
```

---

## 수정해야 할 파일 체크리스트

### 점검 대상 파일 패턴

```bash
# Capacitor import가 있는 파일 검색
grep -r "@capacitor/" src/ --include="*.ts" --include="*.svelte"
```

### 일반적인 수정 대상 파일

| 파일 | 점검 항목 |
|------|----------|
| `src/lib/utils/capacitor.ts` | isNative(), 알림 관련 함수 |
| `src/lib/stores/auth.svelte.ts` | 로그인 함수 내 Capacitor 체크 |
| `src/lib/stores/memos.svelte.ts` | isNative() 호출부 |
| `src/routes/**/+page.svelte` | Capacitor 직접 사용 여부 |

---

## 수정 전후 비교

### `src/lib/utils/capacitor.ts`

**Before:**
```typescript
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!isNative()) return false;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
}
```

**After:**
```typescript
// 동적 import 헬퍼 함수
async function getCapacitor() {
    try {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor;
    } catch {
        return null;
    }
}

async function getLocalNotifications() {
    try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        return LocalNotifications;
    } catch {
        return null;
    }
}

export async function isNative(): Promise<boolean> {
    const Capacitor = await getCapacitor();
    return Capacitor?.isNativePlatform() ?? false;
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!(await isNative())) return false;

    const LocalNotifications = await getLocalNotifications();
    if (!LocalNotifications) return false;

    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
}
```

### `src/lib/stores/auth.svelte.ts`

**Before:**
```typescript
import { Capacitor } from '@capacitor/core';

async function signInWithGoogle() {
    const isNative = Capacitor.isNativePlatform();
    // ...
}
```

**After:**
```typescript
// Top-level import 제거

async function isNativePlatform(): Promise<boolean> {
    if (!browser) return false;
    try {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

async function signInWithGoogle() {
    const isNative = await isNativePlatform();
    // ...
}
```

---

## 테스트 방법

### 1. 웹 브라우저에서 테스트
```bash
npm run build
npm run preview
# 또는 배포 환경에서 테스트
```

### 2. 콘솔 에러 확인
- 설정 페이지 접근
- 로그인 버튼 클릭
- `@capacitor/core` 관련 에러가 없어야 함

### 3. 네이티브 앱에서 테스트
```bash
npx cap sync
npx cap run android
# 또는
npx cap run ios
```

---

## 관련 프로젝트 점검 체크리스트

- [ ] `@capacitor/core` top-level import 검색
- [ ] `@capacitor/local-notifications` top-level import 검색
- [ ] `@capacitor/browser` top-level import 검색
- [ ] `Capacitor.isNativePlatform()` 동기 호출 검색
- [ ] `isNative()` 동기 함수 검색
- [ ] 웹 브라우저 배포 환경에서 테스트

---

## 참고 사항

### @capacitor/browser 의존성
`@capacitor/browser`를 사용하는 경우 package.json에 추가 필요:
```bash
npm install @capacitor/browser
```

### 관련 커밋
- `ea30228` - fix: use dynamic import for @capacitor/core to fix web ESM module error

### 수정 날짜
2026-01-23
