---
name: design-system
description: "프로젝트별 DESIGN.md(기계가 읽는 디자인 시스템 계약) 생성. Use when: DESIGN.md 생성, 디자인 시스템, design system, 브랜드 규칙"
---

# DESIGN.md 생성 — Codex 실행 절차

대상 프로젝트의 UI 단서를 읽고 프로젝트 root `DESIGN.md`를 생성하는 절차를 정의한다.
이 skill은 디자인 코드를 바로 생성하는 도구가 아니라, 이후 `design-prompt`와 UI 구현이 참조할 디자인 시스템 계약을 만드는 도구다.

Stitch/Figma/스크린샷은 참고 입력이다. 최종 판단은 기존 코드, CSS 변수, 컴포넌트 사용, 실제 화면 증거를 함께 보고 `DESIGN.md`에 `확인됨`과 `추정`을 분리해 남긴다.

같은 이름의 Claude skill(`.claude/skills/design-system/SKILL.md`)과 문구가 동일할 필요는 없지만, 아래 표준 섹션과 필드 의미는 같아야 한다.

## 트리거

- "DESIGN.md 생성", "디자인 시스템", "design system", "브랜드 규칙", "/design-system"

## DESIGN.md 표준 구조

Codex skill이 생성하는 `DESIGN.md`는 아래 9개 섹션을 기본 골격으로 사용한다.

| 섹션 | Codex가 적어야 할 내용 |
|------|------------------------|
| `## 브랜드 톤` | 제품의 분위기, 문장 톤, 사용자가 느껴야 할 인상을 1~3문장으로 정리한다 |
| `## 색상 토큰` | `primary`, `secondary`, `surface`, `text`, `muted`, `success`, `warning`, `danger`처럼 의미 이름을 붙인 색상과 용도를 적는다. raw hex 나열 금지 |
| `## 타이포그래피` | 폰트 패밀리, heading/body scale, weight 규칙, 줄간격 경향을 적는다 |
| `## spacing / radius / elevation` | 간격 단위, border radius 단계, shadow/elevation 사용 기준을 적는다 |
| `## 컴포넌트 원칙` | 버튼, 입력, 목록, 카드, 내비게이션처럼 반복 UI의 variant와 일관성 규칙을 적는다 |
| `## 상태 표현` | hover/focus/active/disabled 같은 interaction state와 empty/loading/error state 표현을 적는다 |
| `## 접근성 / 반응형` | 대비, focus visible, 터치 타깃, 모바일/데스크톱 breakpoint 기준을 적는다 |
| `## 금지 패턴` | 프로젝트에서 피해야 할 스타일 확장, 임의 색상, 과한 장식, 토큰 외 사용을 적는다 |
| `## 적용 범위` | 이 문서가 적용되는 앱, 페이지, 컴포넌트 범위를 적는다 |

**확인됨 / 추정 표기 규칙**: 값마다 붙인다.

```markdown
## 색상 토큰

- primary: `#2563eb` — 주요 실행 버튼과 활성 상태에 사용한다. (확인됨: `src/styles.css`)
- warning: `#f59e0b` — 알림성 강조에만 제한적으로 사용한다. (추정: dashboard screenshot)
```

- 확인한 값과 추정한 값을 한 bullet에서 섞어 단정하지 않는다.
- 근거가 없으면 "확인됨"이라고 쓰지 않는다.

## 입력 수집 절차

아래 순서로 단서를 수집한다.

1. `package.json` — UI 라이브러리(Tailwind, shadcn, etc.)와 의존성 확인
2. `tailwind.config.*` 또는 전역 CSS custom property — 색상/폰트/spacing 토큰 추출
3. 주요 컴포넌트 파일 — 실제 사용 패턴과 variant 확인
4. 브랜드 문서 / README — 제품 톤 파악
5. 스크린샷 / 실행 화면 — 보조 증거. 코드 단서와 충돌하면 충돌을 기록한다

`rg`/파일 읽기로 색상, 폰트, spacing, radius, icon library 단서를 수집한다.
사용자가 승인한 사실과 추정한 스타일을 분리해 적는다.

## 출력 위치와 예외 처리

기본 위치: 대상 프로젝트 root `DESIGN.md`

root write 제한 프로젝트(예: monitor-page)는 해당 프로젝트 AGENTS/CLAUDE 정책의 worktree/승인 절차를 먼저 통과한다.

## 완료 체크리스트

생성 후 9개 섹션이 모두 채워졌는지 확인한다:

- [ ] `## 브랜드 톤` 존재
- [ ] `## 색상 토큰` 존재 (의미 토큰 기반)
- [ ] `## 타이포그래피` 존재
- [ ] `## spacing / radius / elevation` 존재
- [ ] `## 컴포넌트 원칙` 존재
- [ ] `## 상태 표현` 존재
- [ ] `## 접근성 / 반응형` 존재
- [ ] `## 금지 패턴` 존재
- [ ] `## 적용 범위` 존재
- [ ] 확인됨/추정 표기가 적어도 색상 토큰에 적용됨
- [ ] `design-prompt`가 참조할 수 있는 토큰/컴포넌트 항목명이 고정됨

## sample output (dry-run 예시)

아래는 최소 입력으로 만든 `DESIGN.md` outline 예시다.

```markdown
# DESIGN.md — activity-hub

## 브랜드 톤

차분하고 신뢰감 있는 업무 도구. 사용자가 느껴야 할 인상은 "정돈된 효율성"이다.

## 색상 토큰

- primary: `#2563eb` — 주요 실행 버튼, 활성 링크. (확인됨: `src/app.css`)
- surface: `#f8fafc` — 카드/패널 배경. (추정: 스크린샷 기반)
- text: `#1e293b` — 본문 텍스트. (확인됨: `tailwind.config.ts`)
- muted: `#64748b` — 보조 레이블, placeholder. (확인됨: `tailwind.config.ts`)
- danger: `#ef4444` — 에러 메시지, 삭제 액션. (확인됨: `src/components/Alert.svelte`)

## 타이포그래피

- 폰트: Inter (sans-serif). (확인됨: `app.html`)
- heading: 24px/700, 20px/600, 16px/600
- body: 14px/400, 줄간격 1.6

## spacing / radius / elevation

- spacing: 4px 단위 (4/8/12/16/24/32/48)
- radius: sm=4px, md=8px, lg=12px
- shadow: elevation-1: `0 1px 3px rgba(0,0,0,0.1)`

## 컴포넌트 원칙

- 버튼: primary/secondary/ghost 3종. 크기: sm/md/lg.
- 입력: border+focus ring. disabled 시 opacity-50.
- 카드: white background, elevation-1, radius-md.

## 상태 표현

- hover: primary 색상 10% darken
- focus: 2px ring primary
- disabled: opacity-50, pointer-events-none
- empty: 중앙 정렬 안내 메시지 + 아이콘
- loading: spinner 또는 skeleton

## 접근성 / 반응형

- 최소 대비비: 4.5:1 (WCAG AA)
- focus-visible: 항상 표시
- 터치 타깃: 44px 이상
- breakpoint: mobile<768px, tablet<1024px, desktop≥1024px

## 금지 패턴

- 토큰 외 색상 직접 사용 금지 (`color: #abc123` 형태)
- 임의 그라데이션 금지
- z-index 100 이상 임의 사용 금지

## 적용 범위

activity-hub SvelteKit 앱 전체 (`src/` 하위 모든 .svelte, .css 파일)
```
