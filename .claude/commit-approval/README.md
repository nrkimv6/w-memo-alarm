# Commit Approval Sentinel

This directory stores one-use approval tokens for commit wrapper calls.

## Contract

- Token path: `.claude/commit-approval/<unix-timestamp>_<random-hex>.token`
- TTL: 60 seconds from the timestamp embedded in the filename.
- Consumption: one token authorizes one matching commit command and is deleted immediately by the PreToolUse hook.
- Reason: `grant-commit.ps1 -Reason "<prefix>:<summary>"` is required, and the full reason must be at least 30 characters.
- Audit: the helper invocation and reason remain visible in the transcript. This does not prove human intent by itself, but it makes unauthorized autonomous commits reviewable.

## Helper Behavior

If a project does not have `.claude/hooks/grant-commit.ps1`, commit skills must not fail solely because of the missing helper. They should report `no-sentinel-hook: <path>` and continue.

`settings.local.json` may still list broad `Bash(commit *)` allow entries for command availability. The approval gate lives in the PreToolUse hook and is not bypassed by that allow entry.
