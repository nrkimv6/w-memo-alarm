# memo-alarm 인증 시스템 도입

> 작성일: 2026-01-09
> 대상 프로젝트: memo-alarm
> 상태: 검토 대기

---

## 개요

현재 memo-alarm은 6자리 동기화 코드(`sync_code`) 기반의 간이 인증을 사용하고 있습니다. 이 방식은 편리하지만 보안에 취약합니다:

| 문제점 | 설명 |
|--------|------|
| Brute-force 취약 | 6자리 영숫자 = ~200만 조합, 무차별 대입 가능 |
| 코드 유출 위험 | 동기화 코드 노출 시 타인이 메모 접근 가능 |
| 계정 복구 불가 | 코드 분실 시 데이터 복구 방법 없음 |
| 다중 기기 관리 불가 | 어떤 기기가 연결되어 있는지 확인/관리 불가 |

---

## 인증 시스템 옵션 비교

| 옵션 | 장점 | 단점 | 난이도 |
|------|------|------|:------:|
| **Supabase Auth** | OAuth 지원, line-minder에서 이미 사용, 무료 | 외부 의존성 추가 | 중간 |
| Cloudflare Access | Zero Trust, 기업급 보안 | 개인용 과잉, 비용 | 높음 |
| 자체 구현 (D1) | 외부 의존성 없음 | 보안 구현 복잡, 리스크 | 높음 |
| 패스키 (WebAuthn) | 비밀번호 없음, 현대적 | 브라우저 지원 제한 | 높음 |

**권장: Supabase Auth**
- line-minder에서 이미 사용 중 → 기술 노하우 있음
- 무료 플랜으로 충분 (50,000 MAU)
- Google/GitHub OAuth + 이메일/비밀번호 지원
- Capacitor 앱 지원

---

## 구현 항목

| 우선순위 | 항목 | 설명 | 난이도 |
|:-------:|------|------|:------:|
| P0 | Supabase 프로젝트 설정 | Auth 활성화, OAuth 제공자 설정 | 낮음 |
| P0 | 인증 스토어 구현 | `src/lib/stores/auth.svelte.ts` 생성 | 중간 |
| P0 | 로그인/회원가입 UI | 로그인 페이지, OAuth 버튼 | 중간 |
| P1 | API 인증 미들웨어 | JWT 검증, user_id 매핑 | 중간 |
| P1 | 기존 sync_code 마이그레이션 | 기존 사용자 데이터 연결 옵션 | 중간 |
| P1 | D1 ↔ Supabase 사용자 연동 | users 테이블에 supabase_uid 컬럼 추가 | 중간 |
| P2 | 세션 관리 | 자동 로그인, 토큰 갱신 | 낮음 |
| P2 | 기기 관리 UI | 연결된 기기 목록, 원격 로그아웃 | 중간 |
| P3 | sync_code 완전 제거 | 마이그레이션 완료 후 레거시 코드 제거 | 낮음 |

---

## 기술적 고려사항

### 1. 인증 흐름 변경

```
[현재]
앱 시작 → 동기화 코드 입력/생성 → 동기화

[변경 후]
앱 시작 → 로그인 (OAuth/이메일) → JWT 발급 → 동기화
```

### 2. 데이터베이스 스키마 변경

```sql
-- users 테이블 수정
ALTER TABLE users ADD COLUMN supabase_uid TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email TEXT;

-- 인덱스 추가
CREATE INDEX idx_users_supabase_uid ON users(supabase_uid);
```

### 3. API 인증 구조

```typescript
// 현재: sync_code로 사용자 식별
const user = await db.prepare('SELECT * FROM users WHERE sync_code = ?')
  .bind(syncCode).first();

// 변경 후: JWT에서 supabase_uid로 사용자 식별
const { data: { user } } = await supabase.auth.getUser(token);
const dbUser = await db.prepare('SELECT * FROM users WHERE supabase_uid = ?')
  .bind(user.id).first();
```

### 4. 기존 사용자 마이그레이션 전략

| 옵션 | 설명 |
|------|------|
| A. 선택적 연결 | 기존 sync_code 사용자가 로그인 후 "기존 데이터 연결" 선택 |
| B. 강제 마이그레이션 | 특정 날짜 이후 로그인 필수, sync_code 비활성화 |
| C. 병행 운영 | 두 방식 모두 지원 (복잡도 증가) |

**권장: 옵션 A (선택적 연결)**

### 5. Capacitor 앱 고려사항

- Supabase Auth는 웹뷰 기반 OAuth 지원
- 딥링크 콜백 설정 필요 (`capacitor://` 스킴)
- 토큰 저장: Capacitor Preferences 플러그인 사용

---

## 구현 순서

1. [ ] P0: Supabase 프로젝트 생성 및 Auth 설정
2. [ ] P0: `@supabase/supabase-js` 패키지 설치
3. [ ] P0: Supabase 클라이언트 초기화 (`src/lib/supabase.ts`)
4. [ ] P0: 인증 스토어 구현 (`src/lib/stores/auth.svelte.ts`)
5. [ ] P0: 로그인/회원가입 페이지 구현 (`src/routes/auth/`)
6. [ ] P1: DB 마이그레이션 (supabase_uid 컬럼 추가)
7. [ ] P1: API 엔드포인트에 JWT 검증 추가
8. [ ] P1: 기존 데이터 연결 UI 구현
9. [ ] P2: 자동 로그인 및 토큰 갱신 로직
10. [ ] P2: 기기 관리 페이지 구현
11. [ ] P3: sync_code 레거시 코드 제거 (마이그레이션 완료 후)

---

## 파일 변경 예상

| 파일 | 변경 내용 |
|------|----------|
| `package.json` | `@supabase/supabase-js` 추가 |
| `src/lib/supabase.ts` | Supabase 클라이언트 (신규) |
| `src/lib/stores/auth.svelte.ts` | 인증 상태 관리 (신규) |
| `src/lib/stores/sync.svelte.ts` | JWT 기반 인증으로 수정 |
| `src/routes/auth/+page.svelte` | 로그인 페이지 (신규) |
| `src/routes/api/sync/+server.ts` | JWT 검증 추가 |
| `data/migrations/003_auth.sql` | supabase_uid 컬럼 추가 (신규) |

---

## 환경 변수

```env
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

---

*상태: 검토 대기*
