# 알림 발송 내역 기능 PRD

> **✅ 구현 완료** (2026-02-04)
>
> Phase 1 (P0) + Phase 2 (P1) + Supabase 동기화 전체 구현 완료.
> STEP 14 (사용자 수동 테스트)만 펜딩 [-].
>
> - STEP 1~13: Phase 1 구현 완료 ✅
> - STEP 14 (테스트): 사용자 수동 테스트 펜딩 [-]
> - STEP 15: Phase 2 준비 완료 ✅
> - STEP 16~20: Phase 2 구현 완료 ✅
> - Supabase 동기화: 온라인 시 자동 업로드, 오프라인 pending 큐, 온라인 복귀 시 배치 sync ✅

## 개요

사용자에게 발송된 알림의 이력을 기록하고 조회할 수 있는 기능을 추가한다. 알림이 언제, 어떤 메모에 대해, 어떤 채널로 발송되었는지 추적하여 사용자가 놓친 알림을 확인하고 알림 시스템의 정상 동작 여부를 판단할 수 있도록 한다.

## 배경 및 목적

현재 알림은 발송 후 기록이 남지 않아 다음과 같은 문제가 있다.

- 사용자가 알림을 놓쳤을 때 어떤 알림이 왔었는지 확인할 방법이 없음
- 알림이 정상 발송되었는지 디버깅이 어려움
- 알림 패턴을 분석하여 설정을 최적화할 근거가 없음

## 사용자 시나리오

### 시나리오 1: 놓친 알림 확인

사용자가 외출 중 여러 알림을 놓겼다. 앱을 열어 알림 내역 탭에서 오늘 발송된 알림 목록을 확인하고, 각 알림의 원본 메모로 이동하여 내용을 확인한다.

### 시나리오 2: 알림 동작 확인

사용자가 새 알림을 설정한 후 정상적으로 발송되는지 확인하고 싶다. 알림 내역에서 해당 메모의 발송 기록을 확인하여 시간과 상태를 검증한다.

### 시나리오 3: 알림 설정 최적화

사용자가 알림 내역을 주 단위로 살펴보며 너무 자주 오거나 반응하지 않는 알림을 파악하고 설정을 조정한다.

## 기능 요구사항

### 필수 기능 (P0)

**발송 기록 저장**
- 알림 발송 시 자동으로 내역 기록
- 기록 항목: 발송 시각, 메모 ID, 메모 제목, 알림 유형(기본/추가), 발송 채널(PWA push / Capacitor local notification), 발송 상태(성공/실패)

**발송 내역 목록 조회**
- 날짜별 그룹핑된 알림 발송 내역 리스트
- 각 항목에 시각, 메모 제목, 발송 상태 표시
- 최신순 정렬
- 항목 클릭 시 해당 메모로 이동

**발송 상태 표시**
- 성공: 정상 발송 완료
- 실패: 발송 시도했으나 오류 발생 (에러 메시지 포함)
- 미확인: 발송했으나 수신 확인 불가

### 선택 기능 (P1)

**필터링**
- 기간 필터: 오늘 / 최근 7일 / 최근 30일 / 사용자 지정
- 상태 필터: 전체 / 성공 / 실패
- 메모별 필터: 특정 메모의 알림 내역만 조회

**내역 삭제**
- 개별 내역 삭제
- 기간 지정 일괄 삭제
- 전체 내역 초기화

**통계 요약**
- 기간별 발송 건수
- 성공/실패 비율
- 가장 많이 발송된 메모 Top 5

### 향후 검토 (P2)

**알림 수신 확인**
- 사용자가 알림을 클릭하여 확인한 시각 기록
- 미확인 알림 하이라이트 표시

**내보내기**
- 알림 내역을 CSV로 내보내기

## 데이터 모델

### NotificationHistory

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 ID (noti_타임스탬프_랜덤) |
| memoId | string | 대상 메모 ID |
| memoTitle | string | 발송 시점의 메모 제목 (스냅샷) |
| reminderId | string | 알림 설정 ID |
| reminderType | 'default' / 'additional' | 기본알림 / 추가알림 |
| channel | 'sw-push' / 'capacitor-local' / 'fcm-push' | 발송 채널 |
| status | 'success' / 'failed' / 'unknown' | 발송 상태 |
| errorMessage | string (nullable) | 실패 시 에러 메시지 |
| sentAt | ISO datetime string | 발송 시각 |
| readAt | ISO datetime string (nullable) | 확인 시각 (P2) |

### 저장소 전략

현재 앱은 localStorage 기반 캐시를 사용하고 있으므로 동일한 패턴을 따른다.

- 로컬 저장: localStorage (기존 앱 저장소 패턴 활용, 키: memo-alarm:notification-history)
- 서버 동기화: Supabase ma_notification_history 테이블 (온라인 시 동기화)
- 보관 기간: 기본 90일, 설정에서 변경 가능
- 용량 관리: localStorage 제한을 고려하여 최대 500건 유지, 초과 시 오래된 것부터 삭제

## 현재 알림 발송 흐름과 기록 삽입 지점

알림이 발송되는 곳은 크게 세 군데이며, 각 지점에 기록 로직을 추가해야 한다.

### 1. Service Worker (백그라운드 발송)

- 파일: src/service-worker.ts
- 함수: showSingleNotification(), showMergedNotification()
- 흐름: checkScheduledReminders() 에서 매분 시간 비교 → 일치하면 showNotification() 호출
- 기록 삽입: showNotification() 호출 직후 성공/실패 결과를 postMessage로 메인 앱에 전달

### 2. Notification Store (포그라운드 발송)

- 파일: src/lib/stores/notifications.svelte.ts
- 함수: checkAndTriggerReminders() 내부의 showNotification() 호출 부분
- 흐름: setInterval 60초마다 체크 → 시간 일치 시 Notification API 직접 호출
- 기록 삽입: showNotification() 호출 직후 결과를 바로 notificationHistoryStore에 기록

### 3. Capacitor 로컬 알림 (네이티브)

- 파일: src/lib/utils/capacitor.ts
- 함수: scheduleNotification()
- 흐름: LocalNotifications.schedule() 호출로 OS에 예약
- 기록 삽입: schedule() 성공/실패 결과를 기록. 실제 발송 시점은 OS가 관리하므로 "예약 성공"으로 기록

## UI 설계

### 진입점

- 하단 네비게이션(BottomNav.svelte)에 "알림 내역" 아이콘 추가
- 설정 페이지의 알림 관리 섹션에서 "발송 내역 보기" 링크
- 메모 상세에서 해당 메모의 알림 내역 바로가기 (P1)

### 목록 화면 (/notifications 라우트)

- 상단: 페이지 제목 "알림 내역" + 기간 필터 셀렉터 (P1)
- 본문: 날짜별 섹션으로 구분된 알림 내역 카드 리스트
  - 카드 구성: 시각, 메모 제목(이모지 포함), 채널 아이콘, 상태 배지
  - 실패 항목: 붉은 배경 하이라이트 + 에러 메시지 펼침 가능
  - 카드 클릭: 해당 메모로 이동 (goto)
- 하단: 더 보기 버튼 또는 무한 스크롤

### 빈 상태

- 아직 발송된 알림이 없을 때: Bell 아이콘 + "아직 발송된 알림이 없습니다" + 알림 설정 안내

### 내역 카드 상세 구성

| 영역 | 내용 |
|------|------|
| 좌측 | 시각 (HH:MM) |
| 중앙 상단 | 메모 이모지 + 메모 제목 |
| 중앙 하단 | 채널 라벨 (PWA / 네이티브 / FCM) |
| 우측 | 상태 배지 (성공: 초록, 실패: 빨강, 미확인: 회색) |

## 기술 고려사항

### Service Worker ↔ 메인 앱 통신

Service Worker에서 알림을 발송한 후 메인 앱에 기록 데이터를 전달하려면 postMessage를 사용한다. 기존 swMessages.ts에 새 메시지 타입을 추가하고, 메인 앱의 메시지 핸들러에서 수신하여 저장한다.

### 데이터 정합성

- 메모 삭제 시 내역은 보존 (memoTitle 스냅샷으로 조회 가능)
- 알림 설정 변경/삭제 시 기존 내역은 영향받지 않음
- Service Worker가 비활성 상태일 때는 기록이 누락될 수 있으므로, SW 활성화 시 미전송 기록을 재시도하지는 않음 (복잡도 대비 효용 낮음)

### 성능

- localStorage에 JSON 배열로 저장, 최대 500건 제한
- 90일 초과 데이터는 앱 초기화(init) 시 자동 정리
- 목록 조회 시 20건 단위 페이지 로딩 ($state로 관리)

### 오프라인 지원

- 로컬 localStorage에 즉시 기록 (기존 패턴과 동일)
- 온라인 복귀 시 Supabase로 배치 동기화 (P1)

## 성공 지표

- 알림 발송 기록 누락률 5% 미만 (SW 비활성 상태 제외)
- 내역 목록 로딩 500ms 이내
- 알림 실패 시 사용자가 에러 메시지로 원인 파악 가능

## 일정 가이드

### Phase 1 (P0 필수 기능)

1. 데이터 모델(타입) 정의 및 localStorage 스토어 구현
2. Service Worker 발송 로직에 기록 전달 코드 추가
3. Notification Store 발송 로직에 기록 코드 추가
4. 알림 내역 목록 페이지 UI 구현
5. 하단 네비게이션에 진입점 추가

### Phase 2 (P1 선택 기능)

6. 필터링 기능 구현 (기간, 상태)
7. 내역 삭제 기능 구현
8. 메모 상세에서 해당 메모 알림 내역 연결
9. Supabase 테이블 생성 및 동기화 구현
10. 통계 요약 화면 구현

---

## 구현 TODO 리스트 (초보 개발자용 세분화)

아래는 Phase 1 (P0) 기능을 구현하기 위한 상세 작업 목록이다. 각 단계는 이전 단계가 완료된 후 진행하는 것을 권장한다.

### STEP 1. 타입 정의 ✅

1-1. src/lib/types/memo.ts 파일을 연다.

1-2. 기존 Reminder 인터페이스 아래에 NotificationHistory 인터페이스를 추가한다. 위의 데이터 모델 표에 있는 필드들을 그대로 타입스크립트 인터페이스로 정의한다. id, memoId, memoTitle은 string, status는 유니온 타입으로 정의한다.

1-3. channel 필드의 타입을 'sw-push', 'capacitor-local', 'fcm-push' 세 가지 유니온으로 정의한다. 이 값은 어디서 알림을 보냈는지 구분하는 용도이다.

1-4. status 필드의 타입을 'success', 'failed', 'unknown' 세 가지 유니온으로 정의한다.

1-5. errorMessage와 readAt은 string 또는 null이 될 수 있으므로 optional(?)로 정의한다.

### STEP 2. 알림 내역 Store 생성 ✅

2-1. src/lib/stores/ 폴더에 notificationHistory.svelte.ts 파일을 새로 만든다.

2-2. 기존 notifications.svelte.ts 파일을 열어서 스토어 구조를 참고한다. createNotificationStore 함수의 구조(상태 선언 → 함수 정의 → return 객체)를 동일하게 따라 만든다.

2-3. 스토어 내부에 localStorage 키를 정한다. 기존 앱에서 사용하는 패턴을 따라 'memo-alarm:notification-history' 로 지정한다.

2-4. $state로 관리할 상태를 선언한다.
- histories: NotificationHistory 배열 (전체 내역)
- initialized: boolean (초기화 여부)

2-5. loadFromStorage 함수를 만든다. localStorage에서 키로 데이터를 읽어 JSON.parse로 파싱하고 histories 상태에 넣는다. 데이터가 없거나 파싱 실패 시 빈 배열로 초기화한다. 기존 notifications.svelte.ts의 loadLastNotified 함수(38행)를 참고한다.

2-6. saveToStorage 함수를 만든다. histories 배열을 JSON.stringify로 변환하여 localStorage에 저장한다. 기존 notifications.svelte.ts의 saveLastNotified 함수(50행)를 참고한다.

2-7. addRecord 함수를 만든다. 이 함수가 핵심이다. NotificationHistory 객체를 받아서 histories 배열 맨 앞에 추가하고, 500건 초과 시 뒤에서부터 잘라내고, saveToStorage를 호출한다.

2-8. cleanup 함수를 만든다. histories 배열을 순회하면서 sentAt이 90일 이전인 항목을 필터링으로 제거하고 saveToStorage를 호출한다.

2-9. init 함수를 만든다. loadFromStorage를 호출하고, cleanup을 호출하고, initialized를 true로 바꾼다.

2-10. getByMemoId 함수를 만든다. memoId를 인자로 받아 histories에서 해당 메모의 내역만 필터링하여 반환한다.

2-11. getByDateRange 함수를 만든다. 시작일과 종료일을 인자로 받아 해당 기간의 내역만 필터링하여 반환한다.

2-12. getGroupedByDate 함수를 만든다. histories 배열을 날짜(YYYY-MM-DD) 기준으로 그룹핑하여 Map 또는 객체로 반환한다. UI에서 날짜별 섹션을 그릴 때 사용한다.

2-13. clearAll 함수를 만든다. histories를 빈 배열로 초기화하고 saveToStorage를 호출한다.

2-14. return 객체에 위에서 만든 함수들과 get 접근자를 넣는다. 기존 스토어 패턴처럼 get histories()로 상태를 노출한다.

2-15. 파일 맨 아래에서 createNotificationHistoryStore()를 호출하고 export const notificationHistoryStore로 내보낸다.

### STEP 3. ID 생성 헬퍼 함수 ✅

3-1. addRecord 함수 내부에서 ID를 생성해야 한다. 기존 ReminderSettings.svelte의 generateReminderId 함수를 참고하여 동일한 패턴으로 noti_ 접두사를 사용한다. 예: noti_1706900000000_abc1234

### STEP 4. Service Worker 메시지 타입 추가 ✅

4-1. src/lib/constants/swMessages.ts 파일을 연다.

4-2. 기존 SW_MSG 객체에 NOTIFICATION_SENT라는 새 키를 추가한다. 값은 'NOTIFICATION_SENT'로 한다. 이 메시지는 Service Worker가 알림을 보낸 후 메인 앱에 "알림을 보냈다"고 알려주는 용도이다.

### STEP 5. Service Worker 발송 기록 전달 ✅

5-1. src/service-worker.ts 파일을 연다.

5-2. showSingleNotification 함수를 찾는다 (139행 부근). 이 함수 내부에서 sw.registration.showNotification()이 호출되는 부분을 찾는다.

5-3. showNotification() 호출을 try-catch로 감싼다. 성공 시 status를 'success'로, catch에서 'failed'로 설정한다.

5-4. showNotification() 호출 결과가 나온 후, sw.clients.matchAll()로 열려있는 모든 클라이언트(브라우저 탭)를 가져온다. 각 클라이언트에 postMessage로 NOTIFICATION_SENT 메시지와 함께 다음 정보를 보낸다: memoId, memoTitle, reminderId, reminderType(isDefault 여부), channel('sw-push'), status, errorMessage, sentAt(현재 시각 ISO 문자열).

5-5. showMergedNotification 함수에도 동일한 처리를 추가한다. 병합 알림은 여러 메모를 한 번에 알리므로, 각 메모별로 NOTIFICATION_SENT 메시지를 보내야 한다.

5-6. 주의: Service Worker에서는 localStorage에 직접 접근할 수 없다. 그래서 postMessage로 메인 앱에 보내는 것이다.

### STEP 6. 메인 앱에서 Service Worker 메시지 수신 ✅

6-1. src/lib/stores/notifications.svelte.ts 파일을 연다.

6-2. init 함수 내부에서 navigator.serviceWorker.addEventListener('message', ...) 부분을 찾는다. 이미 Service Worker 메시지를 수신하는 핸들러가 있을 것이다.

6-3. 해당 핸들러에 NOTIFICATION_SENT 메시지 타입에 대한 분기를 추가한다. 이 분기에서 event.data에 담긴 알림 정보를 꺼내서 notificationHistoryStore.addRecord()를 호출한다.

6-4. addRecord에 넘길 객체를 만들 때, Service Worker에서 보낸 데이터(memoId, memoTitle, status 등)를 그대로 사용한다.

### STEP 7. Notification Store 포그라운드 발송 기록 ✅

7-1. 같은 파일(notifications.svelte.ts)에서 checkAndTriggerReminders 함수를 찾는다 (166행 부근).

7-2. 이 함수 내부에서 new Notification() 또는 showNotification()이 호출되는 부분을 찾는다.

7-3. 해당 호출을 try-catch로 감싸고, 성공/실패에 따라 notificationHistoryStore.addRecord()를 호출한다. channel은 'sw-push'로 설정한다. (포그라운드에서도 Service Worker를 통해 발송하므로)

7-4. 알림 발송에 필요한 메모 정보(memoId, memoTitle, reminderId 등)는 checkAndTriggerReminders 함수의 순회 루프 안에서 이미 사용하고 있으므로 그대로 가져다 쓴다.

### STEP 8. Capacitor 발송 기록 ✅

8-1. src/lib/utils/capacitor.ts 파일을 연다.

8-2. scheduleNotification 함수를 찾는다 (64행 부근).

8-3. LocalNotifications.schedule() 호출을 try-catch로 감싼다.

8-4. 성공 시 notificationHistoryStore.addRecord()를 호출한다. channel은 'capacitor-local', status는 'success'로 설정한다. Capacitor는 OS에 예약하는 것이므로 "예약 성공"을 기록하는 것이다.

8-5. 실패 시에도 addRecord를 호출하되 status를 'failed', errorMessage에 에러 메시지를 담는다.

### STEP 9. 앱 초기화에 스토어 등록 ✅

9-1. src/routes/+layout.svelte 파일을 연다.

9-2. onMount 내부의 초기화 순서를 찾는다 (88행 부근). notificationStore.init() 호출 다음에 notificationHistoryStore.init()을 추가한다. 기록 스토어는 알림 스토어가 초기화된 후에 초기화되어야 한다.

9-3. 파일 상단의 import 영역에 notificationHistoryStore를 import한다.

### STEP 10. 알림 내역 페이지 라우트 생성 ✅

10-1. src/routes/ 폴더 아래에 notifications 폴더를 만든다.

10-2. notifications 폴더 안에 +page.svelte 파일을 만든다. 이것이 /notifications 경로로 접근 가능한 알림 내역 페이지가 된다.

### STEP 11. 알림 내역 페이지 UI 구현 ✅

11-1. +page.svelte 파일에 script 태그를 작성한다. notificationHistoryStore를 import하고, 날짜별 그룹핑된 데이터를 $derived로 가져온다.

11-2. 페이지 상단 영역을 만든다. "알림 내역" 제목과 전체 건수를 표시한다.

11-3. 날짜별 섹션을 반복 렌더링한다. each 블록으로 날짜 키를 순회하고, 각 날짜 아래에 해당 날짜의 내역 카드들을 나열한다.

11-4. 내역 카드 컴포넌트를 만든다. src/lib/components/notifications/ 폴더를 만들고 HistoryCard.svelte 파일을 생성한다.

11-5. HistoryCard에 표시할 내용: 좌측에 시각(HH:MM), 중앙에 메모 제목, 우측에 상태 배지. 기존 ReminderCard.svelte의 카드 스타일(border, rounded-lg, p-3 등)을 참고하여 일관된 디자인을 유지한다.

11-6. 상태 배지 색상을 정한다. success는 bg-green-100 text-green-700, failed는 bg-red-100 text-red-700, unknown은 bg-gray-100 text-gray-500를 사용한다. 다크모드도 고려하여 dark: 변형을 추가한다.

11-7. 카드 클릭 이벤트를 처리한다. goto 함수를 import하고, 카드 클릭 시 goto('/memos')로 이동하되, 해당 메모가 선택되도록 한다. 또는 메모 상세 모달을 여는 방법을 기존 코드에서 확인한다.

11-8. 빈 상태 화면을 만든다. histories 배열이 비어있을 때 Bell 아이콘과 "아직 발송된 알림이 없습니다" 메시지를 표시한다. 기존 앱의 빈 상태 패턴을 참고한다.

11-9. 더 보기 기능을 구현한다. $state로 displayCount를 관리하고 초기값 20으로 설정한다. 버튼 클릭 시 20씩 증가시키고, 표시할 데이터를 histories.slice(0, displayCount)로 잘라서 보여준다.

11-10. 실패 항목의 에러 메시지 펼침 기능을 구현한다. 카드에 status가 'failed'이고 errorMessage가 있을 때, 카드 하단에 에러 메시지를 표시한다. 접기/펼치기 버튼은 생략하고 항상 표시해도 된다.

### STEP 12. 하단 네비게이션에 진입점 추가 ✅

12-1. src/lib/components/BottomNav.svelte 파일을 연다.

12-2. 기존 네비게이션 항목들의 구조를 파악한다. 각 항목은 아이콘 + 라벨 + 경로로 구성되어 있다.

12-3. 적절한 위치에 알림 내역 항목을 추가한다. 아이콘은 lucide-svelte의 BellRing 또는 History를 사용한다. 경로는 /notifications로, 라벨은 "알림내역"으로 한다.

12-4. 현재 경로가 /notifications일 때 활성 상태 스타일이 적용되는지 확인한다. 기존 항목의 활성 상태 로직을 그대로 따라한다.

### STEP 13. 채널 표시용 유틸 함수 ✅

13-1. HistoryCard 내부 또는 별도 유틸 파일에 채널 값을 사용자가 읽기 좋은 텍스트로 변환하는 함수를 만든다. 'sw-push'는 "웹 푸시", 'capacitor-local'은 "네이티브", 'fcm-push'는 "FCM"으로 변환한다.

### STEP 14. 테스트 [-] (사용자 수동 테스트 펜딩)

14-1. 앱을 개발 모드로 실행한다 (npm run dev).

14-2. 설정 페이지의 개발자 모드에서 테스트 알림 보내기 기능이 있다. 이 기능으로 알림을 발송한 후, /notifications 페이지에서 내역이 기록되는지 확인한다.

14-3. 기록이 안 된다면 브라우저 개발자 도구 콘솔에서 에러를 확인한다. localStorage에 'memo-alarm:notification-history' 키로 데이터가 저장되었는지 Application 탭에서 확인한다.

14-4. 앱을 새로고침한 후에도 내역이 유지되는지 확인한다 (localStorage 영속성 테스트).

14-5. 500건 초과 시 오래된 항목이 삭제되는지 확인한다. 개발자 콘솔에서 직접 addRecord를 반복 호출하여 테스트할 수 있다.

14-6. 메모를 삭제한 후에도 해당 메모의 알림 내역이 남아있는지 확인한다 (memoTitle 스냅샷 보존).

### STEP 15. Phase 2 준비 ✅

15-1. Phase 1 완료 확인. Phase 2 세부 TODO 아래에 추가.

---

## Phase 2 (P1) 구현 TODO 리스트

### STEP 16. 필터링 기능 (기간/상태) ✅

16-1. notificationHistory.svelte.ts에 getByStatus(status) 함수를 추가한다. histories에서 해당 status만 필터링하여 반환한다.

16-2. 알림 내역 페이지 상단에 상태 필터 탭을 추가한다. 기존 FilterTabs.svelte 패턴(bg-muted rounded-lg 안에 버튼 나열)을 참고. 탭: 전체 / 성공 / 실패.

16-3. 기간 필터 셀렉터를 추가한다. 옵션: 오늘 / 최근 7일 / 최근 30일 / 전체. select 또는 드롭다운으로 구현.

16-4. 필터 상태를 $state로 관리하고, $derived로 필터링된 내역을 계산한다.

### STEP 17. 내역 삭제 기능 ✅

17-1. notificationHistory.svelte.ts에 deleteById(id) 함수를 추가한다. histories에서 해당 id를 제거하고 saveToStorage.

17-2. notificationHistory.svelte.ts에 deleteByDateRange(start, end) 함수를 추가한다. 기간 내 내역을 일괄 삭제.

17-3. HistoryCard에 스와이프 또는 길게 눌러 삭제 대신, 페이지 상단에 "전체 삭제" 버튼을 추가한다. 확인 다이얼로그 후 clearAll() 호출.

### STEP 18. 메모 상세에서 알림 내역 연결 ✅

18-1. MemoDetailModal.svelte의 메타 정보 영역(알림 스케줄 표시 부분 근처)에 "알림 발송 내역" 링크를 추가한다.

18-2. 클릭 시 /notifications 페이지로 이동하되, 쿼리 파라미터로 memoId를 전달. 예: goto(`/notifications?memoId=${memo.id}`)

18-3. 알림 내역 페이지에서 URL 쿼리 memoId를 읽어 해당 메모의 내역만 필터링하여 표시한다.

### STEP 19. Supabase 마이그레이션 SQL ✅

19-1. data/migrations/ 폴더에 006_notification_history.sql 파일을 생성한다. (005번은 이미 존재)

19-2. ma_notification_history 테이블을 생성한다. 기존 004 패턴 참고: user_id TEXT, id TEXT PRIMARY KEY, memo_id TEXT, memo_title TEXT, reminder_id TEXT, reminder_type TEXT, channel TEXT, status TEXT, error_message TEXT, sent_at TIMESTAMPTZ, read_at TIMESTAMPTZ, version INTEGER, created_at/updated_at TIMESTAMPTZ.

19-3. RLS 정책을 추가한다. auth.uid() 기반 사용자 격리.

19-4. user_id, sent_at, status에 인덱스를 추가한다.

### STEP 20. 통계 요약 화면 ✅

20-1. notificationHistory.svelte.ts에 getStats() 함수를 추가한다. 반환: { total, success, failed, unknown, successRate }.

20-2. 알림 내역 페이지 상단(제목 아래)에 접기/펼치기 가능한 통계 섹션을 추가한다.

20-3. 통계 항목: 전체 발송 건수, 성공률 (%), 실패 건수, 가장 많이 발송된 메모 Top 3.
