---
description: "현재 계획의 다음 workflow를 결정해 계속 진행. Use when: 진행해, 계속해, 마저 해, 끝까지 해"
---

# Continue Plan Workflow

`.agent/workflows/continue-plan.md` owns continuation routing for the `.agent/workflows` surface. It follows the common contract in `common/tools/continue-plan-pipeline-contract.md` and does not modify `.gemini/commands`, `.gemini/agents`, or `common/tools/plan-runner/gemini-agents`.

## Trigger Boundary

- Continuation triggers: `진행해`, `계속해`, `마저 해`, `끝까지 해`.
- Implementation triggers stay with `implement.md`: `구현해`, `implement`, explicit plan implementation requests.
- Explicit stop: `구현만`, `머지하지 마`, `검토만`.

## State Dispatch

| current state | next workflow | condition |
|---|---|---|
| `초안`, `검토대기` | `review-plan` | review has not completed |
| `수정필요` | `implement` | merge/test failure anchor exists |
| `검토완료` | `expand-todo` or `implement` | checklist readiness decides |
| `구현중`, `테스트중` | `implement` | executable implementation leaf remains |
| `머지대기`, `통합테스트중` | blocker or external `/merge-test` handoff | `.agent/workflows` has no merge-test workflow in this inventory |
| `구현완료` | `done` | archive, TODO/DONE, cleanup, or downstream read-back remains |
| `완료`, `보류` | none | no owner unless user changes scope |

## Tail Handoff Input

| field | required |
|---|---:|
| `plan` | yes |
| `branch` | yes |
| `worktree` | yes |
| `remaining_leaf` | yes |
| `next_owner` | yes |
| `blocker` | yes |

## Final Gate

Final is allowed only when `next_owner=none`, `explicit_stop=true`, or `hard_blocker=true`. `머지대기` with no local workflow owner must be reported as a handoff/blocker, not as success.

