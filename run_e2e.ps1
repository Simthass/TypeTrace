param(
    [ValidateSet("all", "public", "workflow", "headed", "ui")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ProjectRoot "frontend"
$EnvironmentFile = Join-Path $FrontendDir ".env.e2e"

if (-not (Test-Path $FrontendDir)) {
    throw "Frontend directory not found: $FrontendDir"
}

if ($Mode -ne "public" -and -not (Test-Path $EnvironmentFile)) {
    throw "frontend/.env.e2e is missing. Run .\\setup_e2e.ps1 and configure dedicated test accounts."
}

$ScriptName = switch ($Mode) {
    "all" { "test:e2e" }
    "public" { "test:e2e:public" }
    "workflow" { "test:e2e:workflow" }
    "headed" { "test:e2e:headed" }
    "ui" { "test:e2e:ui" }
}

Push-Location $FrontendDir
try {
    Write-Host "Running TypeTrace end-to-end mode: $Mode"
    npm run $ScriptName

    if ($LASTEXITCODE -ne 0) {
        throw "The TypeTrace end-to-end suite failed."
    }

    Write-Host "TypeTrace end-to-end suite passed."
}
finally {
    Pop-Location
}
