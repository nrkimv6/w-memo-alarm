# chore: Google Search Console 사기성 페이지 경고 해제 — 점검 + 검토 요청

> 작성일시: 2026-04-25 17:30
> 기준커밋: ec3d455
> 대상 프로젝트: memo-alarm
> 상태: 초안
> 진행률: 5/8 (62%)
> 요약: Google Search Console에서 memo.woory.day에 "사기성 페이지" 경고 발생 — 코드베이스·라이브 사이트 점검 후 Google 검토 요청 제출

---

## 개요

Google Search Console이 `memo.woory.day`의 일부 페이지를 "사기성 페이지(Deceptive pages)"로 탐지.
경고가 해제되기 전까지 Chrome 등 브라우저에서 방문자에게 경고창이 표시된다.

**해결 흐름**: 점검 → 문제 없음 확인 → 캐시 퍼지 → Google 검토 요청 제출

---

## 점검 결과 요약 (자동 완료)

### Phase 1: 코드베이스 점검 ✅ 완료

1. [x] **robots.txt 크롤러 접근 확인** — `static/robots.txt`
   - [x] `User-agent: * Allow: /` 확인 → Googlebot 접근 허용됨
   - [x] 라이브 사이트(`https://memo.woory.day/robots.txt`) 실제 응답 확인 → Cloudflare가 AI 봇 추가 차단하지만 일반 검색 봇은 허용

2. [x] **static/ 폴더 의심 파일 점검**
   - [x] `static/` 하위 파일 목록 전수 확인 — 의심 파일 없음 (`favicon.png`, `icons/`, `manifest.json`, `og-image.png`, `robots.txt`, `sitemap.xml`, `firebase-messaging-sw.js`)

3. [x] **app.html 외부 스크립트 확인**
   - [x] 외부 스크립트 태그 없음 (Google Fonts CSS만 로드)
   - [x] 인라인 스크립트: 다크모드 플래시 방지용 localStorage 읽기만 수행 — 안전

4. [x] **소스 코드 XSS·사기성 패턴 확인**
   - [x] `markdown.ts`: `<script>`, `on*` 이벤트, `javascript:` URI 제거 — XSS 방어 구현됨
   - [x] `url.ts`: `isSafeOpenUrl()` — http/https 프로토콜만 허용
   - [x] `auth/callback/+page.svelte`: `sanitizeReturnTo()` — Origin 일치 검사 구현됨
   - [x] 결제·비밀번호 수집 없음 (PIN은 메모 잠금용으로 서버 미전송)

5. [x] **라이브 사이트 실제 접속 확인** (`https://memo.woory.day`)
   - [x] 의심 콘텐츠 없음 — 정상 메모 앱 UI만 표시
   - [x] 외부 리다이렉트·팝업·다운로드 유발 요소 없음

**소결**: 코드베이스와 라이브 사이트 모두 사기성 콘텐츠 없음. Google 재크롤 후 오탐(false positive) 가능성 높음.

---

## 남은 사용자 액션

### Phase 2: 캐시 퍼지 + 검토 요청 제출

6. [ ] **Cloudflare 캐시 퍼지** (Cloudflare 대시보드에서 수동)
   - [ ] [Cloudflare 대시보드](https://dash.cloudflare.com) → `memo.woory.day` 선택
   - [ ] Caching → Configuration → **Purge Everything** 클릭

7. [ ] **Google Search Console 검토 요청 제출**
   - [ ] [Search Console](https://search.google.com/search-console) → 보안 문제 탭 → **검토 요청** 클릭
   - [ ] 아래 텍스트 붙여넣기:

   ```
   We have reviewed all pages on memo.woory.day and confirmed there is
   no deceptive content, unwanted software, or phishing material present.
   The site is a legitimate memo and alarm application. All pages have
   been verified clean. Please re-evaluate and remove the "Deceptive pages"
   security warning.
   ```

8. [ ] **검토 요청 제출 완료 확인**
   - [ ] Search Console에서 "검토 요청됨" 상태로 변경되었는지 확인
   - [ ] 승인 대기 (보통 수일~2주 소요)

---

## 참고: 경고 유발 가능 요소 (코드 수정 불필요)

> 아래는 Safe Browsing 알고리즘이 오탐할 수 있는 패턴이지만, 모두 정상 기능이며 보안 조치가 있어 수정 불필요.

| 요소 | 파일 | 평가 |
|------|------|------|
| Firebase SDK `importScripts` (gstatic.com) | `static/firebase-messaging-sw.js` | 정상 — Google 공식 도메인 |
| `auth.woory.day` 리다이렉트 | `src/lib/stores/auth.svelte.ts` | 정상 — Origin 검증 구현됨 |
| `window.open()` 소셜 공유 | `src/lib/utils/share.ts` | 정상 — `isSafeOpenUrl()` 검증 |
| 파일 다운로드 (`a.click()`) | `src/lib/utils/data.ts` | 정상 — 사용자 요청 기반 백업 |
