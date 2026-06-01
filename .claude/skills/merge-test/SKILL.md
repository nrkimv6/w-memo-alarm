---
name: merge-test
description: "워크트리 브랜치를 main에 머지하고 T4/T5 통합테스트를 실행 + 완료처리까지 일괄 실행. /implement 완료 후 호출."
triggers: ["머지 테스트", "merge-test", "머지후테스트", "통합테스트", "merge test"]
---

<!-- script-contract-invariant -->
## Script Contract Invariant

Canonical policy lives in [`common/tools/merge-test-contract.md`](../../../common/tools/merge-test-contract.md). This Claude surface is an orchestrator: it discovers helper CLIs, consumes their JSON, records evidence, and routes the next owner. Do not paste blocker tables, T4/T5 classifiers, or archive gates back into this file.

Preflight and cleanup evidence must come from helper CLI contracts before any merge mutation. Discover helpers in order: repo-local `common\tools`, then wtools canonical helper surface `D:\work\project\service\wtools\common\tools`. Use `merge-test-preflight.ps1 -PlanFile <plan> -RepoRoot <repo> -Json` for pending merge, branch/worktree, dirty, service-lock, and live runtime readiness evidence. Use `merge-test-cleanup.ps1 -PlanFile <plan> -RepoRoot <repo> -Json` for post-merge cleanup evidence. A downstream repo-local `common\tools` absence is not `helper_unavailable` while the wtools canonical helper is discoverable. Only after canonical helper discovery fails, record `helper_unavailable` and use the direct read-back checklist.

> Routing gate: branch/worktree present -> /merge-test; absent -> /done

# 머지 후 통합테스트 게이트

`/implement`로 worktree에서 구현 완료 후 main에 머지하고, plan의 T4/T5 검증과 `/done` 완료처리까지 이어간다. `merge success`, `T4/T5 passed`, `main pushed/read-back`, 또는 `cleanup ready` 단독은 final 사유가 아니다. common contract의 STOP/CONTINUE Decision Table에서 remaining executable leaf, remaining targets, `/done`, archive/read-back, docs `plans` push/read-back이 모두 닫힌 뒤에만 완료를 말한다.

## compaction resume gate

If the context summary contains a pending task, branch/worktree merge target, cleanup target, receiver read-back, or archive handoff, resume the merge-test owner flow without asking the user again. The first resumed update should start with `컨텍스트 재개` and then continue from helper JSON evidence.

## Product Surface Evidence Scope

For plans declaring `completion-scope: product_surface`, scratch/private evidence alone is insufficient. Evidence limited to `scripts/scratch/`, `private/`, `.private/`, or other non-product utility paths is `non_product_only`, target-local, and must not archive the product-surface target until product path/read-back evidence exists.

## Corrective action approval boundary

Before rollback-like mutations, classify the current action class and provide a read-only preview with approval evidence, affected commits/files, and commands. `git revert`, merge commit 되돌리기, feature removal, and scheduler 경로 삭제 require explicit `기능 롤백 승인`; 일반 표현만으로 `feature_rollback`을 승인한 것으로 보지 않는다.

## Skill Path Precedence

- 사용자가 `[$merge-test](...SKILL.md)` 또는 파일시스템 경로로 local/project skill 파일을 명시한 경우 반드시 그 exact file을 Read 기준으로 삼는다.
- 같은 name의 global/duplicate skill(`C:\Users\Narang\.codex\skills\merge-test\SKILL.md` 등)은 대체 사용하지 않는다.
- 명시 경로가 없거나 읽기 실패한 경우에만 fallback 후보를 검토하며, fallback 사용 전 실제로 읽을 경로와 이유를 사용자에게 보고한다.

## Claude Surface Notes

- `.claude/skills/merge-test/SKILL.md` is not a mirror of `.agents/skills/merge-test/SKILL.md`; both surfaces share the common contract but keep engine-specific invocation text independent.
- Claude-specific command/tool mechanics stay here. Common workflow policy belongs in `common/tools/merge-test-contract.md`.

## Owner Flow

1. **preflight**: `merge-test-preflight.ps1 -Json`을 실행하고 `blocker_type`, `local_merge_possible`, `remote_diverged`, `push_blocked`, `direct_root_commit_blocked`, `failed_command`, `failed_exit_code`, `failed_stderr_excerpt`, `live_runtime_readiness.runtime_fingerprint`를 기록한다.
2. **merge**: root main worktree에서 remote relation gate를 통과한 뒤 구현 branch를 병합한다. 충돌은 final abort가 아니라 conflict continuation이다.
3. **T4/T5**: post-merge, root-worktree, main 브랜치 3축이 모두 충족될 때만 실행한다. evidence row schema와 live/mock 분류는 common contract의 `T4/T5 live contract classification`을 따른다.
4. **cleanup**: `merge-test-cleanup.ps1 -Json`을 먼저 읽고 `cleanup_ready=true`, `mutation_ready=true`, `hard_blockers=[]`이면 `ignored_dirty` warning만으로 중단하지 않는다.
5. **done handoff**: remaining target, child plan, downstream sync/read-back, Phase Z evidence, docs `plans` remote relation을 재계산한다. archive/read-back 또는 `.worktrees/plans` push/read-back이 남아 있으면 `/done`, `plans push/read-back`, 또는 해당 owner step으로 계속한다.

## main flow

The main branch flow is governed by the Blocker Policy SSOT in `common/tools/merge-test-contract.md` and by the local `## Blocker Policy SSOT` summary below. Do not create ad hoc merge blocker labels before reading helper JSON.

## helper_unavailable fallback flow

Fallback is allowed only when both repo-local and canonical helpers are unavailable. Even then, direct read-back must map findings back to the Blocker Policy SSOT; `ROOT_DIRTY_BEFORE_REMOVE` must not be invented from root dirty status without helper JSON evidence.

## Commit Sentinel Grant Contract

Before every `commit.ps1` invocation, check `.claude\hooks\grant-commit.ps1`. If present, issue a fresh sentinel with one of these prefixes:

| path | reason prefix |
|---|---|
| merge commit | `merge-test:<branch> merge completion` |
| pending merge resolve | `merge-test:resolve:<branch> pending merge completion` |
| docs cleanup | `merge-test:docs:<branch> docs cleanup` |
| post-merge repair | `merge-test:repair:<branch> post merge repair` |

Sentinel failure is a hard stop before the commit wrapper. Missing sentinel hook is evidence, not a blocker.

## Blocker Classification Contract

- Read `merge-test-preflight.ps1 -Json` before declaring local merge blocked.
- `remote_diverged=true` is remote sync/push risk; do not escalate it to local merge blocked unless the helper also reports a push/sync blocker.
- Cleanup classification must read `merge-test-cleanup.ps1 -Json`; helper JSON governs ROOT_DIRTY_BEFORE_REMOVE and residue decisions.
- `UNTRACKED_ORIGIN_BLOB_RESIDUE_BLOCKED` is valid only when returned by helper residue evidence.
- Receiver sync/read-back uses `git fetch origin` plus `git rev-list --left-right --count HEAD...origin/main` as source of truth. `0 N` means behind-only and may retry `git pull --ff-only origin main`; `L N` means diverged and maps to `DOWNSTREAM_DIVERGED_PUSH_BLOCKED`.

## Blocker Policy SSOT

The canonical table is in `common/tools/merge-test-contract.md`; this local summary exists so the orchestrator can name stable codes without duplicating policy prose.

| code | source key/evidence | severity | next owner |
|---|---|---|---|
| `WORKTREE_DIRTY_BEFORE_REMOVE` | target worktree status | hard blocker | owner worktree cleanup |
| `UNTRACKED_ORIGIN_BLOB_RESIDUE_BLOCKED` | `merge-test-cleanup.ps1 -Json` residue evidence | hard blocker | quarantine/owner plan |
| `DOWNSTREAM_MIRROR_READBACK_WAIT` | receiver read-back missing | continuation blocker | downstream sync/read-back |
| `NON_FF_SYNC_BLOCKED` | eligible receiver ff-only/push failed | hard blocker | source-owner recovery |
| `DOWNSTREAM_DIVERGED_PUSH_BLOCKED` | receiver tuple `L N` | hard blocker | owner-approved merge/rebase/regenerate/abort |
| `DOWNSTREAM_SYNC_TRIGGER_FAILED` | sync workflow or push rejected | hard blocker | source-owner recovery |
| `ROOT_GUARD_BLOCKED_PENDING_SYNC_MERGE` | root guard staged protected paths | hard blocker | preserve/abort/ff-only receiver |
| `GIT_GUARD_NOT_ACTIVE` | helper discovered but git guard inactive | hard blocker | enable guard/session repair |

Rules:
- `_BLOCKED` suffix is reserved for helper or receiver policy hard blockers.
- `ignored_dirty` remains warning/evidence when `cleanup_ready=true`, `mutation_ready=true`, and `hard_blockers=[]`.
- Receiver behind-only tuple `0 N` is retried with `git pull --ff-only origin main`; diverged tuple `L N` maps to `DOWNSTREAM_DIVERGED_PUSH_BLOCKED`.
- Recovered non-live validation uses `failure_class=test_fixture_stale|environment_failure` with `blocks_archive=false` and `blocks_other_targets=false` when it is warning-success.
- Final summaries include `phase | blocker_type | local_merge_possible | remote_diverged | command | exit_code | next_owner`.

## Receiver No-Reprompt Recovery Table

| receiver tuple | action | reprompt_required | blocker_code | next_owner |
|---|---|---:|---|---|
| ahead-only(left>0,right=0) | `git push origin main` or sync dispatch -> `git fetch origin` -> `origin/main:<path>` read-back hash | false | none unless push/dispatch fails | receiver read-back |
| behind-only(left=0,right>0) | `git pull --ff-only origin main` -> fetch/recheck -> read-back hash | false | `NON_FF_SYNC_BLOCKED` only after retry evidence | receiver read-back |
| diverged(left>0,right>0) | push-first 금지 | true | `DOWNSTREAM_DIVERGED_PUSH_BLOCKED` | owner-approved merge/rebase/regenerate/abort |
| destructive/ambiguous recovery | mutation 금지 | true | `approval_required` | explicit owner approval |
| push/dispatch rejected after eligible tuple | stop with evidence | true | `DOWNSTREAM_SYNC_TRIGGER_FAILED` or `NON_FF_SYNC_BLOCKED` | source-owner flow, credential repair |

Receiver closeout 결과표 includes `receiver`, `rev-list tuple`, `action`, `reprompt_required`, `blocker_code`, `read-back hash`, and `next_owner`.

For wtools docs closeout, run the same tuple logic against the docs commit root upstream, normally `.worktrees/plans` tracking `origin/plans`. If code `main` is `0 0` but docs `plans` is ahead-only, `session-target-router.ps1` must receive `plans_ahead_only=true` or equivalent relation evidence and return `decision=continue`, `next_owner=plans push/read-back`; final wording is forbidden until push, fetch/recheck, and `origin/plans:<archive-or-ledger-path>` read-back succeed.

## T4/T5 Orchestration

The machine-readable evidence table must keep these columns: `stage`, `command`, `cwd`, `result`, `exit_code`, `log_ref`, `blocker_code`. Valid stages are `T4`, `T4-operational-merge`, `T5-http`, `T5-http_live`; valid results are `완료`, `미실행`, `해당 없음`, `실패`, and `failed -> recovered`.

Common contract keywords that must remain in the canonical contract and may be referenced in plan evidence: `Recovered validation ledger`, `original_command`, `recovered_command`, `failed_command`, `recovery_action`, `recovered_result`, `failure_class`, `blocks_archive=false`, `blocks_other_targets=false`, `t4_t5_evidence_missing`, `t4_t5_not_run`, `보류(<blocker_code>)`, `T5_CLAIM_HTTP_FIXTURE_MISSING`, `non_live_recovery_evidence_missing`.

T4/T5 live contract classification is owned by `common/tools/merge-test-contract.md`: `live`, `mock_only`, `http_live`, `testclient_only`, `absent`. Blocker names include `T4_MOCK_ONLY_DETECTED`, `T5_TESTCLIENT_ONLY_DETECTED`, `T4_LIVE_SMOKE_MISSING`, and `T5_HTTP_LIVE_MARKER_ABSENT`. Markers and probes include `pytest.mark.e2e`, `pytest.mark.http_live`, `TestClient`, `requests`/`httpx` localhost, `page.route("**/*")`, `no full-route mock`, `raw Chromium CDP`, and `feature area` live smoke coverage.

Operational merge validation is also owned by `common/tools/merge-test-contract.md`. Plan-runner merge policy/runtime changes with detector seeds such as `merge_stage`, `_rebase_branch_onto_main`, `merge policy`, `branch preflight`, or `dev-runner merge` require a `T4-operational-merge` row. UI/HTTP `T4/T5 해당 없음` does not waive this runner lifecycle gate; missing evidence is `OPERATIONAL_MERGE_E2E_MISSING`.

The common contract also owns hard gates for source-contract-only, DOM-only, zero-selector collect-only, selector/action/assertion, worker registration/readiness, and UI data display read-back. A source-contract success row is auxiliary evidence only; a UI T4 row needs `selector_count > 0`, performed action, post-action assertion, actual target/deep-link URL marker rendering, representative rendered marker, and placeholder absence. UI data display regression plus API read-back plus mock UI E2E is insufficient; missing target marker evidence is `T4_UI_TARGET_MARKER_MISSING` and should be classified as `contract_regression`. Worker/scheduler T5 rows need process fingerprint or `runtime_fingerprint`, worker registration log, and readiness/API read-back.

If a T4/T5 command fails with selector drift, timeout, connection refused, Browser/Playwright profile lock, missing module, or stale runtime and then recovers, keep the original failure row and add Recovered validation ledger evidence. A corrected rerun alone is not sufficient.

### 머지 전 게이트 체크리스트

1. Root worktree is `main`, and implementation files are committed in the linked worktree.
2. Run preflight helper JSON and record hard blockers before mutation.
3. Run `git fetch origin`.
4. **remote relation (1.45)**: local impl branch merge mutation 직전 `git rev-list --left-right --count HEAD...origin/main`를 확인한다.
5. `behind-only(0 N)`이면 `git pull --ff-only origin main` 1회 후 fetch/recheck한다.
6. `diverged(L N)`이면 `DOWNSTREAM_DIVERGED_PUSH_BLOCKED`로 중단한다.
7. `ahead-only(N 0)`는 이 pre-pull gate에서 push하지 않고 downstream sync/read-back 단계와 분리한다.
8. Merge implementation branch, record merge commit, then run only the plan-declared validation.

## 4단계 검증 실행

- T4 기준: 실서버(localhost) 또는 실브라우저(Playwright) 필요. TestClient/mock 기반은 T3이며 T4 완료 근거가 아니다.
- T5-http는 TestClient 기반 `pytest.mark.http`; T5-http_live는 실서버 직접 호출 `pytest.mark.http_live`다. 둘은 서로 대체하지 않는다.
- `http_live`는 collect-only discovery 후 selected>0일 때만 본실행한다. 명시 파일 경로에서 0 selected면 `MERGE_TEST_FAILED[selection_contract]`다.
- Live readiness 실패 후 restart/read-back success는 `environment_failure`, `result=failed -> recovered`로 기록한다.

### 5단계: cleanup helper-first

Cleanup blocker code 정의와 우선순위는 Blocker Policy SSOT를 따른다. `merge-test-cleanup.ps1 -Json` 없이 root dirty를 hard blocker로 승격하지 않는다. Worktree removal and branch deletion are serial git mutations and must not be parallelized.

## Done Handoff

Before `/done`, verify:

- Phase Z complete, worktree removed, branch removed, header meta removed.
- `> 머지커밋:` points to an actual merge or fast-forward result.
- T4/T5 evidence table is complete when the plan contains T4/T5 phases.
- Downstream receiver read-back exists for changed mirror surfaces.
- Parent-child open gate has no active child plans unless explicit detach approval exists.

## Recipes

PowerShell snippets and longer procedural examples live in [`_recipes.md`](./_recipes.md). Keep recipes executable-oriented; policy decisions belong in `common/tools/merge-test-contract.md`.
