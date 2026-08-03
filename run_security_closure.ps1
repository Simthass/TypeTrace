[CmdletBinding()]
param(
  [switch]$RunMutatingE2E
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-TypeTraceRepositoryRoot {
  $candidatePaths = @(
    $PSScriptRoot,
    (Split-Path -Parent $PSScriptRoot),
    (Get-Location).Path
  )

  foreach ($candidatePath in ($candidatePaths | Select-Object -Unique)) {
    if ([string]::IsNullOrWhiteSpace($candidatePath)) {
      continue
    }

    if (
      (Test-Path -LiteralPath (Join-Path $candidatePath "frontend\package.json") -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $candidatePath "backend\app") -PathType Container)
    ) {
      return (Resolve-Path -LiteralPath $candidatePath).Path
    }
  }

  throw (
    "Could not locate the TypeTrace repository root. Expected both " +
    "'frontend\package.json' and 'backend\app'. Script directory: '$PSScriptRoot'."
  )
}

function Resolve-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Names
  )

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $command) {
      return $command.Source
    }
  }

  throw "Required command was not found: $($Names -join ', ')."
}

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $false)]
    [string[]]$Arguments = @()
  )

  Write-Host "> $FilePath $($Arguments -join ' ')" -ForegroundColor DarkGray
  & $FilePath @Arguments

  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw (
      "Command failed with exit code {0}: {1} {2}" -f
        $exitCode,
        $FilePath,
        ($Arguments -join " ")
    )
  }
}

$root = Resolve-TypeTraceRepositoryRoot
$frontend = Join-Path $root "frontend"
$backend = Join-Path $root "backend"
$python = Join-Path $backend "venv\Scripts\python.exe"
$packageLock = Join-Path $frontend "package-lock.json"
$e2eEnvironment = Join-Path $frontend ".env.e2e"

Write-Host "Repository root: $root" -ForegroundColor DarkCyan

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
  throw "Backend virtual environment not found at '$python'."
}

if (-not (Test-Path -LiteralPath $packageLock -PathType Leaf)) {
  throw "frontend\package-lock.json is required because the gate uses npm ci."
}

if ($RunMutatingE2E -and -not (Test-Path -LiteralPath $e2eEnvironment -PathType Leaf)) {
  throw (
    "Mutating Playwright configuration not found at '$e2eEnvironment'. " +
    "Create it from frontend\.env.e2e.example using disposable accounts."
  )
}

$npm = Resolve-NativeCommand -Names @("npm.cmd", "npm")
$npx = Resolve-NativeCommand -Names @("npx.cmd", "npx")
$git = Resolve-NativeCommand -Names @("git.exe", "git")

$previousRedisIntegrationSetting =
  [Environment]::GetEnvironmentVariable("RUN_REDIS_INTEGRATION_TESTS", "Process")
$previousMutatingWorkflowSetting =
  [Environment]::GetEnvironmentVariable("E2E_MUTATING_WORKFLOW", "Process")

try {
  Write-Host "== Repository secret-tracking checks ==" -ForegroundColor Cyan
  Push-Location $root
  try {
    $trackedE2eEnvironment = & $git ls-files -- "frontend/.env.e2e"
    if ($LASTEXITCODE -ne 0) {
      throw "git ls-files failed with exit code $LASTEXITCODE."
    }
    if (-not [string]::IsNullOrWhiteSpace(($trackedE2eEnvironment -join ""))) {
      throw "frontend/.env.e2e is tracked by Git. Remove it and rotate its values."
    }

    $trackedAuthState = & $git ls-files -- "frontend/playwright/.auth/*"
    if ($LASTEXITCODE -ne 0) {
      throw "git ls-files failed with exit code $LASTEXITCODE."
    }
    if (-not [string]::IsNullOrWhiteSpace(($trackedAuthState -join ""))) {
      throw "Generated Playwright authentication state is tracked by Git."
    }
  }
  finally {
    Pop-Location
  }

  Write-Host "== Backend correctness, privacy, and ownership gates ==" -ForegroundColor Cyan
  Push-Location $backend
  try {
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "compileall", "app", "scripts", "tests"
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-c", "from app.main import app; print(f'FastAPI import gate passed: {app.title}')"
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "alembic", "upgrade", "head"
    )

    $env:RUN_REDIS_INTEGRATION_TESTS = "1"
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "coverage", "erase"
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "coverage", "run", "-m", "unittest", "discover", "-s", "tests", "-v"
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "coverage", "report", "-m"
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "coverage", "html", "-d", "coverage-html"
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "scripts.audit_word_counts",
      "--report", (Join-Path $backend "word-count-audit-part4.json")
    )
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "scripts.audit_evidence_encryption",
      "--report", (Join-Path $backend "evidence-encryption-audit-part4.json")
    )
  }
  finally {
    Pop-Location
  }

  Write-Host "== Frontend correctness and browser gates ==" -ForegroundColor Cyan
  Push-Location $frontend
  try {
    Invoke-NativeChecked -FilePath $npm -Arguments @("ci")
    Invoke-NativeChecked -FilePath $npm -Arguments @("run", "test", "--", "--coverage")
    Invoke-NativeChecked -FilePath $npm -Arguments @("run", "lint")
    Invoke-NativeChecked -FilePath $npm -Arguments @("run", "build")
    Invoke-NativeChecked -FilePath $npm -Arguments @("audit", "--audit-level=high")

    $env:E2E_MUTATING_WORKFLOW = if ($RunMutatingE2E) { "true" } else { "false" }
    Invoke-NativeChecked -FilePath $npx -Arguments @("playwright", "test")
  }
  finally {
    Pop-Location
  }

  Write-Host "Part 4A/4B correctness and security gate passed." -ForegroundColor Green
}
finally {
  if ($null -eq $previousRedisIntegrationSetting) {
    Remove-Item Env:RUN_REDIS_INTEGRATION_TESTS -ErrorAction SilentlyContinue
  }
  else {
    $env:RUN_REDIS_INTEGRATION_TESTS = $previousRedisIntegrationSetting
  }

  if ($null -eq $previousMutatingWorkflowSetting) {
    Remove-Item Env:E2E_MUTATING_WORKFLOW -ErrorAction SilentlyContinue
  }
  else {
    $env:E2E_MUTATING_WORKFLOW = $previousMutatingWorkflowSetting
  }
}
