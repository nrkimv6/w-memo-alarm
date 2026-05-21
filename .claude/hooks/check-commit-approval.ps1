$ErrorActionPreference = "Stop"

function Get-CommandText {
    param([string]$Raw)

    if (-not $Raw) {
        return ""
    }

    try {
        $payload = $Raw | ConvertFrom-Json
        if ($payload.tool_input -and $payload.tool_input.command) {
            return [string]$payload.tool_input.command
        }
        if ($payload.command) {
            return [string]$payload.command
        }
    } catch {
        # Some runners pass the command directly instead of JSON.
    }

    return $Raw
}

function Get-Cwd {
    param([string]$Raw)

    try {
        $payload = $Raw | ConvertFrom-Json
        if ($payload.cwd) {
            return [string]$payload.cwd
        }
    } catch {
        return (Get-Location).Path
    }

    return (Get-Location).Path
}

function Get-RepoRoot {
    param([string]$Cwd)

    Push-Location $Cwd
    try {
        $root = git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $root) {
            return ($root | Select-Object -First 1)
        }
    } finally {
        Pop-Location
    }

    return $Cwd
}

function Test-CommitCommand {
    param([string]$CommandText)

    $patterns = @(
        '\bgit\s+commit\b',
        '(^|[\s''"`;&|])(?:\.?[\\/])?commit\.(ps1|sh)\b',
        'common[\\/]commit\.(ps1|sh)\b'
    )

    foreach ($pattern in $patterns) {
        if ($CommandText -match $pattern) {
            return $true
        }
    }

    return $false
}

function Get-ValidTokens {
    param(
        [string]$ApprovalDir,
        [int64]$Now
    )

    if (-not (Test-Path -LiteralPath $ApprovalDir)) {
        return @()
    }

    $valid = @()
    Get-ChildItem -LiteralPath $ApprovalDir -Filter "*.token" -File | ForEach-Object {
        if ($_.BaseName -match '^(\d+)_') {
            $issuedAt = [int64]$Matches[1]
            if (($Now - $issuedAt) -le 60) {
                $valid += [pscustomobject]@{ Path = $_.FullName; IssuedAt = $issuedAt }
            } else {
                Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
            }
        }
    }

    return $valid | Sort-Object IssuedAt, Path
}

$raw = [Console]::In.ReadToEnd()
$commandText = Get-CommandText -Raw $raw

if (-not (Test-CommitCommand -CommandText $commandText)) {
    exit 0
}

$repoRoot = Get-RepoRoot -Cwd (Get-Cwd -Raw $raw)
$approvalDir = Join-Path $repoRoot ".claude\commit-approval"
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$tokens = Get-ValidTokens -ApprovalDir $approvalDir -Now $now

foreach ($token in $tokens) {
    try {
        Remove-Item -LiteralPath $token.Path -Force -ErrorAction Stop
        Write-Host ("commit-approval-consumed: {0}" -f (Split-Path $token.Path -Leaf))
        exit 0
    } catch {
        # Another hook invocation may have consumed this token first.
    }
}

Write-Host ""
Write-Host "[BLOCKED] commit requires explicit approval sentinel." -ForegroundColor Red
Write-Host "Run .claude\hooks\grant-commit.ps1 --reason ""user-prompt:<요약 30자 이상>"" immediately before commit.ps1/commit.sh." -ForegroundColor Yellow
Write-Host "Matched command: $commandText" -ForegroundColor DarkYellow
exit 1
