[CmdletBinding()]
param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "restore_backend_test_baseline.ps1 is deprecated by Part 5A Hotfix 04." -ForegroundColor Yellow
Write-Host "The deterministic baseline files are delivered directly by the Hotfix 04 overlay." -ForegroundColor Green
Write-Host "No Git-history recovery is required." -ForegroundColor Green
Write-Host ""
Write-Host "Run the comprehensive gate instead:" -ForegroundColor Cyan
Write-Host "  .\run_comprehensive_test_coverage.ps1 -SkipInstall -RunFullBrowserSuite" -ForegroundColor Cyan
exit 0
