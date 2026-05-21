---
name: unstuck-merge
description: "dev-runner merge stuck 진단. Use when: 막혔어, merge 막힘, stuck, 머지대기 종료, dev-runner 종료, dev-runner merge stuck"
---

# dev-runner merge stuck 진단

dev-runner가 머지 단계에서 멈췄거나 종료 후 actionable closeout이 필요한 경우, `runner_id` 또는 plan 파일 경로를 입력으로 받아 현재 상태와 다음 action을 분류한다.

## 입력

- `runner_id`: monitor-page dev-runner의 runner id.
- `plan_file`: `.worktrees/plans/docs/plan/*.md` 또는 관련 plan 절대 경로.
- 둘 다 있으면 `runner_id` evidence를 먼저 읽고, `plan_file` 헤더로 branch/worktree를 검증한다.

## 선행조건

- Plan A 산출물: `rebase_kind`, `conflict_files`, `status_porcelain`, `stderr_full`, `runtime_source_commit` evidence가 기록될 수 있어야 한다.
- Plan B 산출물: `merge_reason`, `merge_message`, `blocked_post_merge_error`, `auto_retry_blocked` vocabulary가 runner/read model에 노출되어야 한다.
- monitor-page mirror surface(`.agents`, `.agent`, `.claude`, `.gemini`)는 직접 수정하지 않는다. downstream은 `git pull --ff-only` 수신 또는 read-back evidence로만 확인한다.

## 진단 절차

1. 대상 식별
   - `runner_id`가 있으면 `GET /api/v1/dev-runner/runners/{runner_id}` 또는 Redis key `plan-runner:runners:{runner_id}:*`를 읽는다.
   - `plan_file`만 있으면 plan 헤더의 `branch`, `worktree`, `worktree-owner`, `상태`를 읽는다.
   - plan 파일이 없다고 판단하기 전에 `.worktrees/plans/docs/plan`, `.worktrees/plans/docs/archive`, `docs/plan`, `docs/archive`를 확인한다.

2. branch/worktree 확인
   - worktree가 있으면 해당 경로에서 `git status --short --branch`를 읽는다.
   - target repo에서 `git fetch origin` 후 `git rev-list --left-right --count HEAD...origin/main`을 기록한다.
   - impl branch와 main의 차이는 `git rev-list --left-right --count main...HEAD`로 별도 기록한다.
   - `behind-only`는 `git pull --ff-only` 후보, `diverged`는 push-first 금지와 명시 merge 결정 필요로 분류한다.

3. merge evidence 수집
   - runner/read model에서 `merge_status`, `merge_reason`, `merge_message`, `display_state`, `remaining_post_merge_tasks`, `auto_retry_blocked`, `runtime_source_commit`, `runtime_source_root`를 읽는다.
   - 로그 또는 metadata에서 `rebase_kind`, `conflict_files`, `status_porcelain`, `stderr_full`, `fallback`을 읽는다.
   - `skipped_only`와 `previously_applied_only`는 `skipped_already_applied`로 정규화한다.

4. failure history 확인
   - plan의 failure history 또는 runner 로그에서 같은 `merge_reason` 반복 횟수를 센다.
   - 같은 actionable reason이 3회 이상이면 `auto_retry_blocked`로 취급한다.

## action 분류

- `자동 복구 가능`
  - `rebase_kind=skipped_already_applied`
  - `conflict_files=[]`
  - `merge_reason`이 비어 있거나 `unknown_merge_error`이고 worktree가 clean
  - 다음 action: mirror-safe retry 또는 merge retry를 1회만 제안한다.

- `사용자 개입 필요`
  - `merge_reason`이 `rebase_conflict`, `user_intervention_required`, `service_lock_blocked`
  - `conflict_files`가 비어 있지 않음
  - 다음 action: 충돌 파일, reason, worktree 경로를 출력하고 자동 재시도 중단을 명시한다.

- `clean branch 재구성 필요`
  - `merge_reason=stale_too_diverged_blocked`
  - `behind + ahead`가 stale threshold를 넘거나 branch가 오래된 main에서 갈라짐
  - 다음 action: fresh worktree/branch 재생성을 제안하고 기존 branch push-first를 금지한다.

- `Plan 분할 필요`
  - 같은 `merge_reason` 3회 이상 또는 `auto_retry_blocked=true`
  - failure history가 동일 단계 재진입을 반복함
  - 다음 action: 반복 reason별로 plan을 분리하거나 owner intervention plan을 만든다.

- `downstream sync 필요`
  - wtools source commit에는 skill/metadata가 있으나 monitor-page receiver가 `behind-only`
  - mirror diff가 없고 `git pull --ff-only`로 수신 가능한 상태
  - 다음 action: downstream read-back 또는 ff-only pull 후보로 기록한다. `diverged`이면 push-first 없이 blocker로 둔다.

## 출력 형식

다음 항목을 짧게 출력한다.

- 대상: `runner_id`, `plan_file`, `branch`, `worktree`
- evidence: `merge_status`, `merge_reason`, `display_state`, `rebase_kind`, `conflict_files`, `runtime_source_commit`, `behind/ahead`
- 판정: 위 5종 action 중 하나
- 다음 action: 실행 가능한 단일 조치와 금지할 조치
- cross-surface: `.agents/skills=비반영`, `.gemini=해당 없음`, `monitor-page mirror=downstream read-back only`
