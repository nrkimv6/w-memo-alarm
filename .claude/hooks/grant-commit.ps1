param(
    [string]$Reason
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    $root = git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and $root) {
        return ($root | Select-Object -First 1)
    }
    return (Get-Location).Path
}

function Get-UnixTime {
    return [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}

function Remove-ExpiredTokens {
    param(
        [string]$ApprovalDir,
        [int64]$Now
    )

    if (-not (Test-Path -LiteralPath $ApprovalDir)) {
        return
    }

    Get-ChildItem -LiteralPath $ApprovalDir -Filter "*.token" -File | ForEach-Object {
        if ($_.BaseName -match '^(\d+)_') {
            $issuedAt = [int64]$Matches[1]
            if (($Now - $issuedAt) -gt 60) {
                Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

if (-not $Reason -or $Reason.Trim().Length -lt 30) {
    Write-Error "commit approval reason must be at least 30 characters"
    exit 1
}

$repoRoot = Get-RepoRoot
$approvalDir = Join-Path $repoRoot ".claude\commit-approval"
$now = Get-UnixTime

New-Item -ItemType Directory -Force -Path $approvalDir | Out-Null
Remove-ExpiredTokens -ApprovalDir $approvalDir -Now $now

$tokenId = [Guid]::NewGuid().ToString("N").Substring(0, 12)
$tokenPath = Join-Path $approvalDir ("{0}_{1}.token" -f $now, $tokenId)
Set-Content -LiteralPath $tokenPath -Value $Reason.Trim() -Encoding UTF8 -NoNewline

Write-Host ("commit-approval-granted: {0}" -f (Split-Path $tokenPath -Leaf))
exit 0
