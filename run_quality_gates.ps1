[CmdletBinding()]
param(
    [switch]$SkipCoverage,
    [switch]$SkipBrowser,
    [switch]$RunMutatingBrowser
)

$ErrorActionPreference = "Stop"
$RepositoryRoot = (Resolve-Path $PSScriptRoot).Path
$BackendRoot = Join-Path $RepositoryRoot "backend"
$FrontendRoot = Join-Path $RepositoryRoot "frontend"

function Resolve-CommandPath {
    param([Parameter(Mandatory = $true)][string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    throw "Required command not found: $($Candidates -join ', ')"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        Write-Host "> $FilePath $($Arguments -join ' ')"
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Remove-GeneratedPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

function Get-RelativePathCompat {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$FullPath
    )

    $base = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\', '/')
    $full = [System.IO.Path]::GetFullPath($FullPath)

    if (-not $full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path '$FullPath' is not under base path '$BasePath'."
    }

    return $full.Substring($base.Length).TrimStart('\', '/')
}

function Assert-RepositoryNaming {
    $excludedDirectories = @(
        ".git",
        ".idea",
        ".vscode",
        "node_modules",
        "dist",
        "coverage",
        "coverage-html-app",
        "htmlcov",
        "venv",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        "playwright-report",
        "test-results"
    )
    $legacyPattern = '(?i)(^|[._-])(part\d*[a-z]?|wave\d*)(?=([._-]|$))'

    $legacyPaths = @(
        Get-ChildItem -LiteralPath $RepositoryRoot -Recurse -File -Force |
            Where-Object {
                $relative = Get-RelativePathCompat -BasePath $RepositoryRoot -FullPath $_.FullName
                $segments = $relative -split '[\\/]'
                -not ($segments | Where-Object { $excludedDirectories -contains $_ })
            } |
            ForEach-Object {
                $relative = Get-RelativePathCompat -BasePath $RepositoryRoot -FullPath $_.FullName
                if ($relative -match $legacyPattern) {
                    $relative
                }
            } |
            Sort-Object -Unique
    )

    if ($legacyPaths.Count -gt 0) {
        Write-Host "Legacy milestone-oriented filenames remain:" -ForegroundColor Red
        $legacyPaths | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
        throw "Repository naming gate failed."
    }

    Write-Host "Repository naming gate passed."
}

function Assert-RepositoryCleanup {
    $deprecatedPaths = @(
        "frontend\vitest.comprehensive.config.ts",
        "frontend\src\components\ui\Card.tsx",
        "frontend\src\components\ui\ResponsiveDataView.tsx",
        "frontend\src\types\account.ts",
        "frontend\src\__tests__\ResponsiveFoundation.test.tsx",
        "frontend\src\__tests__\editorDraftStoreComprehensive.test.ts",
        "backend\tests\test_coverage_certificate_signing.py",
        "backend\tests\test_coverage_email.py",
        "backend\tests\test_coverage_repositories.py",
        "run_capture_gates.ps1",
        "run_accessibility_gates.ps1",
        "scripts\normalize_repository_names.ps1",
        "scripts\check_repository_naming.ps1"
    )

    $remaining = @(
        $deprecatedPaths | Where-Object {
            Test-Path -LiteralPath (Join-Path $RepositoryRoot $_)
        }
    )

    if ($remaining.Count -gt 0) {
        Write-Host "Superseded/dead files still exist:" -ForegroundColor Red
        $remaining | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
        throw "Repository cleanup gate failed. Remove the listed files."
    }

    Write-Host "Repository cleanup gate passed."
}

function Assert-GitHygiene {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "Git not available; Git tracking checks skipped."
        return
    }

    Push-Location $RepositoryRoot
    try {
        $secretPaths = @(
            "frontend/.env.e2e",
            "frontend/playwright/.auth/student.json",
            "frontend/playwright/.auth/teacher.json"
        )
        $trackedSecrets = @()
        foreach ($path in $secretPaths) {
            # Use plain git ls-files; it does not produce an error for untracked paths
            $output = git ls-files -- $path
            if ($output) {
                $trackedSecrets += $path
            }
        }

        if ($trackedSecrets.Count -gt 0) {
            throw "Sensitive E2E files are tracked by Git: $($trackedSecrets -join ', ')"
        }

        $generatedPathSpecs = @(
            "backend/.coverage",
            "backend/coverage-app.json",
            "backend/coverage-html-app",
            "frontend/coverage",
            "frontend/dist",
            "frontend/test-results",
            "frontend/playwright-report",
            "frontend/playwright/.auth"
        )
        $trackedGenerated = @()
        foreach ($pathSpec in $generatedPathSpecs) {
            $matches = @(git ls-files -- $pathSpec)
            if ($matches.Count -gt 0) {
                $trackedGenerated += $matches
            }
        }
        $trackedGenerated = @($trackedGenerated | Sort-Object -Unique)

        if ($trackedGenerated.Count -gt 0) {
            Write-Host "Generated artifacts are tracked by Git:" -ForegroundColor Red
            $trackedGenerated | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
            throw "Git generated-artifact hygiene gate failed."
        }

        git diff --check
        if ($LASTEXITCODE -ne 0) {
            throw "git diff --check reported whitespace errors."
        }

        Write-Host "Git secret/generated-artifact hygiene gate passed."
    }
    finally {
        Pop-Location
    }
}

Write-Host "Repository root: $RepositoryRoot"
Write-Host "Quality scope: repository hygiene, backend contracts/ML smoke, frontend unit coverage, lint/build, and browser workflows."

Write-Host "`n== Repository hygiene =="
Assert-RepositoryNaming
Assert-RepositoryCleanup
Assert-GitHygiene

Write-Host "`n== Remove stale generated test/build output =="
@(
    (Join-Path $BackendRoot ".coverage"),
    (Join-Path $BackendRoot "coverage-app.json"),
    (Join-Path $BackendRoot "coverage-html-app"),
    (Join-Path $FrontendRoot "coverage"),
    (Join-Path $FrontendRoot "dist"),
    (Join-Path $FrontendRoot "test-results"),
    (Join-Path $FrontendRoot "playwright-report")
) | ForEach-Object { Remove-GeneratedPath $_ }
Write-Host "Stale generated output removed."

$pythonCandidates = @(
    (Join-Path $BackendRoot "venv\Scripts\python.exe"),
    (Join-Path $BackendRoot ".venv\Scripts\python.exe"),
    "python"
)
$Python = $null
foreach ($candidate in $pythonCandidates) {
    if (Test-Path -LiteralPath $candidate) {
        $Python = (Resolve-Path $candidate).Path
        break
    }
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command) {
        $Python = $command.Source
        break
    }
}
if (-not $Python) {
    throw "Python interpreter not found."
}

$Npm = Resolve-CommandPath -Candidates @("npm.cmd", "npm.ps1", "npm")
$Npx = Resolve-CommandPath -Candidates @("npx.cmd", "npx.ps1", "npx")

Write-Host "`n== Backend syntax =="
Invoke-Checked $Python @("-m", "compileall", "app", "scripts", "tests") $BackendRoot

Write-Host "`n== Deterministic ML regression contracts =="
Invoke-Checked $Python @(
    "-m", "unittest", "-v",
    "scripts.scoring_regression",
    "scripts.model_architecture_regression",
    "scripts.score_fusion_regression"
) $BackendRoot

Write-Host "`n== Production ML artifact smoke test =="
Invoke-Checked $Python @("-m", "scripts.ml_smoke_test") $BackendRoot

if ($SkipCoverage) {
    Write-Host "`n== Backend tests =="
    Invoke-Checked $Python @(
        "-m", "unittest", "discover", "-s", "tests", "-p", "test*.py"
    ) $BackendRoot
}
else {
    Write-Host "`n== Backend tests with runtime coverage =="
    Invoke-Checked $Python @("-m", "coverage", "erase") $BackendRoot
    Invoke-Checked $Python @(
        "-m", "coverage", "run", "--rcfile=.coveragerc",
        "-m", "unittest", "discover", "-s", "tests", "-p", "test*.py"
    ) $BackendRoot
    Invoke-Checked $Python @(
        "-m", "coverage", "report", "--rcfile=.coveragerc"
    ) $BackendRoot
    Invoke-Checked $Python @(
        "-m", "coverage", "json", "--rcfile=.coveragerc", "-o", "coverage-app.json"
    ) $BackendRoot
    Invoke-Checked $Python @(
        "-m", "coverage", "html", "--rcfile=.coveragerc", "-d", "coverage-html-app"
    ) $BackendRoot
}

Write-Host "`n== Frontend unit tests =="
if ($SkipCoverage) {
    Invoke-Checked $Npx @("vitest", "run", "--config", "vitest.config.ts") $FrontendRoot
}
else {
    Invoke-Checked $Npx @(
        "vitest", "run", "--config", "vitest.config.ts", "--coverage"
    ) $FrontendRoot
}

Write-Host "`n== Frontend lint =="
Invoke-Checked $Npm @("run", "lint") $FrontendRoot

Write-Host "`n== Frontend production build/typecheck =="
Invoke-Checked $Npm @("run", "build") $FrontendRoot

if (-not $SkipBrowser) {
    Write-Host "`n== Browser gates =="
    $e2eEnvironment = Join-Path $FrontendRoot ".env.e2e"
    if (-not (Test-Path -LiteralPath $e2eEnvironment)) {
        throw "frontend\.env.e2e is required for authenticated browser gates. Copy .env.e2e.example and provide dedicated local E2E accounts."
    }

    $previousMutatingWorkflow = $env:E2E_MUTATING_WORKFLOW
    try {
        if ($RunMutatingBrowser) {
            $env:E2E_MUTATING_WORKFLOW = "true"
            Write-Host "Database-mutating browser workflow enabled for this run."
        }

        Invoke-Checked $Npx @("playwright", "test") $FrontendRoot
    }
    finally {
        if ($null -eq $previousMutatingWorkflow) {
            Remove-Item Env:E2E_MUTATING_WORKFLOW -ErrorAction SilentlyContinue
        }
        else {
            $env:E2E_MUTATING_WORKFLOW = $previousMutatingWorkflow
        }
    }
}
else {
    Write-Host "`nBrowser gates explicitly skipped with -SkipBrowser."
}

Write-Host "`nAll requested quality gates passed." -ForegroundColor Green