# 알림 설정 UI 수정 계획서

검증결과: **완료**

## 배경

메모의 알림 설정에서 기본알림(isDefault=true)의 편집 필드들이 grayout 되어 사용자가 알림을 수정할 수 없는 문제가 발생함. 또한 기본알림 설정 여부에 따라 추가 알림 등록 진입점이 달라지는 구조적 문제가 있었음.

## 문제 분석

### 문제 1: 기본알림 수정 UI가 비활성 상태로 노출

- ReminderCard.svelte에서 `isDefault=true`일 때 `disabled={disabled || isDefault}` 조건으로 시간, 타입, 요일 입력이 grayout
- 사용자에게 수정할 수 없는 폼이 보이지만 왜 수정이 안 되는지 안내 없음
- 펼침(expand) 버튼과 삭제 버튼도 노출되어 혼란 유발

### 문제 2: 추가 알림 등록이 기본알림 설정에 종속

- 알림이 없을 때 "알림 추가" 버튼이 기본알림만 생성 (addDefaultReminder)
- 기본알림 없이 추가 알림만 등록하는 진입점이 없음

## 수정 내역

### 1. ReminderCard.svelte - 기본알림 읽기전용 표시

**변경 전:**
- isDefault일 때 expand 버튼, 삭제 버튼 노출
- 확장 시 grayout된 수정 폼 노출

**변경 후:**
- isDefault일 때 expand/삭제 버튼 제거
- 확장 설정 영역 자체를 렌더링하지 않음 (`{#if !isDefault && expanded}`)
- 카드 하단에 "설정에서 수정 가능" 안내 텍스트 표시
- 토글(활성/비활성)만 동작
- 헤더에 시간, 타입 배지, 요일 정보는 그대로 표시

### 2. ReminderSettings.svelte - 추가 알림 독립 등록

**변경 전:**
- 알림 없을 때: "알림 추가" → addDefaultReminder만 호출

**변경 후:**
- 알림 없을 때: "기본 알림 추가" | "알림 추가" 두 개 버튼 분리 노출
- 사용자가 기본알림 없이도 추가 알림을 바로 등록 가능
- 기존 추가 알림의 등록/수정/삭제/조회 기능은 변경 없이 유지

### 3. ReminderCard.svelte - 불필요한 isDefault 조건 정리

- 확장 설정 내부의 `disabled={disabled || isDefault}` → `disabled={disabled}`
- isDefault일 때 해당 영역이 렌더링되지 않으므로 중복 조건 제거

## 수정 파일

| 파일 | 변경 요약 |
|------|----------|
| src/lib/components/memo/ReminderCard.svelte | 기본알림: expand/삭제 버튼 제거, 수정 폼 비노출, 안내 텍스트 추가 |
| src/lib/components/memo/ReminderSettings.svelte | 빈 상태에서 "기본 알림 추가" / "알림 추가" 분리 |

## 검증

- svelte-check: 수정 파일에서 신규 타입 에러 없음
- 기본알림: 토글만 동작, 수정 UI 비노출 확인
- 추가알림: 기본알림 유무와 무관하게 등록/수정/삭제/조회 가능
