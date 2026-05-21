---
name: expand-todo
description: "계획 문서의 TODO 체크리스트를 2단계 원자 작업으로 확장. Use when: 확장, expand, 체크리스트 확장, todo 확장, 구체화"
---


<!-- script-contract-invariant -->
## Script Contract Invariant

Phase insertion triggers must be treated as advisory evidence first. Use `common\tools\plan-advisory-detect.ps1 -PlanFile <plan> -Json` to collect candidate evidence, then let the skill decide whether a deterministic checklist mutation is warranted. Keyword-only matches are not sufficient grounds for automatic mutation.
# TODO 체크리스트 2단계 확장

기존 계획 문서의 빈약한 체크리스트를 **2레벨 원자 작업**으로 확장합니다.
코드베이스를 분석하여 각 작업에 대상 파일, 함수 시그니처, 구체적 변경 내용을 포함합니다.

## 트리거

- "확장", "expand", "체크리스트 확장", "todo 확장", "구체화"
- 계획 문서의 체크리스트가 빈약할 때

## 입력

사용자가 다음 중 하나를 제공:
- 계획 문서 경로 (예: `docs/plan/2026-02-23-feature.md`)
- 계획 문서 이름 또는 키워드 (검색으로 찾기)
- IDE에서 열려있는 plan 파일 (system-reminder로 감지)

## 출력 commit 계약

- 확장 시작 시 docs commit root에서 `common/tools/docs-dirty-guard.ps1 -Mode Begin -RepoRoot <docs-commit-root>`를 호출한다. PowerShell을 사용할 수 없는 shell surface는 `common/tools/docs-dirty-guard.sh --mode begin --repo-root <docs-commit-root>`를 사용한다.
- plan 체크리스트를 수정하면 해당 plan exact path를 touched set에 추가하고, 수정 직후 `Commit`에 touched exact path만 전달한다.
- 변경 발생 시 guard `Commit` summary의 commit hash를 출력에 포함한다. PowerShell canonical은 `D:\work\project\tools\common\commit.ps1 -Files`를 경유한다.
- 변경이 없으면 guard `Commit status=no-op` 또는 `End status=ok` 결과를 포함한다.
- 최종 응답 직전 `End`를 호출한다. commit hash, `no-op`, 또는 `End status=ok` 결과를 출력하지 못하면 성공 종료하지 않는다.
- shared docs guard mode references는 `Begin`, `Commit`, `End`만 canonical이다. 출력과 evidence에서는 `docs-dirty-guard: mode=Begin`, `docs-dirty-guard: mode=Commit`, `docs-dirty-guard: mode=End` spelling을 유지한다.

### PowerShell helper 인자 예시

- `commit.ps1 -Files`는 `-Files file1 file2` 또는 `-Files file1,file2` 형식을 사용한다.
- `commit.ps1 -Files`에 PowerShell 배열 리터럴이나 쉼표 토큰을 pathspec 하나처럼 넘기지 않는다.
- `docs-dirty-guard.ps1` 직접 호출의 typed array 인자는 `-TouchedFiles 'docs/plan/a.md','TODO.md'` 형식을 사용한다.
- `powershell.exe -File`이나 argument array로 `docs-dirty-guard.ps1`를 호출할 때는 `-TouchedFiles 'docs/plan/a.md,TODO.md'`처럼 하나의 comma-delimited token을 넘긴다.
- 금지: `-TouchedFiles 'docs/plan/a.md' 'TODO.md'` 형태. 두 번째 값이 unbound positional argument가 되므로 guard가 실패해야 한다.

## 실행 단계

### 1단계: 계획 문서 읽기

1. 대상 plan 파일을 Read로 읽는다
2. 기존 체크리스트 구조를 파악한다
3. 각 Phase와 작업 항목을 식별한다

### 2단계: 코드베이스 분석

**각 체크리스트 항목에 대해:**

1. 대상 파일의 **실제 코드**를 Read로 읽는다
2. 수정 대상 함수/클래스의 현재 구현을 확인한다
3. 기존 패턴, 임포트, 의존성을 파악한다
4. 프론트엔드 ↔ 백엔드 연동 시 양쪽 코드 모두 확인

**헤더 주장 신뢰 금지**: plan 헤더나 메모의 `✅ 반영 완료`, `이미 반영됨`, `선반영 완료` 같은 주장은 실제 파일 상태가 아니다. 해당 문구가 있어도 Read/Grep으로 대상 파일을 직접 확인하기 전까지 반영·검증 완료로 판단하지 않는다.

**병렬 조사**: 독립적인 파일들은 Task(Explore) 에이전트로 병렬 조사하여 속도를 높인다.

### 2.3단계: 파일 이동/구조변경 영향 분석

plan/TODO에 **파일 이동·삭제·이름변경·경로변경** 작업이 포함될 가능성이 있으면 advisory evidence를 먼저 수집한다. 키워드 단독으로 Phase IA를 자동 삽입하지 않는다.

**트리거 키워드 감지** (plan 제목, 개요, TODO 텍스트에서):
- 이동: `mv`, `Move-Item`, `git mv`, "이동", "옮기기", "재구성", "reorganize"
- 이름변경: `rename`, `Rename-Item`, "이름 변경", "리네이밍"
- 삭제: `rm`, `Remove-Item`, "삭제", "제거"
- 경로변경: "경로 변경", "디렉토리 구조 변경"

**삽입 조건**: 키워드는 advisory trigger일 뿐이다. 아래 3가지가 모두 충족될 때만 구현 Phase 직후·테스트 Phase 직전에 Phase IA를 삽입한다.
1. 이동/삭제/이름변경 대상 파일 또는 경로가 구조적으로 특정된다.
2. Grep/read 결과 import, source, 설정, 실행 참조 같은 structural evidence가 있다.
3. AI가 실제 참조처 영향 분석이 필요하다고 확인한다.

조건을 만족하면 아래 Phase를 삽입:

```
### Phase IA: 이동 영향 분석 및 참조처 수정

N. ☐ **이동 대상의 기존 경로를 프로젝트 전체에서 Grep 검색**
   - ☐ import/require/source/dot-source 참조 검색
   - ☐ 설정 파일(CLAUDE.md, README, INDEX.md, CI yaml 등) 하드코딩 경로 검색
   - ☐ 프로세스 실행 참조(Start-Process, subprocess.run, NSSM 서비스 경로 등) 검색

N+1. ☐ **상대경로 깊이 탐지 패턴 검증**
   - ☐ 이동 대상 파일 내 `$PSScriptRoot`, `Split-Path`, `__file__`, `Path().parent` 패턴 검색
   - ☐ 디렉토리 깊이 변경 시 상대경로 단계 수 일치 여부 검증
   - ☐ 불일치 파일 목록 + 수정 방법 기록

N+2. ☐ **참조처 일괄 수정**
   - ☐ 이전 경로를 새 경로로 일괄 교체
   - ☐ 상대경로 깊이 불일치 파일 수정
   - ☐ 수정 후 전체 참조 재검색으로 잔존 참조 0건 확인
```

**Phase IA 미삽입 시**: 키워드만 있고 structural evidence 또는 AI confirmation이 없으면 삽입하지 않는다. 필요하면 기술적 고려사항에 advisory evidence만 기록한다.

**검색 예시**:
- PowerShell 이동: `Grep "old/path" --glob "*.ps1"`, `Grep "Split-Path" {이동된 파일}`
- Python 이동: `Grep "from old.module import" --glob "*.py"`, `Grep "Path\(__file__\)" {이동된 파일}`

### 2.4단계: DB 마이그레이션 감지

plan/TODO에 **DB 스키마 변경(마이그레이션)** 작업이 포함될 가능성이 있으면 advisory evidence를 먼저 수집한다. 키워드 단독으로 "직접 실행" 체크박스를 포함하는 Phase DB-Direct를 자동 삽입하지 않는다.

**트리거 키워드 감지** (plan 제목, 개요, TODO 텍스트에서 1개 이상 감지 시 활성화):

| 분류 | 키워드 |
|------|--------|
| SQL DDL | `ALTER TABLE`, `ADD COLUMN`, `DROP COLUMN`, `RENAME COLUMN` |
| 코드 패턴 | `_add_col(`, `migrate_`, `migration`, `마이그레이션` |
| 파일/경로 | `database.py` 수정, `migrations/` 수정, `migrate_sqlite_to_pg`, `.sql` 파일 신규 생성 |
| 삭제+DB | 파일 삭제 키워드 AND 위 키워드 동시 감지 (삭제 파일 내 마이그레이션 코드 이전 여부 강제 확인) |

> **`CREATE TABLE` 단독은 트리거에서 제외**: SQLAlchemy `Base.metadata.create_all()`이 자동 생성하므로 오탐 위험. `CREATE TABLE`은 `_add_col` 또는 `ALTER TABLE`과 함께 등장하는 경우에만 감지.

**삽입 조건**: 키워드는 advisory trigger일 뿐이다. 아래 3가지가 모두 충족될 때만 구현 Phase 마지막 항목 직후·T1 Phase 직전에 Phase DB-Direct를 삽입한다.
1. 실제 SQL/DDL, migration file, `_add_col`, schema 초기화 코드 같은 structural evidence가 있다.
2. worktree 구현과 main merge 후 running DB 반영이 분리되는 변경이다.
3. AI가 DB-direct evidence 3종이 필요한 mutation-ready 후보라고 확인한다.

조건을 만족하면 아래 Phase를 삽입 (Phase IA와 동일 위치):

```
### Phase DB-Direct: DB 스키마 직접 수행 (마이그레이션 필수)

N. - [ ] **마이그레이션 코드 추가 (DB 모듈 또는 마이그레이션 스크립트)** — worktree/impl 단계에서 수행
   - [ ] 프로젝트의 DB 초기화 모듈에 `_add_col` / SQL DDL 추가 — 앱 재시작 시 자동 마이그레이션
   - [ ] 신규 컬럼이 있으면 `ADD COLUMN IF NOT EXISTS` 패턴 사용

N+1. - [ ] **DB에 직접 실행 (running DB 즉시 반영)** — ⚠️ 실행 시점: main 머지 후, T4/T5 직전
   - [ ] 실행 중인 DB에 `ALTER TABLE {테이블} ADD COLUMN IF NOT EXISTS {컬럼} {타입} DEFAULT {값}` 직접 실행
   - [ ] 실행 확인: `SELECT column_name FROM information_schema.columns WHERE table_name='{테이블}'`로 컬럼 존재 검증

N+2. - [ ] **스키마 드리프트 검증** — N+1 직후 실행
   - [ ] `routes/`, `services/` 등에서 수정된 테이블을 SELECT하는 쿼리 Grep 검색
   - [ ] 쿼리에서 참조하는 컬럼이 실제 DB 스키마에 모두 존재하는지 대조 확인

⚠️ N+1·N+2는 main 머지 후에 실행해야 한다 (worktree 코드는 running 서버에 반영되지 않으므로). Pipeline 순서: impl(N) → /merge-test(머지) → N+1·N+2 → T4/T5.
```

**삭제+DB 복합 감지**: 파일 삭제 키워드(2.3단계 트리거)와 DB 키워드가 동시에 감지되면, N+2(스키마 드리프트 검증)에 추가 체크박스를 삽입:
- `- [ ] 삭제된 파일에 ALTER TABLE/ADD COLUMN이 있었다면, 해당 코드를 DB 초기화 모듈의 _add_col 호출로 이전 완료 확인`

**중복 삽입 방지**: plan에 이미 `### Phase DB-Direct` 헤더 또는 "직접 실행" + "ALTER TABLE" 체크박스가 존재하면 삽입을 스킵한다.

**Phase DB-Direct 미삽입 시**: 키워드만 있고 DB structural evidence 또는 AI confirmation이 없으면 삽입하지 않는다. advisory evidence만 기록한다.

### 2.5단계: main 드리프트 점검 (게이트 적용 항목)

이 단계는 전파 게이트 판정이 `필수`이거나 `선택(적용)`으로 결정된 경우에만 적용한다.

1. **입력 기준 고정**
   - plan 헤더에서 `> 기준커밋:` 값을 읽는다.
   - `기준커밋`이 없으면 `> 작성일시:`를 읽고 `git log --since` fallback을 사용한다.
   - 둘 다 없으면 보수적 fallback을 적용한다:
     - 최근 main 변경을 탐색하고
     - `영향 없음` 근거를 명시적으로 기록한다.

2. **archive 맥락 분석 (의도 해석 전용)**
   - plan 제목/주제 키워드로 `.worktrees/plans/docs/archive/`, `common/docs/history/`에서 후보 문서를 찾는다.
   - 후보 문서의 `반영일시`, `머지커밋`, 변경 배경을 읽어 의도/원인을 파악한다.
   - archive는 판정 보조 입력이며, 최종 반영 여부는 git 근거로 확정한다.

3. **git 범위 검증 (최종 판정)**
   - 기본: `git diff --name-only {기준커밋}..main`
   - fallback: `git log --name-only --since="{작성일시}" main`
   - 추출된 변경 파일을 `rg` 키워드 검색 결과와 교차 검증한다.

4. **백업 diff 필수 확인**
   - 교집합이 없어도 수정 대상 파일별 `git diff`를 확인한다.
   - 출력 포맷:
     - `파일 | 판정(변경 있음/없음) | 근거(diff/log)`

5. **strict 모드 조건**
   - 아래 중 하나면 strict 모드로 승격한다:
     - fix plan
     - 공통 모듈/API/DB 경로 수정
     - 대규모 변경(파일 수 또는 영향 범위가 넓음)
   - strict 모드에서는 `전수 검색(rg) -> 선별 Read` 순서를 강제한다.

6. **출력 계약**
   - 드리프트 결과는 `추가 TODO` 또는 `기술적 고려사항`에만 반영한다.
   - `영향 없음` 판단 시 근거(검사 범위, diff/log 결과)를 함께 기록한다.
   - 분기 규칙:
     - `archive-only`: 문서 stale 후보로 기록
     - `git-only`: 누락 고위험 후보로 기록

세부 판정표는 필요 시 `references/main-drift-gate.md`를 참조한다.

### 3단계: 2레벨 구조로 확장

기존 체크리스트를 아래 구조로 변환한다:

> **출력 형식은 반드시 `- [ ]` 마크다운 체크박스**를 사용한다. (`☐` 유니코드 금지 — `/done` 스킬 파싱 호환)

```markdown
### Phase N: {Phase 이름}

1. - [ ] **{상위 작업}** — 개념적 단위
   - [ ] `{파일경로}`: {구체적 변경 1}
   - [ ] `{파일경로}`: {구체적 변경 2}

2. - [ ] **{상위 작업}** — 개념적 단위
   - [ ] `{파일경로}`: {구체적 변경}
```

### 확장 규칙

#### 레벨 구분

| 레벨 | 용도 | 예시 |
|------|------|------|
| **상위** (번호) | 기능/개념 단위 | "Redis 로그 헬퍼 추가", "API 엔드포인트 수정" |
| **하위** (대시) | 초보 할당 가능한 원자 작업 | "`plan_service.py:L5`: `import redis` 추가" |

#### 하위 작업 필수 요소

1. **파일 경로**: 어느 파일인지 명확히
2. **한 줄 한 동작**: "추가", "수정", "삭제" 중 하나만
3. **구체적 내용**: "버튼 추가" ✗ → "`LoginForm.svelte`: Submit 버튼에 `disabled={!valid}` 속성 추가" ✓
4. **함수 수준 명세** (새 함수 작성 시): `함수명(파라미터) → 반환값` + 핵심 로직 1줄
5. **기존 함수 수정 시**: 함수명 + 변경할 부분 + before/after 요약

#### 복잡도별 분해 깊이

| 복잡도 | 기준 | 분해 수준 |
|--------|------|----------|
| **낮음** | 설정 변경, 값 추가 | 파일 + 위치 |
| **중간** | 새 함수 작성, 로직 추가 | 함수 시그니처 + 동작 |
| **높음** | 여러 함수 연동 | 함수별 각각 + 연결 순서 |

#### 분해 판단 기준

상위 작업을 하위로 분해해야 하는 경우:
- 파일을 2개 이상 수정
- "~하고 ~한다"처럼 AND로 연결된 작업
- 중간 검증이 필요한 경우

#### lifecycle phase 확장 규칙

- `Phase 0: Worktree 준비`, `Phase Z: Post-Merge Cleanup (/merge-test owner)`가 이미 있으면, 이 phase는 새 scope를 발명하지 말고 **owner step을 더 잘게 쪼개는 용도**로만 확장한다.
- `Phase 0`은 보통 `worktree 생성 또는 재개`, `> branch:`/`> worktree:`/`> worktree-owner:` 기록 확인, `worktree cwd 고정`처럼 한 줄 한 동작으로 분해한다.
  - `> worktree-owner:` 검증 시 단일 경로뿐 아니라 쉼표 구분 경로 목록도 유효한 형식이다 (포함 여부 기준, "정확히 일치" 기준 아님). attach 모드에서는 첫 항목=primary, 나머지=attached.
- `Phase Z`는 보통 `main merge 시도`, `root dirty stash/apply (if needed)`, `T4/T5`, `worktree remove`, `branch remove`, `header meta 제거`처럼 owner step 단위로 분해한다.
- `merge resolve`, `stash pop`, `stash-pop resolve`는 충돌/복원 실패 시의 예외 경로이므로 **새 체크박스로 발명하지 않는다**. 필요하면 blockquote 메모나 주석으로만 남긴다.
- `Phase R`은 재발 경로 분석, `Phase Z`는 post-merge owner cleanup이므로 둘을 합치거나 서로의 하위 항목을 끌어오지 않는다.

#### 승격 규칙

하나의 상위 작업에 하위가 5개 이상이면 별도 Phase로 승격 검토

#### 🔴 fix: plan evidence 확인 시 — 재발 경로 분석 Phase 추가

아래 structured marker는 fix 후보 evidence다. 코드블럭, archive 인용, 예시 문구 안의 `fix:`는 후보에서 제외한다.
- 파일명에 `_fix-` 포함 (예: `2026-03-26_fix-visible-runner.md`)
- 헤더 제목(`# ...`)이 `fix:` 또는 `fix-`로 시작
- 헤더에 `> 유형: fix` 필드가 있음

삽입 조건: structured marker와 본문 목적이 결함 수정에 해당한다고 AI가 확인하면, **T2 직후 T3 직전에** "Phase R: 재발 경로 분석" Phase를 삽입한다:

**Phase R 템플릿** (코드블럭 내 체크박스는 ☐ 유니코드 사용):

```
### Phase R: 재발 경로 분석 (fix: plan 필수)

N. ☐ **수정 대상의 모든 호출/참조 경로 열거**
   - ☐ Grep으로 수정한 함수/변수/Redis키를 참조하는 모든 파일 검색
   - ☐ 각 호출 경로별 "이 경로에서 동일 버그가 발생할 수 있는가?" 판정
   - ☐ 방어됨/미방어 증명을 표로 작성 (경로 | 방어여부 | 근거)

N+1. ☐ **미방어 경로 수정**
   - ☐ 미방어 경로가 있으면 해당 경로에 방어 코드 추가
   - ☐ 모든 경로 방어 완료 확인 ("전체 방어 완료" 명시, "근본 수정" 표현 금지)

🔴 fix: plan인데 Phase R이 없으면 /implement, /done, /merge-test에서 차단된다.
```

**Phase R 삽입 후 검증 (필수):**

Phase R 삽입 후, 확장 완료 전에 반드시 재확인한다:
1. plan 본문에서 `### Phase R` 또는 `재발 경로 분석` 문자열을 검색
2. 미존재 시: 경고 출력 + Phase R 템플릿 재삽입 (1회)
3. 재삽입 후에도 미존재 시: `⚠️ Phase R 삽입 실패. 수동으로 추가하세요.` 출력 후 진행 중단

#### 🔴 백엔드/Python 항목 확장 시 — 필수 5-Phase 테스트 구조

Python/백엔드를 수정하는 plan 확장 시, 구현 Phase 뒤에 반드시 **5개 테스트 Phase**를 체크박스로 생성한다.
각 TC는 **개별 체크박스**로 나열 — 묶어서 하나로 쓰기 금지.

**Phase T1: TC 작성 (RIGHT-BICEP + CORRECT)**

수정/신규 함수마다 아래 카테고리로 TC를 개별 체크박스로 나열:
- **R(Right)**: 정상 입력 → 기대 출력 — **항상 필수**
- **B(Boundary)**: 빈값, 0, 최대값, off-by-one — **항상 필수**
- **E(Error)**: 예외, 잘못된 입력 — **항상 필수**
- I(Inverse), C(Cross-check), P(Performance): 해당 시만
- CORRECT — Co(Conformance), O(Ordering), R(Range), Re(Reference), E(Existence), Ca(Cardinality), T(Time): 해당 시만

형식: `- [ ] \`test_{함수명}_{카테고리}_{설명}()\` — {카테고리}: {검증 내용}`

**Phase T2: TC 검증 및 수정**
- 테스트 파일별 실행 + passed 확인 체크박스
- 실패 TC 수정 체크박스
- 기존 테스트 회귀 확인 체크박스

**Phase T3: 재현/통합 TC**
- mock 최소화, 실제 의존성(git, 파일시스템, 환경변수 등) 사용
- **fix: plan이면 필수** — 근본 원인을 실제 환경에서 재현하는 TC 1개 이상 + 수정 후 통과 검증
- mock은 **외부 API만** 허용. 로컬 의존성은 **실물 사용**
- `/implement`에서 T2 직후 실행 (서버 불필요, 워크트리에서 실행 가능)
- **Phase 헤더 유지** — 해당 없으면 **블록쿼트로 사유만 기재** (`> T3 해당 없음: {사유}`), **체크박스 생성 금지**

**Phase T4: E2E 테스트 수행 및 수정**
- **포함 여부 결정 전 필수**: Glob으로 `tests/**/*e2e*`, `tests/**/*integration*` 탐색 → 1개라도 있으면 포함
- 탐색 결과 파일 없음이 확인된 경우에만 해당 없음 처리 허용
- **T4 재분류 주의**: `tests/**/*e2e*` Glob으로 파일 발견 시, 해당 파일 내용을 Read하여 TestClient 기반 또는 mock 기반(AsyncMock/MagicMock/patch 다수 사용 + 실서버/Playwright 미사용) 여부를 확인한다. 해당하면 T3(integration)으로 재분류 필요 — 실서버/Playwright 없으면 T4가 아님
- 시나리오별 개별 체크박스
- **Phase 헤더 유지** — 해당 없으면 **블록쿼트로 사유만 기재** (`> T4 해당 없음: {사유}`), **체크박스 생성 금지**

**Phase T5: HTTP 통합 테스트**
- **포함 여부 결정 전 필수**: Glob으로 `tests/**/*http*`, `tests/**/*api*` 탐색 → **프로젝트 전체에서 1개라도 있으면 → 기능 전용 파일 유무와 무관하게 해당 변경에 대한 T5 TC를 신규 작성한다**
- HTTP 서버가 아닌 것이 코드로 확인된 경우에만 해당 없음 처리 허용
- `{METHOD} {endpoint}` 정상/에러 응답별 개별 체크박스
- **Phase 헤더 유지** — 해당 없으면 **블록쿼트로 사유만 기재** (`> T5 해당 없음: {사유}`), **체크박스 생성 금지**

**T3 금지 사유 (재현/통합 TC 스킵 불가):**
- "단위 테스트로 커버됨" — mock과 실물은 다르다
- "내부 함수만 수정" — 내부 함수가 외부 의존성을 쓰면 의미 없음
- "API 변경 없음" — T3는 API가 아니라 통합 동작 검증
- **스킵 허용**: 순수 문서/주석/타입 힌트/설정값 변경만

**T4/T5 금지 사유 (이런 이유로 스킵하면 안 됨):**
- "단위 테스트로 커버됨" — T4/T5는 단위 테스트와 검증 범위가 다름
- "수동 테스트" — T4/T5는 pytest로 자동 실행하는 테스트
- "실제 환경 필요" — 워크트리에서 못 돌리는 건 스킵 사유가 아님, `/merge-test`에서 실행
- **"CLI 도구라서", "라이브러리라서", "프레임워크 없어서"** — 인상 기반 판단 금지. 반드시 탐색으로 확인
- **"기존 테스트 없음", "전용 테스트 파일 없음"** — 기존 파일 부재는 신규 작성의 이유이지 스킵 사유가 아님. Glob 결과 프로젝트에 해당 유형 파일이 1개라도 있으면 반드시 신규 TC 작성
- explicit test file command를 TODO에 적기 전에는 대상 파일의 module-level `pytestmark`를 먼저 읽는다.
- `pytestmark = pytest.mark.http` 파일이면 plain `pytest {file} -v`를 쓰지 않고 `python -m pytest -o addopts="--capture=sys" {file} -v` 또는 broad `pytest -o addopts=--capture=sys -m http -v`로 쪼갠다.
- `pytestmark = pytest.mark.http_live` 파일이면 live readiness 전제와 함께 `python -m pytest -o addopts="--capture=sys" {file} -m http_live -v` 또는 broad `pytest -o addopts=--capture=sys -m http_live -v`를 적는다.
- 명시적 file-path인데 `0 selected`가 날 수 있는 plain 명령은 하위 체크박스로 출력하지 않는다.

**🔴 탐색 없이 스킵 결정 = 규칙 위반**: T4/T5 스킵 전 Glob 탐색을 반드시 실행하고 결과를 근거로 제시할 것

**참고 모범 사례**: `quota-stop_todo.md` Phase 4-6

### 3.5단계: 프로젝트 기반 분리 판단 (확장 후)

확장 완료 후, plan의 `> 대상 프로젝트:` 헤더를 확인한다.

**프로젝트가 2개+** (쉼표 구분) → **프로젝트별 `_todo-N.md` 강제 분리**:
1. 각 Phase가 어느 프로젝트의 코드를 수정하는지 파일 경로 기준으로 식별
2. child(다른 프로젝트에 의존하지 않는 쪽)에 낮은 N, parent(child를 import하는 쪽)에 높은 N 부여
3. plan 파일에서 체크박스 섹션을 제거, `> **실행 TODO:**` 링크 목록으로 교체 (Edit)
4. 프로젝트별 `_todo-N.md` 파일을 Write. 각 파일 헤더에:
   - `> 대상 프로젝트: {단일 프로젝트명}`
   - `> 실행순서: {N}`
   - `> 선행조건: {child _todo 상대경로 | 없음}` — parent가 child의 함수/모듈을 import하면 선행조건 기재
   - `> 테스트명령: {해당 프로젝트의 pytest 마커 | 기본값}`
5. T1~T5 테스트 Phase는 해당 프로젝트의 `_todo-N.md`에 포함

**프로젝트 1개** → 기존 규모 기반 분리 (31개+ AND 독립 Phase 묶음 2개+) 적용
**중첩 분리(`_todo-1a.md`)는 하지 않는다** — 단일 프로젝트당 하나의 `_todo-N.md` 유지

### 4단계: TC Phase 스킵 재검증 (Python 변경 시 필수)

기존 plan에 T3/T4/T5가 스킵으로 표기되어 있더라도, expand-todo는 **반드시 재검증**한다.
기존 plan의 스킵 판정을 그대로 수용하지 않는다.

1. Glob `tests/**/*e2e*`, `tests/**/*integration*` 실행 → 결과 기록
2. Glob `tests/**/*http*`, `tests/**/*api*` 실행 → 결과 기록
3. 1개라도 존재하면 해당 Phase를 **스킵→포함으로 변경**하고 TC 체크박스 작성
4. 기존 plan의 스킵 사유가 금지 사유(3단계 T3/T4/T5 금지 사유 목록)에 해당하는지 확인

🔴 **이 단계를 건너뛰면 규칙 위반.** 기존 plan의 `[x] 스킵` 체크박스는 재검증 대상이지 확정된 결과가 아니다.

### 5단계: plan 문서 업데이트

1. 기존 체크리스트 섹션을 확장된 2레벨 구조로 **Edit**으로 교체
2. Phase별 작업 수 요약 추가
3. Read로 반영 확인

### 5.3단계: surface isolation split 검증 (wtools authoring surface)

확장 완료 후 실행 체크박스 또는 파일 경로 헤더에 두 개 이상 engine authoring surface(`.agents/`, `.claude/`, `.gemini/`, `common/tools/plan-runner/gemini-agents/`)가 섞였는지 확인한다. surface split은 프로젝트 기반 분리보다 먼저 적용한다.

1. 경로 prefix로 surface를 분류한다. prefix가 없는 항목은 plan 헤더 `> surface 분류:`와 본문 근거를 보조 evidence로만 사용한다.
2. 두 개 이상 surface가 한 실행 체크박스 아래 섞이면 parent를 coordination-only로 남기고 surface별 child TODO로 분리한다. parent에는 `> **실행 TODO:**` 링크, owner/완료 gate, child 진행률 인덱스만 남긴다.
3. 이미 child가 생성되어 있으면 `split-applied`, 아직 분리 전이면 `split-required`로 기록한다. 둘 다 expand 실패가 아니다.
4. 분류가 모호하면 child를 만들지 않고 parent에 `> 수동 결정 대기: <YYYY-MM-DD>`와 모호한 체크박스 근거를 남긴다.
5. 각 child의 `> 대상 프로젝트:`, `> surface 분류:`, `> 선행조건:`은 단일 surface 기준으로 작성하고, 다른 engine surface 파일 경로를 하위 체크박스에 넣지 않는다.
6. 동일 문구를 `.agents`, `.claude`, Gemini surface에 강제 복사하지 않는다. 각 surface child는 자기 결과 구조와 실행 메커니즘에 맞게 의미를 표현한다.

`수동 결정 필요` 상태는 구현 진입을 막지 않지만 `/done`이 parent를 complete/archive 처리하면 안 된다.

### 5.6단계: plans-aware 커밋 (non-blocking)

plans 워크트리 문서를 수정한 경우에만, 확장 완료 후 아래 절차로 docs 변경을 정리한다.

1. `Resolve-DocsCommitRoot`로 docs commit root를 계산하고, 그 경로에서만 git 작업을 수행한다.
2. `Resolve-DocsCommitCandidates` 반환 파일만 `git add`한다. `git add -A`, `git add .`, 디렉토리 단위 add는 금지한다.
3. 화이트리스트는 docs commit root 기준 `docs/plan/*.md`, `docs/plan/*_todo-*.md`, `docs/archive/*.md`, `TODO.md`, `docs/DONE.md`로 제한한다.
4. 커밋은 `commit.ps1`로 수행하고, push는 literal branch명이 아니라 현재 docs commit root가 추적하는 upstream에만 `git push`한다.
5. raw Edit/헤드리스 경로에서 커밋 또는 push가 실패해도 block하지 않는다. 즉시 경고와 복구 명령만 남기고 다음 단계로 진행한다.

### 5.4단계: hedging 자기 검토 (필수)

plan 확장 후, 정합성 검증 직전에 **방금 LLM이 작성한 본문**의 자기 의심 톤을 점검한다.
패턴 매칭이 아닌 의도 기반 self-review. 상세 절차: [references/hedging-cleanup.md](references/hedging-cleanup.md).

핵심:
- 자기 의심을 남겼다면 검증으로 해소(사실로 교체) 또는 명시적 TODO 체크박스로 변환
- Phase R/검증 Phase의 본질적 재검증, 위험 마커, 메모리 규칙 인용은 보존
- 정리할 것이 없으면 통과

### 5.5단계: 정합성 검증 (필수)

plan 확장 후, 안내 출력 전에 **코드 대비 전수 검증**을 수행한다.
검증 체크리스트 reference가 존재하면 함께 맞춘다. 현재 공통 reference가 없으면 이 5.5단계가 evidence-required 계약의 단독 SSOT다.

**전체 검증 항목 (V1~V8, 최대 2라운드):**
1. **V1. 경로 존재 검증**: plan의 모든 파일 경로를 Glob/Read로 확인. plan 헤더의 `반영 완료` / `이미 반영됨` / `선반영 완료` 주장은 실제 파일 Read/Grep 확인 전까지 신뢰하지 않는다. 미존재 → 즉시 수정.
   - 출력 계약: 실행한 Glob/Read 명령, 발견 결과 발췌, plan 매칭 결과를 `| V | 명령/근거 | 발견 | 미커버 | 보정 |` 표에 인용한다.
2. **V2. 참조 전수 조사 + scope inventory**: 변경 대상 함수/변수/키를 Grep → plan 미커버 참조 발견 시 항목 추가.
   - 출력 계약: 실행한 Grep/rg 명령, 발견 결과 발췌, plan 매칭 결과를 표에 인용한다.
   - frontend plan(`.svelte`, `.tsx`, `.css` 포함)은 수정 대상 파일 scope에서 `rg -o "text-[a-z]+-[0-9]+|bg-[a-z]+-[0-9]+|border-[a-z]+-[0-9]+" <scope>` 또는 동등 Grep으로 색상 토큰을 전수 추출한다. 각 토큰을 plan 본문에서 검색하고 매칭 0건이면 미커버로 기록한다.
   - backend plan은 색상 토큰 대신 변경 대상 함수/클래스/설정 키/CLI 옵션 같은 심볼 inventory를 전수 추출해 동일하게 plan 본문 매칭을 확인한다.
3. **V3. 시그니처 정합성**: plan의 함수 파라미터/반환값을 실제 코드와 Read로 대조.
   - 출력 계약: Read 명령 또는 파일/라인 근거, 실제 시그니처 발췌, plan 매칭 결과를 표에 인용한다.
4. **V4. 설계 결함 탐색**: 동시성, 에러 경로, TTL, 원자성 관련 구조 검토.
   - 출력 계약: 탐색한 파일/심볼과 근거 라인, 발견한 위험 또는 없음 근거, plan 보정 여부를 표에 인용한다.
5. **V5. 테스트 패치 패턴**: 기존 테스트의 mock/patch 대상이 plan 변경과 정합하는지 Grep 확인.
   - 출력 계약: 테스트 검색 명령, mock/patch 발견 결과, plan 테스트 항목 매칭 결과를 표에 인용한다.
6. **V6. 문서 메타 정합성**: 번호 충돌, 중복, Phase 누락, 진행률 불일치 확인. surface split이 적용된 경우 parent가 coordination-only인지, `> **실행 TODO:**` 링크가 child 파일을 가리키는지, child별 `> surface 분류:`와 `> 선행조건:`이 단일 surface 기준인지, parent에 실행 체크박스가 재유입되지 않았는지 Read로 검증한다. `수동 결정 필요` 메모가 남아 있으면 parent complete/archive 금지 근거를 출력한다.
   - 출력 계약: 검사한 문서 범위, 발견한 메타 결과, 보정 여부를 표에 인용한다.
7. **V7. 검증 기준 정합성**: plan에 `## 검증 기준` 섹션이 있으면 각 bullet을 어느 Phase sub-item이 수행하는지 매핑한다. 섹션이 없으면 `해당 없음`을 표에 기록한다.
   - 출력 계약: `| 검증 기준 항목 | 매핑 sub-item | 상태(완전/부분/미커버) |` 표를 출력한다. 매핑 0건 또는 부분 매칭 항목은 RED로 분류하고 sub-item 추가 또는 검증 기준 문구 조정 중 하나를 즉시 수행한다.
8. **V8. 모호어 advisory**: TODO sub-item 본문에서만 `"기록한다"`, `"결정하고 적용한다"`, `"필요 여부를 확인"`, `"검토한다"`, `"고려한다"`, `"여부를 판단"`을 Grep한다.
   - 출력 계약: 발견 위치와 문구를 advisory 표에 출력한다. 차단하거나 자동 수정하지 않는다.

**검증 결과 표 템플릿(필수):**

| V | 명령/근거 | 발견 | 미커버 | 보정 |
|---|-----------|------|--------|------|
| V1 | `Glob/Read ...` | `{파일/라인 발췌}` | `{없음 또는 목록}` | `{없음 또는 수정 내용}` |

**evidence 인용 없는 V항목 = 미수행**이다. 텍스트 `통과`, `문제 없음`, `확인 완료`만 단독 출력하면 해당 V는 실행하지 않은 것으로 간주한다.

발견한 문제를 심각도별 분류:
- 🔴 **RED**: 구현 시 반드시 실패 → 즉시 수정
- 🟡 **YELLOW**: 설계 결함 가능성 → 기술적 고려사항에 기록 또는 수정
- 🟢 **GREEN**: 개선 권장 → 기술적 고려사항에 기록

수정 후 재검증 (최대 2라운드). RED=0이면 다음 단계로 진행.
**개수 제한 금지**: 라운드당 발견 개수를 인위적으로 제한하지 않는다.

### 6단계: 안내

```
체크리스트 확장 완료

{파일경로}
- Phase 1: {이름} ({N}개 작업)
- Phase 2: {이름} ({N}개 작업)
- Phase 3: {이름} ({N}개 작업)
총 {M}개 원자 작업

구현을 시작하려면 "다음" 또는 "구현해"라고 말씀해주세요.
```

## 주의사항

- **코드를 반드시 읽는다**: 추측으로 작업을 나누지 않는다. 실제 코드를 보고 정확한 파일, 라인, 함수를 명시한다.
- **기존 구현 범위 유지**: 체크리스트를 확장할 뿐, 새로운 기능이나 범위를 추가하지 않는다. **단, TC Phase 스킵 판정은 예외** — 4단계에서 반드시 재검증한다.
- **포맷 호환성**: 반드시 `- [ ]` / `- [x]` 마크다운 체크박스를 사용한다. `☐` (U+2610) 유니코드 문자는 사용 금지 — `/done` 스킬이 `- [ ]` 패턴으로 파싱한다.
- **헤더 보존**: plan 헤더 블록쿼트(요약 포함)를 삭제하거나 수정하지 않는다. 체크리스트 섹션만 교체한다.
- **커밋 race 방지**: 확장 직후 docs 변경을 커밋해야 하면 `commit.ps1 -Files` 또는 `commit.sh --files`로 명시 파일 add+commit을 한 호출에 묶는다.
