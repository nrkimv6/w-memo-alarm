---
description: "프로젝트별 DESIGN.md(디자인 시스템 계약) 생성. Use when: DESIGN.md 생성, 디자인 시스템, design system, 브랜드 규칙"
---

# DESIGN.md 생성

대상 프로젝트의 UI 단서를 읽고 프로젝트 root `DESIGN.md`를 생성한다.
이 workflow는 디자인 코드를 바로 생성하는 도구가 아니라, 이후 `design-prompt`와 UI 구현이 참조할 디자인 시스템 계약을 만드는 도구다.

Stitch/Figma/스크린샷은 참고 입력이다. 최종 판단은 기존 코드, CSS 변수, 컴포넌트 사용, 실제 화면 증거를 함께 보고 `확인됨`과 `추정`을 분리해 남긴다.

## DESIGN.md 표준 구조

| 섹션 | 내용 |
|------|------|
| `## 브랜드 톤` | 제품 분위기, 문장 톤, 사용자가 느껴야 할 인상 1~3문장 |
| `## 색상 토큰` | `primary`, `secondary`, `surface`, `text`, `muted`, `success`, `warning`, `danger`처럼 의미 이름 기반. raw hex 나열 금지 |
| `## 타이포그래피` | 폰트 패밀리, heading/body scale, weight 규칙 |
| `## spacing / radius / elevation` | 간격 단위, border radius 단계, shadow 기준 |
| `## 컴포넌트 원칙` | 버튼/입력/목록/카드/내비게이션 variant와 일관성 규칙 |
| `## 상태 표현` | hover/focus/active/disabled, empty/loading/error |
| `## 접근성 / 반응형` | 대비, focus visible, 터치 타깃, breakpoint |
| `## 금지 패턴` | 피해야 할 스타일, 임의 색상, 토큰 외 사용 |
| `## 적용 범위` | 이 문서가 적용되는 앱/페이지/컴포넌트 |

## 확인됨 / 추정 표기

- 코드에서 실제 확인: `(확인됨: path 또는 근거)`
- 단서로 추론한 값: `(추정: 근거)`
- 두 값을 한 항목에서 섞어 단정하지 않는다

## 입력 수집 절차

1. `package.json` — UI 라이브러리 확인
2. `tailwind.config.*` / 전역 CSS — 색상/폰트/spacing 토큰
3. 주요 컴포넌트 파일 — 실제 사용 패턴
4. 브랜드 문서 / README — 제품 톤 파악
5. Stitch/Figma/스크린샷 — 보조 증거 (코드 단서와 충돌하면 충돌 기록)

## 출력 위치

기본: 대상 프로젝트 root `DESIGN.md`

root write 제한 프로젝트는 해당 프로젝트 AGENTS/CLAUDE 정책의 worktree/승인 절차를 선행한다.

## 완료 체크리스트

생성 후 9개 섹션이 모두 채워졌는지 확인한다:
브랜드 톤 / 색상 토큰 / 타이포그래피 / spacing·radius·elevation / 컴포넌트 원칙 / 상태 표현 / 접근성·반응형 / 금지 패턴 / 적용 범위
