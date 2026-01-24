# URL 공유 수신 기능 구현 계획서

- **작성일**: 2026-01-24
- **상태**: ✅ 완료
- **브랜치**: `claude/add-url-sharing-feature-GaTCT`

---

## 1. 개요

### 1.1 배경
기획 단계에서 핵심 기능으로 정의되었던 PWA URL 공유 수신 기능이 구현에서 누락되었음을 발견.
현재 앱은 메모를 외부로 공유하는 기능만 있고, 외부 앱에서 메모알람으로 공유받는 기능이 없음.

### 1.2 목표
- **Native (Capacitor) 앱**: 외부 앱에서 공유 → 메모 작성
- **PWA**: 외부 앱에서 공유 → 메모 작성
- URL이 포함된 공유는 자동으로 **bookmark** 타입으로 처리

---

## 2. 현황 분석

### 2.1 현재 구현된 기능
| 기능 | 상태 | 파일 |
|------|------|------|
| 메모 → 외부 공유 (Native Share API) | ✅ 완료 | `src/lib/utils/share.ts` |
| 메모 → SNS 공유 | ✅ 완료 | `src/lib/utils/share.ts` |
| 공유 UI (ShareModal) | ✅ 완료 | `src/lib/components/memo/ShareModal.svelte` |

### 2.2 누락된 기능 (이번 구현)
| 기능 | 상태 | 필요 작업 |
|------|------|-----------|
| PWA Web Share Target API | ✅ 완료 | manifest.json + /share 라우트 |
| Android Intent-filter | ✅ 완료 | AndroidManifest.xml 수정 |
| 공유 수신 처리 로직 | ✅ 완료 | shareReceiver.ts 신규 생성 |

---

## 3. 사용자 시나리오

### 3.1 흐름도
```
┌─────────────────────────────────────────────────────────────┐
│  외부 앱 (브라우저, 트위터, 유튜브 등)                          │
│                    │                                         │
│                    ▼ [공유 버튼 클릭]                          │
│  ┌─────────────────────────────────────────┐                │
│  │     공유 대상 선택                        │                │
│  │  ┌─────────┐                            │                │
│  │  │ 메모알람 │  ← 공유 대상에 표시          │                │
│  │  └─────────┘                            │                │
│  └─────────────────────────────────────────┘                │
│                    │                                         │
│                    ▼                                         │
│  ┌─────────────────────────────────────────┐                │
│  │     메모알람 앱 - 메모 작성 폼             │                │
│  │  ┌─────────────────────────────────────┐│                │
│  │  │ 제목: [페이지 제목 자동 입력]         ││                │
│  │  │ 내용: [공유된 텍스트]                ││                │
│  │  │ URL:  [https://example.com]  🔗     ││                │
│  │  │ 태그: [자동 추천]                    ││                │
│  │  │                     [저장] [취소]    ││                │
│  │  └─────────────────────────────────────┘│                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 공유 모드
| 모드 | 조건 | 동작 |
|------|------|------|
| **일반 공유 (Note)** | URL 미포함 | 텍스트를 내용에 입력, `memoType: 'note'` |
| **URL 공유 (Bookmark)** | URL 포함 | URL 필드에 입력, `memoType: 'bookmark'` |

---

## 4. 기술 구현 상세

### 4.1 PWA - Web Share Target API

#### manifest.json 수정
```json
{
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

#### /share 라우트 구조
```
src/routes/share/
├── +page.ts          # URL 파라미터 파싱, load 함수
└── +page.svelte      # 공유 수신 UI (MemoForm 활용)
```

### 4.2 Android (Capacitor) - Intent Filter

#### AndroidManifest.xml 추가
```xml
<!-- 텍스트/URL 공유 수신 -->
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

#### Intent 데이터 처리
- `@capacitor/app` 플러그인의 `appUrlOpen` 이벤트 활용
- Intent extras에서 `EXTRA_TEXT`, `EXTRA_SUBJECT` 추출
- /share 라우트로 데이터 전달

### 4.3 공유 데이터 처리 유틸

```typescript
// src/lib/utils/shareReceiver.ts

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  source: 'pwa' | 'native';
}

// URL 파라미터에서 공유 데이터 파싱
function parseSharedData(params: URLSearchParams): SharedData;

// 텍스트에서 URL 추출 (트위터 등에서 텍스트+URL 혼합 공유 시)
function extractUrlFromText(text: string): { url?: string; cleanText: string };

// 공유 데이터로 메모 타입 결정
function determineMemoType(data: SharedData): 'note' | 'bookmark';

// 공유 데이터를 MemoForm 초기값으로 변환
function sharedDataToMemoDefaults(data: SharedData): Partial<Memo>;
```

---

## 5. 구현 작업 목록

### Phase 1: PWA Web Share Target
- [x] `static/manifest.json` - share_target 설정 추가
- [x] `src/lib/utils/shareReceiver.ts` - 공유 데이터 처리 유틸 생성
- [x] `src/routes/share/+page.ts` - load 함수로 파라미터 파싱
- [x] `src/routes/share/+page.svelte` - 공유 수신 UI 페이지

### Phase 2: Android Native Intent
- [x] `android/app/src/main/AndroidManifest.xml` - intent-filter 추가
- [x] `src/lib/utils/capacitor.ts` - Intent 수신 핸들러 추가
- [x] `src/routes/+layout.svelte` - Native intent 리스너 설정

### Phase 3: UX 개선
- [x] 공유 저장 성공 시 토스트 메시지
- [x] 공유 취소 시 이전 앱으로 복귀 처리
- [x] 로딩 상태 표시

---

## 6. 파일 변경 목록

| 파일 | 작업 | 상태 |
|------|------|------|
| `static/manifest.json` | share_target 추가 | ✅ |
| `src/lib/utils/shareReceiver.ts` | 신규 생성 | ✅ |
| `src/routes/share/+page.ts` | 신규 생성 | ✅ |
| `src/routes/share/+page.svelte` | 신규 생성 | ✅ |
| `android/app/src/main/AndroidManifest.xml` | intent-filter 추가 | ✅ |
| `src/lib/utils/capacitor.ts` | Intent 핸들러 추가 | ✅ |
| `src/routes/+layout.svelte` | Intent 리스너 설정 | ✅ |
| `package.json` | @capacitor/app 의존성 추가 | ✅ |

---

## 7. 테스트 시나리오

| # | 시나리오 | 기대 결과 | 상태 |
|---|----------|-----------|------|
| 1 | Chrome에서 웹페이지 공유 → 메모알람 선택 | URL+제목이 메모 폼에 입력, bookmark 타입 | 🔲 |
| 2 | 트위터에서 트윗 공유 (텍스트+URL) | URL 분리되어 입력, 텍스트는 내용에 | 🔲 |
| 3 | 유튜브에서 영상 공유 | 영상 제목+URL 입력, bookmark 타입 | 🔲 |
| 4 | 메모장에서 텍스트만 공유 (URL 없음) | 텍스트가 내용에 입력, note 타입 | 🔲 |
| 5 | Android 네이티브 앱에서 공유 | PWA와 동일하게 동작 | 🔲 |
| 6 | 공유 후 저장 클릭 | 메모 저장, 메모 목록으로 이동 | 🔲 |
| 7 | 공유 후 취소 클릭 | 이전 앱으로 복귀 또는 홈으로 이동 | 🔲 |

> 테스트는 실제 기기에서 배포 후 진행 필요

---

## 8. 참고 자료

- [Web Share Target API - MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target)
- [Receiving shared data - web.dev](https://web.dev/web-share-target/)
- [Android Intent Filters](https://developer.android.com/training/sharing/receive)
- [Capacitor App Plugin](https://capacitorjs.com/docs/apis/app)

---

## 9. 완료 기록

- **완료일**: 2026-01-24
- **구현자**: Claude (Opus 4.5)
- **브랜치**: `claude/add-url-sharing-feature-GaTCT`
- **비고**:
  - PWA Web Share Target API 및 Android Intent-filter 모두 구현 완료
  - @capacitor/app 패키지 추가 설치됨
  - 실제 테스트는 배포 후 기기에서 진행 필요
