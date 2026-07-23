$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ProjectRoot "frontend"
$PackageJsonPath = Join-Path $FrontendDir "package.json"
$ExampleEnvironment = Join-Path $FrontendDir ".env.e2e.example"
$LocalEnvironment = Join-Path $FrontendDir ".env.e2e"
$GitIgnorePath = Join-Path $ProjectRoot ".gitignore"

if (-not (Test-Path $FrontendDir)) {
    throw "Frontend directory not found: $FrontendDir"
}

if (-not (Test-Path $PackageJsonPath)) {
    throw "package.json not found: $PackageJsonPath"
}

Push-Location $FrontendDir
try {
    Write-Host "Installing Playwright test dependencies..."
    npm install --save-dev @playwright/test dotenv
    if ($LASTEXITCODE -ne 0) {
        throw "npm dependency installation failed."
    }

    Write-Host "Installing Chromium, Firefox and WebKit..."
    npx playwright install chromium firefox webkit
    if ($LASTEXITCODE -ne 0) {
        throw "Playwright browser installation failed."
    }

    Write-Host "Adding npm scripts..."

    $PackageJson = Get-Content -Path $PackageJsonPath -Raw | ConvertFrom-Json

    if ($null -eq $PackageJson.scripts) {
        $PackageJson | Add-Member `
            -MemberType NoteProperty `
            -Name scripts `
            -Value ([pscustomobject]@{})
    }

    $PlaywrightScripts = [ordered]@{
        "test:e2e" = "playwright test"
        "test:e2e:public" = "playwright test e2e/public-cross-browser.spec.ts --project=chromium-public --project=firefox-public --project=webkit-public"
        "test:e2e:workflow" = "playwright test e2e/full-workflow.spec.ts --project=chromium-e2e"
        "test:e2e:headed" = "playwright test --project=chromium-e2e --headed"
        "test:e2e:ui" = "playwright test --ui"
        "test:e2e:report" = "playwright show-report playwright-report"
    }

    foreach ($Entry in $PlaywrightScripts.GetEnumerator()) {
        $PackageJson.scripts | Add-Member `
            -MemberType NoteProperty `
            -Name $Entry.Key `
            -Value $Entry.Value `
            -Force
    }

    $UpdatedJson = $PackageJson | ConvertTo-Json -Depth 100
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        $PackageJsonPath,
        $UpdatedJson + [Environment]::NewLine,
        $Utf8NoBom
    )

    Write-Host "Playwright npm scripts added successfully."
}
finally {
    Pop-Location
}

if (-not (Test-Path $ExampleEnvironment)) {
    throw "Environment example not found: $ExampleEnvironment"
}

if (-not (Test-Path $LocalEnvironment)) {
    Copy-Item $ExampleEnvironment $LocalEnvironment
    Write-Host ""
    Write-Host "Created frontend/.env.e2e from the example."
    Write-Host "Add dedicated student and teacher test credentials before running the full suite."
}
else {
    Write-Host "frontend/.env.e2e already exists; it was not overwritten."
}

$GitIgnoreBlock = @"

# ── Playwright end-to-end testing ─────────────────────────────────────────────
frontend/.env.e2e
!frontend/.env.e2e.example
frontend/playwright/.auth/
frontend/playwright-report/
frontend/test-results/
"@

if (Test-Path $GitIgnorePath) {
    $CurrentGitIgnore = Get-Content $GitIgnorePath -Raw

    if ($CurrentGitIgnore -notmatch "Playwright end-to-end testing") {
        Add-Content -Path $GitIgnorePath -Value $GitIgnoreBlock
        Write-Host "Added Playwright generated paths to .gitignore."
    }
    else {
        Write-Host "Playwright .gitignore entries already exist."
    }
}
else {
    [System.IO.File]::WriteAllText(
        $GitIgnorePath,
        $GitIgnoreBlock.TrimStart() + [Environment]::NewLine,
        (New-Object System.Text.UTF8Encoding($false))
    )
    Write-Host "Created .gitignore with Playwright generated paths."
}

Write-Host ""
Write-Host "Playwright setup is complete."
Write-Host "Next command: .\run_e2e.ps1 -Mode public"