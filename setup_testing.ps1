$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Installing backend test dependencies..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "backend")
try {
    if (-not (Test-Path ".\venv\Scripts\python.exe")) {
        throw "backend\venv was not found. Create and activate the backend environment first."
    }

    .\venv\Scripts\python.exe -m pip install -r requirements-test.txt
}
finally {
    Pop-Location
}

Write-Host "Installing frontend test dependencies..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "frontend")
try {
    npm install --save-dev `
        vitest `
        jsdom `
        @vitest/coverage-v8 `
        @testing-library/react `
        @testing-library/jest-dom `
        @testing-library/user-event

    npm pkg set "scripts.test=vitest run"
    npm pkg set "scripts.test:watch=vitest"
    npm pkg set "scripts.test:coverage=vitest run --coverage"
}
finally {
    Pop-Location
}

Write-Host "Testing dependencies and npm scripts are ready." -ForegroundColor Green
