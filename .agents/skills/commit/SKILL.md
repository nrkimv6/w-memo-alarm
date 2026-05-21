---
name: commit
description: 커밋 스크립트를 통한 안전한 git commit 실행. 커밋, commit, 저장 요청 시 자동 호출 (project)
allowed-tools: Bash,Read
---

# Git Commit

커밋 스크립트를 통해 안전하게 git commit을 실행합니다.

## 사용법

커밋 스크립트는 3개가 존재하며, 위에서부터 순서대로 시도하고 **실패하거나 없으면** 다음 순위로 fallback합니다.

| 순위 | 스크립트 | 환경 | 경로 |
|------|---------|------|------|
| 1순위 | `commit.ps1` (공용) | PowerShell / powershell.exe 경유 | `D:\work\project\tools\common\commit.ps1` |
| 2순위 | `commit.sh` (공용) | Bash | `D:\work\project\tools\common\commit.sh` |
| 3순위 | `commit.sh` (로컬) | Bash | 스킬 폴더 내 `commit.sh` (이 파일과 같은 디렉토리) |

## Mutation Approval And Main Branch Gate

- investigation approval is not mutation approval: `조사`, `검토`, `현황 확인`, `가능 여부 확인`은 commit approval이 아니며 code/git/DB mutation 승인도 아니다. 사용자가 `커밋해`, `저장해`, `commit`, `적용해`처럼 mutation approval을 명시해야 한다.
- main-branch mutation gate: commit skill도 `/implement`와 같은 main worktree 차단 계약을 따른다.
- 원본 main worktree에서 code/git mutation을 커밋하려고 하면 `MAIN_WORKTREE_MUTATION_BLOCKED`로 중단한다. 구현 변경은 linked worktree에서만 stage/commit한다.
- docs commit root가 `.worktrees/plans`이면 commit cwd도 `.worktrees/plans`다. main worktree cwd에서 `.worktrees/plans` 문서를 대신 `git add`/`commit.ps1` 하지 않는다.
- wtools에서는 `git commit` 직접 호출 금지다. PowerShell canonical은 항상 `D:\work\project\tools\common\commit.ps1`이며, git guard/session 상태가 필요한 repo에서는 commit 전 guard evidence를 확인한다.
- commit 전 `git diff --cached --name-status`와 current owner expected staged set을 read-back한다. 승인 범위 밖 path가 있으면 staged mismatch hard stop으로 중단한다.

## commit sentinel grant contract

`commit.ps1` 또는 `commit.sh` 호출 직전에는 대상 repo의 `.claude\hooks\grant-commit.ps1` 존재 여부를 확인한다.

- helper가 있으면 commit wrapper 호출 직전에 매번 새 sentinel을 발급한다.
- helper가 없으면 commit을 막지 않고 transcript에 `no-sentinel-hook`을 남긴다.
- helper 실패, prefix 누락, 30자 미만 reason 거부는 hard stop이며 commit wrapper를 호출하지 않는다.
- 발급 reason과 commit 결과는 분리해서 보고한다. 예: `commit-grant: user-prompt:...`, `commit: <hash>`.
- 연속 commit은 1회용 토큰 재사용 금지다. commit마다 새로 발급한다.

Reason prefix는 아래 4종만 사용한다.

| prefix | 용도 |
|--------|------|
| `user-prompt:<요약 30자 이상>` | 사용자가 직접 commit/저장 의도를 발화한 경우 |
| `done-archive:<plan-slug> <요약 30자 이상>` | `/done` archive/TODO/DONE 커밋 |
| `merge-test:<branch> <요약 30자 이상>` | `/merge-test` merge/docs/resolve 커밋 |
| `manual-tasks:<plan-slug> <요약 30자 이상>` | `/done` MANUAL_TASKS 분리 커밋 |

PowerShell 발급 예시:

```powershell
$grantCommit = Join-Path (Get-Location) ".claude\hooks\grant-commit.ps1"
$grantReason = "user-prompt:사용자가 요청한 변경 파일을 확인하고 명시 커밋으로 저장"
if (Test-Path $grantCommit) {
  & $grantCommit --reason $grantReason
  if ($LASTEXITCODE -ne 0) { throw "commit sentinel grant failed: $grantReason" }
} else {
  Write-Host "no-sentinel-hook: $grantCommit"
}
```

### 1순위: commit.ps1 (PowerShell)
```powershell
git add <files>
$grantCommit = Join-Path (Get-Location) ".claude\hooks\grant-commit.ps1"
$grantReason = "user-prompt:사용자가 요청한 변경 파일을 확인하고 명시 커밋으로 저장"
if (Test-Path $grantCommit) {
  & $grantCommit --reason $grantReason
  if ($LASTEXITCODE -ne 0) { throw "commit sentinel grant failed: $grantReason" }
} else {
  Write-Host "no-sentinel-hook: $grantCommit"
}
& "D:\work\project\tools\common\commit.ps1" "커밋 메시지"
```

Bash에서 powershell.exe 경유:
```bash
git add <files>
powershell.exe -Command "Set-Location 'D:\work\project\service\wtools'; $grantCommit = Join-Path (Get-Location) '.claude\hooks\grant-commit.ps1'; $grantReason = 'user-prompt:사용자가 요청한 변경 파일을 확인하고 명시 커밋으로 저장'; if (Test-Path $grantCommit) { & $grantCommit --reason $grantReason; if ($LASTEXITCODE -ne 0) { throw \"commit sentinel grant failed: $grantReason\" } } else { Write-Host \"no-sentinel-hook: $grantCommit\" }; & 'D:\work\project\tools\common\commit.ps1' '커밋 메시지'"
```

### 2순위: commit.sh (공용, fallback)
```bash
# ⚠️ 반드시 cd로 레포 디렉토리 이동 후 실행!
cd "/d/work/project/service/wtools" && git add <files> && powershell.exe -Command "$grantCommit = Join-Path (Get-Location) '.claude\hooks\grant-commit.ps1'; $grantReason = 'user-prompt:사용자가 요청한 변경 파일을 확인하고 명시 커밋으로 저장'; if (Test-Path $grantCommit) { & $grantCommit --reason $grantReason; if ($LASTEXITCODE -ne 0) { throw \"commit sentinel grant failed: $grantReason\" } } else { Write-Host \"no-sentinel-hook: $grantCommit\" }" && bash "/d/work/project/tools/common/commit.sh" "커밋 메시지"
```

### 3순위: commit.sh (로컬, 최후 fallback)
```bash
# 공용 스크립트가 모두 없을 때 스킬 폴더 내 commit.sh 사용
cd "/d/work/project/service/wtools" && git add <files> && powershell.exe -Command "$grantCommit = Join-Path (Get-Location) '.claude\hooks\grant-commit.ps1'; $grantReason = 'user-prompt:사용자가 요청한 변경 파일을 확인하고 명시 커밋으로 저장'; if (Test-Path $grantCommit) { & $grantCommit --reason $grantReason; if ($LASTEXITCODE -ne 0) { throw \"commit sentinel grant failed: $grantReason\" } } else { Write-Host \"no-sentinel-hook: $grantCommit\" }" && bash "/d/work/project/service/wtools/.agents/skills/commit/commit.sh" "커밋 메시지"
```

**참고**: 모든 commit.sh는 commit.ps1과 동일한 기능을 수행합니다.

## Workflow

1. **변경사항 확인**: `git status`로 수정된 파일 확인
2. **스테이징**: `git add <files>`만 사용한다. `git add .` / `git add -A` / 디렉토리 통째 add는 사용하지 않는다.
   - plans 워크트리가 있으면 `Resolve-DocsCommitRoot` 기준 cwd로 이동한 뒤 `Resolve-DocsCommitCandidates` 반환 파일만 add한다.
2.5. **커밋 prefix 판단**: 커밋 메시지의 prefix 확인
   - `feat:` → minor bump 필요
   - `fix:` → patch bump 필요
   - `feat!:` 또는 BREAKING CHANGE → major bump 필요
   - `refactor:` / `style:` / `perf:` / `test:` / `docs:` / `chore:` → bump 불필요 (skip)
2.6. **version-bump 실행** (bump 필요 시):
   ```powershell
   # 1순위: PowerShell
   & "D:\work\project\tools\common\version-bump.ps1" -BumpType <patch|minor|major> -ProjectDir "$(Get-Location)"
   # 2순위: bash
   bash "/d/work/project/tools/common/version-bump.sh" "<patch|minor|major>"
   ```
2.7. **CHANGELOG.md 항목 추가** (bump 발생 시, Keep a Changelog 형식):
   ```markdown
   ## [새버전] - YYYY-MM-DD
   ### Added      ← feat: 커밋
   ### Fixed       ← fix: 커밋
   ### Breaking    ← feat!: / BREAKING CHANGE
   - 변경 내용 설명
   ```
   CHANGELOG.md가 없으면 파일 자동 생성 후 추가.
2.8. **변경 파일 추가 스테이징**: `git add CHANGELOG.md`
3. **sentinel 발급**: 위 contract에 따라 `user-prompt:<요약 30자 이상>` reason으로 `grant-commit.ps1`을 호출한다. helper가 없으면 `no-sentinel-hook`을 남긴다.
4. **커밋 실행**: 커밋 스크립트 호출
5. **태그 생성** (bump 발생 시): `git tag v{새버전}`

## 커밋 메시지 규칙

| Prefix | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `docs:` | 문서 수정 |
| `refactor:` | 리팩토링 |
| `chore:` | 기타 작업 |
| `test:` | 테스트 추가/수정 |

## 주의사항

- **git commit 직접 사용 금지**: 반드시 커밋 스크립트 사용
- **커밋 단위**: 작게, phase별 여러 개 가능
- **스테이징 필수**: 스크립트 실행 전 `git add` 필요

## 예시

```powershell
# 1순위: commit.ps1
cd "D:\work\project\service\wtools"
git add app/routes/monitor.py
$grantCommit = Join-Path (Get-Location) ".claude\hooks\grant-commit.ps1"
$grantReason = "user-prompt:사용자가 요청한 모니터링 API 변경 파일을 확인하고 저장"
if (Test-Path $grantCommit) { & $grantCommit --reason $grantReason } else { Write-Host "no-sentinel-hook: $grantCommit" }
& "D:\work\project\tools\common\commit.ps1" "feat: 모니터링 API 추가"
```

```bash
# 1순위 (bash에서): powershell.exe 경유
git add app/routes/monitor.py
powershell.exe -Command "Set-Location 'D:\work\project\service\wtools'; & 'D:\work\project\tools\common\commit.ps1' 'feat: 모니터링 API 추가'"

# 2순위: 공용 commit.sh (반드시 cd 먼저)
cd "/d/work/project/service/wtools"
git add app/routes/monitor.py
powershell.exe -Command "$grantCommit = Join-Path (Get-Location) '.claude\hooks\grant-commit.ps1'; $grantReason = 'user-prompt:사용자가 요청한 모니터링 API 변경 파일을 확인하고 저장'; if (Test-Path $grantCommit) { & $grantCommit --reason $grantReason; if ($LASTEXITCODE -ne 0) { throw \"commit sentinel grant failed: $grantReason\" } } else { Write-Host \"no-sentinel-hook: $grantCommit\" }"
bash "/d/work/project/tools/common/commit.sh" "feat: 모니터링 API 추가"

# 3순위: 로컬 commit.sh (공용 스크립트 없을 때)
cd "/d/work/project/service/wtools"
git add app/routes/monitor.py
powershell.exe -Command "$grantCommit = Join-Path (Get-Location) '.claude\hooks\grant-commit.ps1'; $grantReason = 'user-prompt:사용자가 요청한 모니터링 API 변경 파일을 확인하고 저장'; if (Test-Path $grantCommit) { & $grantCommit --reason $grantReason; if ($LASTEXITCODE -ne 0) { throw \"commit sentinel grant failed: $grantReason\" } } else { Write-Host \"no-sentinel-hook: $grantCommit\" }"
bash "/d/work/project/service/wtools/.agents/skills/commit/commit.sh" "feat: 모니터링 API 추가"
```
