# 메모 공유 시 URL null 문제 수정 계획서

> **작성일**: 2026-02-10
> **완료일**: 2026-02-11
> **아카이브됨**
> **심각도**: 기능 불완전 (SNS 공유 동작 불가)
> **상태**: 구현완료
> **진행률**: 6/6 (100%)

---

## 1. 문제 현상

메모를 SNS(Twitter, Facebook, Kakao)로 공유할 때 **공유 URL이 null/빈값**으로 전달됨.

- Twitter: `url=` 파라미터 누락 → 텍스트만 공유
- Facebook: `u=` 빈값 → 공유 다이얼로그 오류 또는 빈 미리보기
- Kakao: `url=` 빈값 → 링크 없는 공유

---

## 2. 원인 분석

### 2.1 근본 원인

`share.ts`의 `formatMemoForShare()` 함수가 **memo.url** (북마크 URL)을 공유 URL로 사용:

```typescript
// src/lib/utils/share.ts:19-22
return {
  title: memo.title,
  text,
  url: memo.url  // ← 북마크 URL을 공유 링크로 사용
};
```

**`memo.url`은 북마크 전용 필드**(`memo.ts:112-113`)이므로:
- 일반 메모(note 타입): `memo.url = undefined` → 공유 URL 없음
- 할일(todo 타입): `memo.url = undefined` → 공유 URL 없음
- 북마크(bookmark 타입): `memo.url = "https://..."` → 북마크 원본 URL이 공유됨 (의도와 다를 수 있음)

### 2.2 영향 받는 코드 경로

| 파일 | 라인 | 함수/코드 | 문제 |
|------|------|----------|------|
| `src/lib/utils/share.ts` | 22 | `formatMemoForShare()` | `memo.url` (북마크) 사용 |
| `src/lib/utils/share.ts` | 91-92 | `getTwitterShareUrl()` | `shareData.url` null 시 param 누락 |
| `src/lib/utils/share.ts` | 99 | `getFacebookShareUrl()` | `shareData.url \|\| ''` → 빈 `u=` |
| `src/lib/utils/share.ts` | 107 | `getKakaoShareUrl()` | `shareData.url \|\| ''` → 빈 `url=` |
| `src/lib/components/memo/ShareModal.svelte` | 75-78 | `handleSNSShare()` | 검증 없이 공유 실행 |

---

## 3. 유사 기능 점검

### 3.1 Native Share API (`shareMemo`)
- **파일**: `share.ts:26-46`
- **상태**: **부분 영향** — `navigator.share({ url: undefined })`는 URL 없이 텍스트만 공유. 동작은 하지만 링크가 빠짐.

### 3.2 클립보드 복사 (`copyToClipboard`)
- **파일**: `share.ts:48-64`
- **상태**: **문제 없음** — `shareData.url` 존재할 때만 텍스트에 추가 (`line 51`)

### 3.3 QR 코드 생성 (`generateMemoQRCode`)
- **파일**: `src/lib/utils/qrcode.ts:30-38`
- **상태**: **부분 영향** — `memo.url` 있을 때만 QR에 포함. 없으면 텍스트만 인코딩. 동작은 하지만 의도한 공유 링크가 아님.

### 3.4 이미지 내보내기 (`exportMemoAsImage`)
- **상태**: **문제 없음** — 메모 카드를 캡처하므로 URL 의존 없음.

### 3.5 공유 수신 (`shareReceiver.ts`)
- **상태**: **문제 없음** — 외부에서 받는 기능이라 발신과 무관.

---

## 4. 수정 방안

### 방안 A: 텍스트 전용 공유로 정리 (권장 — 단기)

메모 앱의 공유는 **메모 내용을 텍스트로 공유**하는 것이 목적이므로, 공유 가능한 공개 URL이 없는 현재 상태에서는 텍스트 공유에 집중.

#### 수정 내용:

**1) SNS 공유 시 URL 없으면 텍스트만 공유**

```typescript
// src/lib/utils/share.ts

export function getTwitterShareUrl(memo: Memo): string {
  const shareData = formatMemoForShare(memo);
  let text = shareData.title;
  if (memo.content) {
    text += `\n${memo.content.slice(0, 200)}`;  // 트위터 글자 제한 고려
  }
  if (memo.tags.length > 0) {
    text += ` #${memo.tags.join(' #')}`;
  }
  const params = new URLSearchParams({ text });
  // 북마크 URL이 있으면 함께 공유 (메모 공개 URL이 아님)
  if (memo.url) {
    params.set('url', memo.url);
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function getFacebookShareUrl(memo: Memo): string {
  // Facebook은 URL이 필수 → URL 없으면 비활성화
  if (!memo.url) return '';  // 호출부에서 처리
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(memo.url)}&quote=${encodeURIComponent(memo.title)}`;
}

export function getKakaoShareUrl(memo: Memo): string {
  if (!memo.url) return '';  // 호출부에서 처리
  const text = encodeURIComponent(formatMemoForShare(memo).text);
  return `https://story.kakao.com/share?url=${encodeURIComponent(memo.url)}&text=${text}`;
}
```

**2) ShareModal에서 URL 없는 SNS 버튼 비활성화/안내**

```typescript
// src/lib/components/memo/ShareModal.svelte

function handleSNSShare(platform: 'twitter' | 'facebook' | 'kakao') {
  if (!memo) return;

  // Facebook/Kakao는 URL 필수
  if ((platform === 'facebook' || platform === 'kakao') && !memo.url) {
    toastStore.info('URL이 없는 메모는 이 플랫폼으로 공유할 수 없습니다');
    return;
  }

  shareToSNS(memo, platform);
}
```

**3) ShareModal UI에서 URL 필요 SNS 버튼에 시각적 피드백**

- `memo.url` 없을 때: Facebook, Kakao 버튼 비활성화(opacity-50, disabled)
- Twitter는 텍스트만으로 동작하므로 항상 활성

### 방안 B: 메모 공개 공유 URL 생성 (장기)

Supabase에 공개 공유 기능을 추가하여 `https://memo.woory.day/share/[shareId]` 형태의 URL 생성. 이 방안은 다음을 포함:

1. `ma_shared_memos` 테이블 생성 (공개 공유 레코드)
2. 공유 라우트 `/share/[id]` 에 읽기 전용 메모 뷰 추가
3. OG 메타 태그 (SNS 미리보기)
4. 만료 시간, 비밀번호 옵션

**→ 별도 계획서로 분리 권장 (규모가 큼)**

---

## 5. 구현 계획 (방안 A)

| Task | 설명 | 파일 | 우선순위 |
|------|------|------|---------|
| [x] S-1 | `formatMemoForShare()` 주석 명확화 — `url`이 북마크 URL임을 명시 | `share.ts:22` | P0 |
| [x] S-2 | `getFacebookShareUrl()` — URL 없으면 빈 문자열 반환 | `share.ts:97-101` | P0 |
| [x] S-3 | `getKakaoShareUrl()` — URL 없으면 빈 문자열 반환 | `share.ts:103-108` | P0 |
| [x] S-4 | `shareToSNS()` — 빈 URL 반환 시 toast 안내 + 조기 리턴 | `share.ts:112-136` | P0 |
| [x] S-5 | ShareModal — Facebook/Kakao 버튼 조건부 비활성화 | `ShareModal.svelte` | P1 |
| [x] S-6 | `getTwitterShareUrl()` — content 포함하여 텍스트 풍성하게 | `share.ts:84-95` | P1 |

---

## 6. 테스트 시나리오

| # | 케이스 | 기대 결과 |
|---|--------|----------|
| 1 | 일반 메모 → Twitter 공유 | 제목+내용+태그 텍스트만 공유 (URL 파라미터 없음) |
| 2 | 일반 메모 → Facebook 공유 | 버튼 비활성화 또는 안내 toast |
| 3 | 일반 메모 → Kakao 공유 | 버튼 비활성화 또는 안내 toast |
| 4 | 북마크 메모 → Twitter 공유 | 제목+태그+북마크URL 공유 |
| 5 | 북마크 메모 → Facebook 공유 | 북마크 URL로 공유 다이얼로그 열림 |
| 6 | 일반 메모 → Native Share | 텍스트만 공유 (정상 동작) |
| 7 | 일반 메모 → 클립보드 복사 | 텍스트만 복사 (URL 없음, 정상) |
| 8 | 일반 메모 → QR 코드 | 텍스트만 인코딩 (정상) |

---

## 7. 영향 범위 요약

| 파일 | 변경 내용 | 위험도 |
|------|----------|--------|
| `src/lib/utils/share.ts` | SNS 함수 null 처리, 주석 추가 | 낮음 |
| `src/lib/components/memo/ShareModal.svelte` | 버튼 비활성화 로직 | 낮음 |
| `src/lib/utils/qrcode.ts` | (선택) 주석 명확화 | 낮음 |

**기존 기능 영향 없음**: 클립보드 복사, 이미지 내보내기, 공유 수신은 변경 없음.

---

*상태: 구현완료 | 진행률: 6/6 (100%)*
