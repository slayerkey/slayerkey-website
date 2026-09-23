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

$dirty = (& git status --porcelain)
if ($dirty) {
    Write-Host "Local edits were found:" -ForegroundColor Yellow
    & git status --short
    throw "Nothing was overwritten. Push/commit your local edits before pulling from GitHub."
}

$currentBranch = (& git branch --show-current).Trim()
if ($currentBranch -ne "main") {
    throw "Expected branch 'main' but found '$currentBranch'. Switch to main before using the simple sync workflow."
}

Run-Git fetch origin
Run-Git pull --ff-only origin main
$sha = (& git rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host "SYNCED: GitHub main -> $RepoRoot ($sha)" -ForegroundColor Green
