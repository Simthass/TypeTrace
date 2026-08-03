param(
  [switch]$SkipInstall,
  [switch]$RunFullBrowserSuite
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $repositoryRoot "frontend"

if (-not (Test-Path $frontendRoot)) {
  throw ("Frontend directory was not found: {0}" -f $frontendRoot)
}

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$npxCommand = (Get-Command npx.cmd -ErrorAction Stop).Source

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  Write-Host ("> {0} {1}" -f $FilePath, ($Arguments -join " ")) -ForegroundColor Cyan

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  if ($exitCode -ne 0) {
    throw (
      "Command failed with exit code {0}: {1} {2}" -f
        $exitCode,
        $FilePath,
        ($Arguments -join " ")
    )
  }
}

Write-Host ("Repository root: {0}" -f $repositoryRoot) -ForegroundColor Green
Write-Host "== Part 4C/4D responsive foundation and student/public gates ==" -ForegroundColor Yellow

if (-not $SkipInstall) {
  Invoke-NativeChecked `
    -FilePath $npmCommand `
    -Arguments @("ci") `
    -WorkingDirectory $frontendRoot
}

Invoke-NativeChecked `
  -FilePath $npmCommand `
  -Arguments @("run", "test", "--", "--coverage") `
  -WorkingDirectory $frontendRoot

Invoke-NativeChecked `
  -FilePath $npmCommand `
  -Arguments @("run", "lint") `
  -WorkingDirectory $frontendRoot

Invoke-NativeChecked `
  -FilePath $npmCommand `
  -Arguments @("run", "build") `
  -WorkingDirectory $frontendRoot

Invoke-NativeChecked `
  -FilePath $npxCommand `
  -Arguments @(
    "playwright",
    "test",
    "--project=chromium-mobile-responsive",
    "--project=chromium-tablet-responsive"
  ) `
  -WorkingDirectory $frontendRoot

if ($RunFullBrowserSuite) {
  Invoke-NativeChecked `
    -FilePath $npxCommand `
    -Arguments @("playwright", "test") `
    -WorkingDirectory $frontendRoot
}

Write-Host "Part 4C/4D responsive closure passed." -ForegroundColor Green
