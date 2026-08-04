[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$RunMutatingE2E,
    [switch]$SkipDependencyAudit,
    [switch]$RequireCleanWorktree
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = $PSScriptRoot
$FrontendRoot = Join-Path $RepositoryRoot "frontend"
$SecurityClosure = Join-Path $RepositoryRoot "run_part4_security_closure.ps1"
$TeacherAccessibilityClosure = Join-Path $RepositoryRoot "run_part4_teacher_accessibility_closure.ps1"

function Resolve-CommandPath {
    param([Parameter(Mandatory = $true)][string[]]$Names)

    foreach ($Name in $Names) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($null -ne $Command) {
            return $Command.Source
        }
    }

    throw "Required command was not found: $($Names -join ', ')"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Host ("> {0} {1}" -f $FilePath, ($Arguments -join " ")) -ForegroundColor Cyan
    & $FilePath @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw ("Command failed with exit code {0}: {1} {2}" -f `
            $LASTEXITCODE, $FilePath, ($Arguments -join " "))
    }
}

function Assert-RepositoryHygiene {
    param([Parameter(Mandatory = $true)][string]$Git)

    Push-Location $RepositoryRoot
    try {
        Invoke-Checked -FilePath $Git -Arguments @("diff", "--check")

        $TrackedFiles = @(& $Git "ls-files")
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to inspect tracked repository files."
        }

        $ForbiddenExact = @(
            "frontend/.env.e2e",
            "backend/.coverage"
        )

        $ForbiddenPrefixes = @(
            "frontend/playwright/.auth/",
            "frontend/playwright-report/",
            "frontend/test-results/",
            "frontend/coverage/",
            "backend/coverage-html/"
        )

        $ForbiddenNamePatterns = @(
            "word-count-audit-*.json",
            "evidence-encryption-audit-*.json",
            "evidence-encryption-migration-*.json"
        )

        $Violations = New-Object System.Collections.Generic.List[string]

        foreach ($TrackedFile in $TrackedFiles) {
            $Normalized = $TrackedFile.Replace("\", "/")

            if ($ForbiddenExact -contains $Normalized) {
                $Violations.Add($Normalized)
                continue
            }

            if ($ForbiddenPrefixes | Where-Object { $Normalized.StartsWith($_) }) {
                $Violations.Add($Normalized)
                continue
            }

            $LeafName = Split-Path $Normalized -Leaf
            foreach ($Pattern in $ForbiddenNamePatterns) {
                if ($LeafName -like $Pattern) {
                    $Violations.Add($Normalized)
                    break
                }
            }
        }

        if ($Violations.Count -gt 0) {
            throw (
                "Generated or secret-bearing files are tracked:`n - " +
                (($Violations | Sort-Object -Unique) -join "`n - ")
            )
        }

        if ($RequireCleanWorktree) {
            $Status = @(& $Git "status" "--porcelain")
            if ($LASTEXITCODE -ne 0) {
                throw "Unable to inspect the Git worktree."
            }
            if ($Status.Count -gt 0) {
                throw "The worktree is not clean. Commit or stash intended changes first."
            }
        }
    }
    finally {
        Pop-Location
    }
}

$Git = Resolve-CommandPath -Names @("git.exe", "git")
$Npm = Resolve-CommandPath -Names @("npm.cmd", "npm")

Write-Host "Repository root: $RepositoryRoot"
Write-Host "== Part 4G final non-deployment closure ==" -ForegroundColor Yellow
Write-Host "This script validates the local repository only. It does not deploy, publish, push, or modify cloud infrastructure."

Assert-RepositoryHygiene -Git $Git

if (-not (Test-Path $SecurityClosure -PathType Leaf)) {
    throw "Security closure script was not found: $SecurityClosure"
}

$SecurityArguments = @()
if ($RunMutatingE2E) {
    $SecurityArguments += "-RunMutatingE2E"
}

Write-Host "== Security, privacy, ownership, and evidence closure =="
& $SecurityClosure @SecurityArguments
if ($LASTEXITCODE -ne 0) {
    throw "Part 4 security closure failed."
}

if (-not (Test-Path $TeacherAccessibilityClosure -PathType Leaf)) {
    throw "Teacher/accessibility closure script was not found: $TeacherAccessibilityClosure"
}

$TeacherArguments = @("-RunFullBrowserSuite")
if ($SkipInstall) {
    $TeacherArguments += "-SkipInstall"
}

Write-Host "== Responsive, teacher, accessibility, and browser closure =="
& $TeacherAccessibilityClosure @TeacherArguments
if ($LASTEXITCODE -ne 0) {
    throw "Part 4 teacher/accessibility closure failed."
}

if (-not $SkipDependencyAudit) {
    Push-Location $FrontendRoot
    try {
        Invoke-Checked -FilePath $Npm -Arguments @("audit", "--audit-level=high")
    }
    finally {
        Pop-Location
    }
}

Assert-RepositoryHygiene -Git $Git

Write-Host ""
Write-Host "TypeTrace final non-deployment closure passed." -ForegroundColor Green
Write-Host "No deployment was performed."
Write-Host "Before pushing: rotate any credentials previously exposed outside the ignored local .env.e2e file, review git status, and create the final tagged release commit."
