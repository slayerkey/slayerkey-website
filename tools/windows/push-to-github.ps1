param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Run-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

Set-Location $RepoRoot

if (-not (Test-Path ".git")) {
    throw "$RepoRoot is not a Git repository."
}

$currentBranch = (& git branch --show-current).Trim()
if ($currentBranch -ne "main") {
    throw "Expected branch 'main' but found '$currentBranch'. Switch to main before using the simple push workflow."
}

Write-Host "Syncing with GitHub before publishing local edits..."
Run-Git pull --rebase --autostash origin main

Run-Git add -A
& git diff --cached --quiet
$hasChanges = ($LASTEXITCODE -ne 0)

if ($hasChanges) {
    if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = Read-Host "Commit message (press Enter for a timestamped website update)"
    }
    if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = "Update website $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }

    Run-Git commit -m $Message
} else {
    Write-Host "No uncommitted file changes found. Checking for existing local commits to push..."
}

Run-Git push origin main
$sha = (& git rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host "PUSHED: $sha -> GitHub main" -ForegroundColor Green
Write-Host "GitHub Actions will test and deploy the website to EasyWP automatically."
