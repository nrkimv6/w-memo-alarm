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

## 미결정 사항 (Phase 진행 전 결정 필요)

아래 항목들은 해당 Phase 시작 전에 결정이 필요하다.
각 Phase plan 문서에도 [결정 필요] 태그로 표시해두었다.

### Phase 1 시작 전 결정

| # | 항목 | 관련 PRD |
|---|------|---------|
| 1 | **네비게이션 구조**: 5탭 vs 4탭+홈위젯 | PRD 5.1 |
| 2 | **"하루 종일" 할일의 overdue 시각**: 23:59? 다음날 00:00? | PRD 5.4 |
| 3 | **기존 memoType 'task' 데이터 존재 여부**: 마이그레이션 필요? | PRD 4.1 |
| 4 | **TodoGroup 테이블 생성 시점**: Phase 1 마이그레이션에 포함? Phase 4로 분리? | PRD 4.3, 10.1 |

### Phase 2 시작 전 결정

| # | 항목 | 관련 PRD |
|---|------|---------|
| 5 | **상기 알림 요약 범위**: 오늘 기한만? 미완료 전체? 이번주? | PRD 3.1.1 |
| 6 | **미루기 시 수동 알람 이동 여부**: 사용자가 직접 지정한 alertTimes도 재계산? | PRD 3.3 |

### Phase 3 시작 전 결정

| # | 항목 | 관련 PRD |
|---|------|---------|
| 7 | **overdue 반복할일의 자동 건너뛰기 여부**: 기한 N일 경과 시 자동 skip? | PRD 3.4 |
| 8 | **인스턴스별 미루기 이력 필요 여부**: TodoInstance에 history 추가? | PRD 4.1 |
| 9 | **todoInstances 비대화 방지 전략**: 오래된 인스턴스 아카이브 기준 | PRD 4.3 |
| 10 | **상기 알림에 미래 인스턴스 포함 여부**: 아직 미생성된 반복 일정도 카운트? | - |

---

## PRD 모순 사항 (수정 완료)

| 항목 | 문제 | 조치 |
|------|------|------|
| TodoDefaultSettings.postponeLimit | PRD 3.3.1에서 "설정 아님"으로 결정했으나 6.2에 남아있음 | PRD에서 제거 완료 |

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
