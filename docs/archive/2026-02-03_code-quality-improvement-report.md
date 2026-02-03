# 코드 품질 개선 보고서

> 작성일: 2026-02-03
> 브랜치: `claude/implement-remaining-features-pURjo`
> 커밋: `refactor: 코드 품질 개선 - console 정리, 유틸 추출, 모바일 UX 개선`

## 요약

총 **17개 파일** 수정 (+130 / -99 lines), 7개 개선 항목 완료.
improvement-plan.md와 safe-area-audit-report.md에서 식별된 항목들을 일괄 처리.

---

## 1. 프로덕션 console.log 정리

| 항목 | 내용 |
|------|------|
| **문제** | 25건의 디버그용 `console.log`가 프로덕션 코드에 잔존 |
| **해결** | 디버그 로그 전량 제거, `console.error`/`console.warn`만 유지 |
| **검증** | 에러 추적에 필요한 로그는 모두 보존됨 확인 |

**수정 파일 (10개):**

| 파일 | 제거 건수 | 잔여 error/warn |
|------|----------|----------------|
| `src/lib/fcm.ts` | 7건 | 6건 (error 5, warn 1) |
| `src/routes/+layout.svelte` | 5건 | 2건 (error) |
| `src/lib/services/syncQueue.ts` | 3건 | 3건 (error) |
| `src/routes/auth/callback/+page.svelte` | 5건 | 3건 (error) |
| `src/lib/services/networkStatus.svelte.ts` | 2건 | 0건 |
| `src/lib/stores/auth.svelte.ts` | 1건 | 2건 (error) |
| `src/lib/utils/capacitor.ts` | 1건 | 4건 (error) |
| `src/lib/stores/memos.svelte.ts` | 1건 | warn 유지 |

**판단 근거:**
- FCM config 로그 → 환경변수 누락 시에만 `console.warn` 으로 전환
- Layout 초기화 로그 → 디버깅 목적만이므로 제거
- Auth callback 로그 → 에러 시에만 `console.error` 유지
- Network 상태 로그 → 불필요 (콜백 시스템으로 이미 전파됨)
- SyncQueue 진행 로그 → 제거 (실패 시 error만 유지)

---

## 2. 시간 포맷 유틸리티 추출

| 항목 | 내용 |
|------|------|
| **문제** | `HH:MM` 시간 포맷, ISO 날짜 변환이 5곳에 중복 |
| **해결** | `src/lib/utils/timeUtils.ts` 신규 생성, 공통 함수 추출 |
| **검증** | 함수 시그니처/반환값이 원래 인라인 코드와 동일함 확인 |

**생성 파일:**
```
src/lib/utils/timeUtils.ts
├── getCurrentTimeHHMM(date?: Date): string  // "HH:MM"
└── getTodayDateISO(date?: Date): string     // "YYYY-MM-DD"
```

**사용처:**
- `notifications.svelte.ts` — 4곳 (line 176, 178, 335, 345)
- `service-worker.ts` — 로컬 헬퍼로 동일 구현 (SW 스코프에서 $lib import 불가)

---

## 3. SW 메시지 타입 상수 추출

| 항목 | 내용 |
|------|------|
| **문제** | Service Worker ↔ Main Thread 메시지 타입이 문자열 하드코딩 |
| **해결** | `src/lib/constants/swMessages.ts` 생성, `SW_MSG` 상수 객체로 중앙 관리 |
| **검증** | 8개 상수 값이 SW 측 리터럴과 정확히 일치 확인 |

**상수 정의:**

| 상수 | 값 | 사용처 |
|------|-----|--------|
| `SKIP_WAITING` | `'SKIP_WAITING'` | settings |
| `TEST_NOTIFICATION` | `'TEST_NOTIFICATION'` | settings |
| `DELAYED_NOTIFICATION` | `'DELAYED_NOTIFICATION'` | settings |
| `REGISTER_MEMO_REMINDERS` | `'REGISTER_MEMO_REMINDERS'` | notifications |
| `UPDATE_MEMO_REMINDER` | `'UPDATE_MEMO_REMINDER'` | notifications |
| `REMOVE_MEMO_REMINDER` | `'REMOVE_MEMO_REMINDER'` | notifications |
| `GET_SCHEDULED_REMINDERS` | `'GET_SCHEDULED_REMINDERS'` | notifications |
| `SW_LOG` | `'SW_LOG'` | notifications |

**설계 결정:**
- Service Worker 측은 자체 스코프에서 문자열 리터럴 그대로 유지 (SvelteKit alias import 불가)
- Main Thread 측만 상수 사용으로 오타 방지

---

## 4. Modal dvh 단위 적용

| 항목 | 내용 |
|------|------|
| **문제** | `vh` 단위가 모바일 가상 키보드를 고려하지 않음 |
| **해결** | `vh` → `dvh`, `vw` → `dvw` (Dynamic Viewport units) |
| **검증** | 두 모달 모두 정상 적용, 추가 vh/vw 사용처 없음 확인 |

**수정 상세:**

| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `Modal.svelte` | `max-h-[90vh]` | `max-h-[90dvh]` |
| `OnboardingModal.svelte` | `h-screen w-screen max-h-screen` | `h-dvh w-dvw max-h-dvh` |

**브라우저 호환성:**
- `dvh`/`dvw`: Chrome 108+, Safari 15.4+, Firefox 101+ (2022년 이후 모든 주요 브라우저)
- Capacitor WebView (Chrome 기반): 지원

---

## 5. group-hover 모바일 터치 지원

| 항목 | 내용 |
|------|------|
| **문제** | `group-hover:opacity-100` 요소가 터치 디바이스에서 접근 불가 |
| **해결** | `@media (hover: none)` 규칙 추가로 터치 환경에서 항상 표시 |
| **검증** | MemoCard, ChecklistEditor의 3곳 모두 커버됨 확인 |

**추가된 CSS (`app.css`):**
```css
@media (hover: none) {
    .group .group-hover\:opacity-100 {
        opacity: 1;
    }
}
```

**적용 범위:**
- `MemoCard.svelte:172` — 핀/케밥 메뉴 버튼
- `ChecklistEditor.svelte:132` — 이동 버튼 (위/아래)
- `ChecklistEditor.svelte:180` — 삭제 버튼

---

## 6. Family Sites 드롭다운 터치 지원

| 항목 | 내용 |
|------|------|
| **문제** | `group-hover`로만 동작하여 터치 디바이스에서 접근 불가 |
| **해결** | 클릭 토글 패턴으로 전환 (데스크톱 & 모바일 모두 지원) |
| **검증** | 외부 클릭 닫기, 링크 클릭 시 닫기, 이벤트 정리 모두 정상 |

**구현 상세:**
- `familySitesOpen` 상태 변수로 렌더링 제어 (`{#if}`)
- `toggleFamilySites()` — 버튼 클릭 시 토글
- `handleDocumentClick()` — 외부 클릭 감지, `<svelte:document>` 활용
- `closeFamilySites()` — 링크 클릭 시 자동 닫힘
- 메모리 누수 없음: Svelte가 `<svelte:document>` 이벤트 자동 정리

---

## 교차검증 결과

| 검증 항목 | 결과 | 비고 |
|-----------|------|------|
| console.log 제거 후 에러 추적 가능 | ✅ PASS | error/warn 모두 보존 |
| timeUtils 함수 결과값 동일성 | ✅ PASS | 원래 인라인 코드와 100% 동일 |
| SW_MSG 상수 ↔ SW 리터럴 일치 | ✅ PASS | 8개 모두 정확히 일치 |
| dvh/dvw 브라우저 호환성 | ✅ PASS | 2022년 이후 모든 주요 브라우저 |
| group-hover 규칙 적용 범위 | ✅ PASS | 3곳 모두 커버 |
| 드롭다운 이벤트 리스너 정리 | ✅ PASS | svelte:document 자동 정리 |
| 유사 패턴 잔존 여부 | ✅ PASS | 추가 수정 필요 항목 없음 |
| 기존 타입 체크 에러 미유발 | ✅ PASS | 기존 24개 에러 그대로 (변경 무관) |

---

## 기존 계획 문서 반영 상태

### improvement-plan.md (2026-01-29) 항목 처리 현황

| 항목 | 우선순위 | 이번 처리 | 상태 |
|------|---------|----------|------|
| 백그라운드 알림 아키텍처 검토 | HIGH | ❌ (장기과제) | 미처리 |
| 빈 catch 블록 에러 로깅 | MEDIUM | ✅ 검토 완료 | 완료 (대부분 의도된 빈 catch) |
| 프로덕션 console 정리 | MEDIUM | ✅ | 완료 |
| 타입 변환 함수 통합 | MEDIUM | ❌ | 미처리 |
| 시간 포맷 유틸리티 추출 | MEDIUM | ✅ | 완료 |
| Button 컴포넌트 접근성 | MEDIUM | ❌ | 미처리 |
| 컴포넌트 aria-label 추가 | LOW | ❌ | 미처리 |
| MemoCard URL sanitize | LOW | ❌ | 미처리 |
| 알림 체크 최적화 | LOW | ❌ | 미처리 |
| MemoForm tag debounce | LOW | ❌ | 미처리 |
| SW 메시지 타입 상수화 | LOW | ✅ | 완료 |
| reminder.time 형식 검증 | LOW | ❌ | 미처리 |

### safe-area-audit-report.md 항목 처리 현황

| 항목 | 우선순위 | 이번 처리 | 상태 |
|------|---------|----------|------|
| [HIGH] Family Sites 터치 미작동 | HIGH | ✅ | 완료 |
| [MEDIUM] group-hover 터치 미작동 | MEDIUM | ✅ | 완료 |
| [MEDIUM] Modal max-h-[90vh] 키보드 충돌 | MEDIUM | ✅ | 완료 |
| [MEDIUM] OnboardingModal h-screen 문제 | MEDIUM | ✅ | 완료 |
| [HIGH] sticky 헤더 safe-area-inset-top | HIGH | ❌ | 미처리 (Android 15 대비) |
| [HIGH] 드롭다운 하단 오버플로우 | HIGH | ❌ | 미처리 (bits-ui 전환 검토 필요) |
| [LOW] 입력 필드 포커스 스크롤 패딩 | LOW | ❌ | 미처리 |
| [LOW] Android 15 edge-to-edge 대비 | LOW | ❌ | 미처리 (실기기 테스트 필요) |

---

## 남은 과제 (우선순위순)

1. **타입 변환 함수 통합** (MEDIUM) — supabaseToMemo/memoToSupabase 리팩토링
2. **Button 컴포넌트 접근성** (MEDIUM) — aria-label prop 지원
3. **드롭다운 하단 오버플로우** (HIGH) — viewport boundary 감지 또는 bits-ui 전환
4. **sticky 헤더 safe-area-inset-top** (HIGH) — Android 15 edge-to-edge 대비
5. **reminder.time 형식 검증** (LOW)
6. **MemoForm tag debounce** (LOW)
7. **알림 체크 최적화** (LOW)
