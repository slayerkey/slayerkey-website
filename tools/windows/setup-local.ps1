param(
    [string]$Path = "D:\Slayerkey-Website"
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/slayerkey/slayerkey-website.git"

function Run-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or is not on PATH. Install Git for Windows, then run this again."
}

$driveRoot = [System.IO.Path]::GetPathRoot($Path)
if (-not (Test-Path $driveRoot)) {
    throw "Drive $driveRoot is not available. Connect/enable the D: drive or pass a different -Path."
}

if (-not (Test-Path $Path)) {
    Write-Host "Cloning Slayerkey Website to $Path ..."
    Run-Git clone $RepoUrl $Path
} elseif (-not (Test-Path (Join-Path $Path ".git"))) {
    throw "$Path already exists but is not a Git repository. Move/rename it or choose a different -Path."
}

Set-Location $Path

$currentOrigin = (& git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0) {
    Run-Git remote add origin $RepoUrl
} elseif ($currentOrigin.Trim() -ne $RepoUrl) {
    Run-Git remote set-url origin $RepoUrl
}

Run-Git fetch origin
$currentBranch = (& git branch --show-current).Trim()
if ($currentBranch -ne "main") {
    Run-Git checkout main
}

$dirty = (& git status --porcelain)
if ($dirty) {
    Write-Warning "Local edits already exist, so setup did not pull over them. Use PUSH TO GITHUB.cmd after reviewing your changes."
} else {
    Run-Git pull --ff-only origin main
}

Write-Host ""
Write-Host "READY: $Path"
Write-Host "GitHub is the source of truth."
Write-Host "Before editing: double-click PULL FROM GITHUB.cmd"
Write-Host "After editing:  double-click PUSH TO GITHUB.cmd"
