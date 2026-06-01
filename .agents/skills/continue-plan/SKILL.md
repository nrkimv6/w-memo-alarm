---
name: continue-plan
description: "현재 계획의 다음 owner를 결정해 계속 진행. Use when: 진행해, 계속해, 마저 해, 끝까지 해"
---

# Continue Plan Pipeline

`continue-plan` owns continuation routing for Codex `.agents`. It consumes the common contract in [`common/tools/continue-plan-pipeline-contract.md`](../../../common/tools/continue-plan-pipeline-contract.md) and dispatches the next owner without asking the user to repeat the same instruction.

## Trigger Boundary

- Continuation triggers: `진행해`, `계속해`, `마저 해`, `끝까지 해`.
- Implementation triggers stay with `/implement`: `구현해`, `implement`, `수정해`, `적용해`.
- Explicit stop: `구현만`, `머지하지 마`, `검토만`. These allow a final status update after the requested bounded step.

## State Dispatch

| current state | next owner | condition |
|---|---|---|
| `초안`, `검토대기` | `/review-plan` | review has not completed |
| `수정필요` | `/implement` | merge/test failure anchor exists |
| `검토완료` | `/expand-todo` | checklist is not execution-ready or child split is missing |
| `검토완료` | `/implement` | checklist is execution-ready |
| `구현중`, `테스트중` | `/implement` | executable implementation leaf remains |
| `머지대기`, `통합테스트중` | `/merge-test` | branch/worktree or merge recovery remains |
| `구현완료` | `/done` | archive, TODO/DONE, cleanup, or downstream read-back remains |
| `완료` + docs `plans` branch ahead-only | `plans push/read-back` | code `main` is aligned but `.worktrees/plans` still needs push + fetch/recheck + `origin/plans:<path>` read-back |
| `/done` no-op + explicit `/reflect` remains | `/reflect` | archive/TODO/DONE read-back is success-equivalent but reflect owner was declared |
| `완료`, `보류` | none | no owner unless user changes scope |

## Tail Handoff Input

Workers hand off using these fields:

| field | required |
|---|---:|
| `plan` | yes |
| `branch` | yes |
| `worktree` | yes |
| `remaining_leaf` | yes |
| `db_direct_remaining` | yes |
| `blocker` | yes |

## Final Gate

Final response is allowed only when `next_owner=none`, `explicit_stop=true`, or `hard_blocker=true`. Intermediate evidence such as `targeted tests passed`, `worktree clean`, `plan progress committed`, `main pushed/read-back`, `archive committed`, `DONE no-op`, or `머지대기` is not final evidence while `/merge-test`, docs `plans` push/read-back, `/done`, or `/reflect` remains.

## Parity Gates

Preserve these gates from the common contract before changing worker prose: `머지대기 batch 모드`, `수정필요 재진입`, `Phase DB-Direct 잔여`, `_todo-N parent/child 완료 판정`, `remote evidence 게이트`, `compaction resume`.

