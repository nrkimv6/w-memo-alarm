---
name: design-system
description: "프로젝트 DESIGN.md(디자인 시스템 계약) 생성. Use when: DESIGN.md 생성, 디자인 시스템, design system, 브랜드 규칙"
---

# 디자인 시스템 문서 생성

프로젝트별 `DESIGN.md`(AI가 매번 읽는 단일 디자인 계약)를 생성한다.
이 skill은 production UI 코드를 바로 만드는 도구가 아니라, 이후 `design-prompt`와 UI 구현이 참조할 디자인 시스템 계약을 만드는 도구다.

Stitch/Figma/스크린샷은 **참고 입력**일 뿐이며 최종 계약은 `DESIGN.md`다. production UI 코드의 source of truth로 승격하지 않는다.

Codex `.agents` 버전의 복사가 아니라, 아래 명세된 동일 schema를 Claude 실행 방식(Read/Glob/Grep/Write, 선택적 Playwright MCP)으로 구현한다.

## 트리거

- "DESIGN.md 생성", "디자인 시스템", "design system", "브랜드 규칙", "/design-system"

## DESIGN.md 표준 구조 (공유 계약)

이 섹션 이름과 의미는 `.agents/skills/design-system/SKILL.md`(Codex)와 **공유하는 공통 정책**이다.
문체/실행 절차는 surface별로 다르게 써도 되지만, 섹션 이름과 필드 의미는 동일해야 한다.

| 섹션 | 내용 | 필드 예시 |
|------|------|----------|
| `## 브랜드 톤` | 제품 성격/보이스 1~3줄 | "차분하고 신뢰감 있는", "장난기 있는 캐주얼" |
| `## 색상 토큰` | 의미 기반 색상 (raw hex 나열 아님) | `primary`, `secondary`, `surface/background`, `text/muted`, `success/warning/danger` 각각 hex + 용도 |
| `## 타이포그래피` | 폰트 패밀리, 스케일, 웨이트 | heading/body 폰트, size scale, weight 규칙 |
| `## spacing / radius / elevation` | 간격·모서리·그림자 토큰 | spacing scale(4/8/12...), radius(sm/md/lg), shadow 단계 |
| `## 컴포넌트 원칙` | 버튼/입력/카드 등 공통 규칙 | 변형(variant) 종류, 크기 규칙, 일관성 규칙 |
| `## 상태 표현` | interaction + 데이터 상태 | hover/focus/active/disabled, empty/loading/error |
| `## 접근성 / 반응형` | 대비·포커스·타깃 크기·breakpoint | 최소 대비비, focus visible, 모바일 우선 breakpoint |
| `## 금지 패턴` | 하지 말아야 할 것 | "임의 그라데이션 금지", "토큰 외 색상 직접 사용 금지" 등 |
| `## 적용 범위` | 이 DESIGN.md가 적용되는 surface | 어떤 앱/페이지/프로젝트 |

**확인됨 / 추정 분리 규칙**: 코드에서 실제로 확인한 값은 `(확인됨)`, 단서로 추론한 값은 `(추정)`으로 각 항목 끝에 표시한다. 둘을 섞어 단정하지 않는다.

`design-prompt`와 UI 구현 checklist가 참조할 수 있도록 **토큰/컴포넌트 항목명을 고정**한다.

## 실행 단계

### 1단계: 입력 수집

Read/Glob/Grep 도구로 아래 순서대로 단서를 수집한다.

1. `Read package.json` — UI 라이브러리(Tailwind, shadcn 등) 확인
2. `Read tailwind.config.*` — 색상/폰트/spacing 토큰
3. `Glob src/**/*.css` + `Read` — 전역 CSS custom property
4. `Grep` 컴포넌트 파일에서 실제 색상/폰트/radius/icon 사용 패턴
5. README/브랜드 문서 — 제품 톤 파악
6. 실행 중인 UI가 있으면 Playwright MCP screenshot으로 실제 화면 톤을 **보조 확인** (선택) — 단 source of truth는 코드 단서다

추출 단서는 `(확인됨)`, 비어 있어 추론한 값은 `(추정)`으로 분리해 채운다.

### 2단계: DESIGN.md 작성

위 표준 구조 9개 섹션을 모두 채운다. `Write {프로젝트 root}/DESIGN.md`로 저장한다.

root write 제한 프로젝트(예: monitor-page)는 해당 프로젝트 정책의 worktree/승인 절차를 선행한다.

### 3단계: 완료 체크리스트

- [ ] `## 브랜드 톤` 존재
- [ ] `## 색상 토큰` 존재 (의미 토큰 기반)
- [ ] `## 타이포그래피` 존재
- [ ] `## spacing / radius / elevation` 존재
- [ ] `## 컴포넌트 원칙` 존재
- [ ] `## 상태 표현` 존재
- [ ] `## 접근성 / 반응형` 존재
- [ ] `## 금지 패턴` 존재
- [ ] `## 적용 범위` 존재
- [ ] `(확인됨)`/`(추정)` 표시가 적어도 색상 토큰에 적용됨
- [ ] `design-prompt`가 참조할 수 있는 토큰/컴포넌트 항목명 고정

## sample DESIGN.md outline

```markdown
# DESIGN.md — activity-hub

## 브랜드 톤

차분하고 신뢰감 있는 업무 도구. "정돈된 효율성"이 사용자가 느껴야 할 인상이다.

## 색상 토큰

- primary: `#2563eb` — 주요 실행 버튼, 활성 링크. (확인됨: `src/app.css`)
- surface: `#f8fafc` — 카드/패널 배경. (추정: 스크린샷 기반)
- text: `#1e293b` — 본문 텍스트. (확인됨: `tailwind.config.ts`)
- muted: `#64748b` — 보조 레이블. (확인됨: `tailwind.config.ts`)
- danger: `#ef4444` — 에러 메시지, 삭제 액션. (확인됨: `src/components/Alert.svelte`)

## 타이포그래피

- 폰트: Inter (확인됨: `app.html`)
- heading: 24px/700, 20px/600, 16px/600
- body: 14px/400, 줄간격 1.6

## spacing / radius / elevation

- spacing: 4px 단위 (4/8/12/16/24/32/48)
- radius: sm=4px, md=8px, lg=12px
- shadow: `0 1px 3px rgba(0,0,0,0.1)`

## 컴포넌트 원칙

- 버튼: primary/secondary/ghost. 크기: sm/md/lg.
- 카드: white background, elevation-1, radius-md.

## 상태 표현

- hover: primary 10% darken. focus: 2px ring. disabled: opacity-50.
- empty: 안내 메시지 + 아이콘. loading: skeleton.

## 접근성 / 반응형

- 대비비 4.5:1 (WCAG AA). focus-visible 항상 표시. 터치 타깃 44px+.
- breakpoint: mobile<768px, desktop≥1024px.

## 금지 패턴

- 토큰 외 색상 직접 사용 금지. 임의 그라데이션 금지.

## 적용 범위

activity-hub SvelteKit 앱 전체 (src/ 하위 모든 .svelte, .css)
```
