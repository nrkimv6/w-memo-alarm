# 할일(Todo) 기능 개발 계획 — 전체 개요

> **PRD**: [docs/prd/2026-02-04_todo-note-prd.md](../../prd/2026-02-04_todo-note-prd.md)
> **용어집**: [docs/prd/2026-02-04_todo-terminology.md](../../prd/2026-02-04_todo-terminology.md)
> **작성일**: 2026-02-04

---

## Phase 구성

| Phase | 이름 | 핵심 목표 | plan 파일 |
|-------|------|----------|----------|
| **1** | 기본 할일 (MVP) | 할일 CRUD + 기한 + 전용뷰 + 설정 | [phase-1-mvp.md](./phase-1-mvp.md) |
| **2** | 알림 3단계 + 미루기 | 상기/알람/기한초과 알림 + 미루기 에스컬레이션 | [phase-2-alarm-postpone.md](./phase-2-alarm-postpone.md) |
| **3** | 반복 할일 | 반복 설정 + 인스턴스 생성 + 건너뛰기 + 모아보기 | [phase-3-recurring.md](./phase-3-recurring.md) |
| **4** | Native 강화 + 그룹 + 통계 | Fullscreen Alert + 그룹핑 + 완료 통계 + 대량 처리 | [phase-4-native-group-stats.md](./phase-4-native-group-stats.md) |
| **5+** | 고급 기능 (향후) | 캘린더 뷰, 자연어 입력, 서브태스크 등 | (별도 plan 불필요) |

---

## Phase 간 의존 관계

```
Phase 1 (MVP)
  │
  ├─→ Phase 2 (알림 + 미루기)
  │     │
  │     └─→ Phase 3 (반복 할일)
  │           │
  │           └─→ Phase 4 (Native + 그룹 + 통계)
  │
  └─→ Phase 2와 독립적으로 진행 가능한 부분:
       - Phase 1의 설정 UI는 Phase 2 알림 기능의 기반이 됨
       - Phase 3의 반복 데이터 모델은 Phase 1에서 미리 정의
```

---

## 결정 완료 사항

| # | 항목 | 결정 내용 | 관련 PRD |
|---|------|----------|---------|
| 1 | **postponeLimit 설정 여부** | 설정 항목 아님. 미루기 시점에 사용자가 토글로 입력 (1.A) | PRD 3.3.1 |
| 2 | **"하루 종일" 할일의 overdue 시각** | `dueTime = '23:59'` | PRD 5.4 |
| 3 | **상기 알림 범위** | 개별 상기만 (각 할일의 remindTimes 시각에 개별 발송). 공통 요약 상기는 차후 고려 | PRD 3.1.1 |
| 4 | **미루기 시 수동 알람 이동 여부** | 이동 안 함. autoAlertBefore만 재계산. 수동 alertTimes는 유지 (과거 시각이면 무시) | PRD 3.3 |
| 5 | **TodoGroup 테이블 생성 시점** | Phase 1 마이그레이션에 DB 포함 (사용은 Phase 4) | PRD 4.3 |
| 6 | **네비게이션 구조** | 4탭: 홈 / 메모 / 할일 / 설정. 알림내역은 홈 벨 아이콘 또는 설정 하위 | PRD 5.1 |
| 7 | **기존 memoType 'task' 마이그레이션** | 기존에 task 타입 사용 이력 없음. 별도 처리 없이 마이그레이션 진행 | PRD 4.1 |
| 8 | **overdue 반복할일 처리** | 자동 skip 안 함. 다음 인스턴스는 그냥 생성. overdue가 쌓이면 사용자가 직접 처리 | PRD 3.4 |
| 9 | **todoInstances 비대화 방지** | 아카이브 전략은 차후 고려사항으로 분류 | PRD 4.3 |
| 10 | **상기 알림의 반복할일 카운트** | 현재 활성 인스턴스만 카운트. 미생성 미래 인스턴스는 포함하지 않음 | PRD 3.1.1 |

---

## 차후 고려사항

당장 구현하지 않지만 향후 검토가 필요한 항목들.

| # | 항목 | 설명 | 관련 Phase |
|---|------|------|-----------|
| 1 | **공통 상기 요약 알림** | 기한이 오늘인 할일을 공통상기시간에 모아서 요약 발송. 공통상기 방식 추가 검토 필요 | Phase 2+ |
| 2 | **인스턴스별 미루기 이력** | 반복 할일에서 인스턴스별 미루기 횟수/이력 추적. 현재는 Memo 레벨 PostponeInfo만 사용 | Phase 3+ |
| 3 | **todoInstances JSONB 아카이브 전략** | 반복 할일 인스턴스가 무한히 쌓이는 문제. 오래된 인스턴스 아카이브/삭제 기준 필요 | Phase 3+ |

---

## PRD 모순 사항 (수정 완료)

| 항목 | 문제 | 조치 |
|------|------|------|
| TodoDefaultSettings.postponeLimit | PRD 3.3.1에서 "설정 아님"으로 결정했으나 6.2에 남아있었음 | PRD에서 제거 완료 |
| 미루기 시 알람 이동 | 3.3에서 "함께 이동"으로 되어 있었으나 모호 | 자동알람만 재계산, 수동알람 유지로 명확화 |

---

## 기술 스택 참고

| 항목 | 기술 |
|------|------|
| 프레임워크 | SvelteKit 2 + Svelte 5 |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS 4 |
| 상태관리 | Svelte 5 runes ($state, $derived) |
| DB | Supabase (PostgreSQL) + localStorage (offline) |
| 알림 | Service Worker + Capacitor Local Notifications + FCM |
| 모바일 | Capacitor 8 |
| 배포 | Cloudflare Pages |

---

## 파일 구조 (이 디렉토리)

```
docs/plan/todo-feature/
├── 00-overview.md              ← 이 파일
├── phase-1-mvp.md              ← Phase 1 세부 태스크
├── phase-2-alarm-postpone.md   ← Phase 2 세부 태스크
├── phase-3-recurring.md        ← Phase 3 세부 태스크
└── phase-4-native-group-stats.md ← Phase 4 세부 태스크
```
