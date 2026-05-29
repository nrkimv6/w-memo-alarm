# 자동 완료 수동 처리 (Fallback 에이전트)

너는 `auto-done.ps1`을 사용할 수 없는 환경에서 단계별 완료 처리를 수행하는 에이전트다.

## 완료 판단 기준

- **미완료 상태 (`[ ]`) 체크박스가 0개인지** 반드시 먼저 확인한다. (1개라도 있으면 실행 불가)

## 실행 흐름

1. **상태 업데이트** (Edit)
   - plan 파일 읽기(Read) 후, `> 상태: 구현완료`로 변경한다.
   - 모든 항목이 완료되었음을 `> 진행률: N/N (100%)`와 같이 표기한다.

2. **MANUAL_TASKS 추출** (Read/Edit)
   - plan 내에 다음 키워드가 포함된 리스트 항목을 식별한다:
     `[MANUAL]`, `(MANUAL)`, `*수동*`, `수동 테스트`
   - 해당 항목을 분리해 대상 프로젝트의 `MANUAL_TASKS.md` 파일에 추가한다.

3. **아카이브 이동** (Shell) — 반드시 `archive-plan.ps1` helper 사용
   - `.worktrees/plans/docs/archive` 또는 `{프로젝트}/docs/archive` 내의 경로를 확인(Read)한다.
   - `auto-done.ps1`을 사용할 수 없어도 `common\tools\archive-plan.ps1`은 단독 호출 가능하므로 먼저 helper 존재 여부를 확인한다.
   - helper가 있으면 `powershell.exe -ExecutionPolicy Bypass -File "common\tools\archive-plan.ps1" -PlanFile "{원본_plan_경로}" -ArchiveFile "{아카이브_대상_경로}" -RepoRoot "{repo_root}" -Json` 를 실행한다.
   - helper JSON에서 `status == "success"`, `archive_pair_ok == true`, `half_archived_state == false`를 모두 확인한다. 허용 reason은 `git_mv_pair`, `already_archived_resume`, `archive_move_no_op`이다.
   - `archive_pair_ok=false`, `half_archived_state=true`, JSON parse 실패, helper exit code 실패는 `STATUS: FAILED`로 처리하고 `error_code`/`reason`/`message`를 출력한다.
   - helper가 없으면 archive 이동을 진행하지 말고 read-only 진단(`Test-Path common\tools\archive-plan.ps1`, `git status --short`, 원본/대상 경로 존재 여부)만 수행한 뒤 `ARCHIVE_HELPER_UNAVAILABLE`로 실패한다.
   - `archive-plan.ps1`은 내부에서만 `git mv -f --`를 수행하고 staged source deletion + archive destination pair를 검증한다. Gemini fallback은 직접 `git mv`, `Move-Item`, `Remove-Item`으로 archive 이동을 수행하지 않는다.

4. **TODO 갱신** (Edit)
   - `{프로젝트}/TODO.md` 및 `wtools/TODO.md`에서 해당 plan 제목의 행을 제거하거나 상태를 완료로 변경한다.

5. **DONE 기록** (Edit)
   - wtools의 canonical DONE ledger는 `.worktrees/plans/docs/DONE.md`이다. 완료 항목(`- [x] YYYY-MM-DD: {제목}`)은 이 파일 최상단에 추가한다.
   - root/common의 `common/docs/DONE.md`, `common\docs\DONE.md`, `{project}/docs/DONE.md`, `{프로젝트}/docs/DONE.md`는 wtools 완료 ledger가 아니며 fallback 작성 대상으로 삼지 않는다.
   - `.worktrees/plans/docs/DONE.md` 항목이 5개를 초과하면 오래된 항목을 `.worktrees/plans/docs/archive/DONE-YYYY-MM.md`로 분리한다.

6. **커밋** (Shell)
   - 변경 사항을 `powershell.exe -Command "git add -A"` 후 커밋한다.
   - 커밋 스크립트 경로: `$env:WTOOLS_TOOLS_DIR\commit.ps1` (환경 변수 우선) 또는 `D:\work\project\tools\common\commit.ps1` (fallback)
   - 명령 예: `powershell.exe -ExecutionPolicy Bypass -File "$commitScriptPath" \"docs: archive completed plan — {제목}\"`

## 출력 형식

**경고**: 아래 `===AUTO-DONE-RESULT===` 결과 블록을 생략하면 plan-runner가 완료 상태를 파싱하지 못해 파이프라인 실패로 처리할 수 있다. 처리 성공/실패/스킵 여부와 관계없이 반드시 출력한다.

```
===AUTO-DONE-RESULT===
PROJECT: {프로젝트명}
PLAN: {plan_파일명}
STATUS: {SUCCESS/FAILED/SKIPPED}
MESSAGE: {Fallback 수동 처리 결과 요약}
## 주의 사항

- **인코딩**: 모든 파일 수정 및 생성 시 반드시 **UTF-8 (BOM 없음)**을 사용해야 한다. 한글 깨짐 방지를 위해 필수적이다.
- **원자성**: 중간 단계에서 실패할 경우, 가능한 한 이전 상태로 복구하거나 사용자에게 현재 진행 상황을 명확히 보고해야 한다.

## 후속 작업 추천

- 처리가 완료되면 `/next` 워크플로우를 통해 다음 작업을 찾도록 안내하라.
- **MANUAL_TASKS.md**에 추가된 항목이 있다면, 해당 작업들이 육안 확인이나 브라우저 테스트가 필요한 수동 작업임을 알리고, `/next` 작업 후보로 이 항목들을 우선 검토하도록 안내하라.
```

---

## 게이트 우회 금지 (fallback에서도 동일하게 적용)

fallback 경로에서도 아래 4종 게이트는 우회되지 않는다:

| 게이트 | fallback 동작 |
|--------|---------------|
| **2.5 branch/worktree 활성** | plan 헤더에 필드가 있으면 fallback에서도 즉시 중단 |
| **2.6 fix: Phase R 누락** | Phase R 없으면 fallback에서도 즉시 중단 |
| **2.7 DB-Direct evidence** | 3종 evidence 미확인 시 fallback에서도 즉시 중단 |
| **MANUAL_TASKS 완료 제외** | 수동 항목은 fallback에서도 완료 판정에서 제외 |

**fallback이 끄는 단계 vs 끄지 않는 단계:**
- 끄는 것: `auto-done.ps1` 자동 실행 (수동 단계별 처리로 대체), version-bump (fallback에서 스킵)
- 끄지 않는 것: `archive-plan.ps1` helper를 통한 archive 이동, TODO→DONE, plans/TODO.md 동기화, 커밋

`auto-done.ps1` 불가 ≠ `archive-plan.ps1` 불가다. fallback은 wrapper 전체를 우회하더라도 archive 이동 단계에서는 helper 단독 호출을 정상 경로로 사용한다.

> 공통 engine surface 계약은 `common/tools/engine-surface-authoring-contract.md`를 따르고, done fallback 세부 절차는 이 Gemini policy가 직접 소유한다.
