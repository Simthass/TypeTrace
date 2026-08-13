[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$RunFullBrowserSuite,
  [switch]$RequireRedisIntegration,
  [string]$RedisTestUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Python = Join-Path $Root "backend\venv\Scripts\python.exe"
$Runner = Join-Path $Root "run_comprehensive_test_coverage.py"

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
  throw "Backend virtual environment not found at '$Python'."
}
if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) {
  throw "Coverage runner not found at '$Runner'."
}

$RunnerArguments = @()

if ($SkipInstall) {
  $RunnerArguments += "--skip-install"
}
if ($RunFullBrowserSuite) {
  $RunnerArguments += "--run-full-browser-suite"
}
if ($RequireRedisIntegration) {
  $RunnerArguments += "--require-redis-integration"
}
if (-not [string]::IsNullOrWhiteSpace($RedisTestUrl)) {
  $RunnerArguments += @("--redis-test-url", $RedisTestUrl)
}

& $Python $Runner @RunnerArguments
exit $LASTEXITCODE
