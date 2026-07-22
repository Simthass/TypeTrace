Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Assert-LastCommandSucceeded {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Running backend automated tests..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "backend")
try {
    & .\venv\Scripts\python.exe -m scripts.run_regression_suite
    Assert-LastCommandSucceeded -Step "Backend automated tests"
}
finally {
    Pop-Location
}

Write-Host "Running frontend unit tests..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "frontend")
try {
    & npm run test
    Assert-LastCommandSucceeded -Step "Frontend unit tests"

    & npm run lint
    Assert-LastCommandSucceeded -Step "Frontend lint"

    & npm run build
    Assert-LastCommandSucceeded -Step "Frontend production build"
}
finally {
    Pop-Location
}

Write-Host "TypeTrace quality gate passed." -ForegroundColor Green
