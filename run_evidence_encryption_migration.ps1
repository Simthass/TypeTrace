[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$ConfirmDatabaseBackup
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

  throw "Could not locate the TypeTrace repository root."
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
$backend = Join-Path $root "backend"
$python = Join-Path $backend "venv\Scripts\python.exe"
$planReport = Join-Path $backend "evidence-encryption-migration-plan.json"
$applyReport = Join-Path $backend "evidence-encryption-migration-result.json"
$auditReport = Join-Path $backend "evidence-encryption-audit-part4.json"

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
  throw "Backend virtual environment not found at '$python'."
}

if ($Apply -and -not $ConfirmDatabaseBackup) {
  throw (
    "Apply mode requires -ConfirmDatabaseBackup. Stop the API, take a verified " +
    "database backup, then rerun with both switches."
  )
}

Push-Location $backend
try {
  if (-not $Apply) {
    Write-Host "Running read-only historical encryption migration plan." -ForegroundColor Cyan
    Invoke-NativeChecked -FilePath $python -Arguments @(
      "-m", "scripts.migrate_evidence_encryption",
      "--report", $planReport
    )
    Write-Host "Dry-run plan written to: $planReport" -ForegroundColor Green
    return
  }

  Write-Host "Applying atomic historical evidence migration." -ForegroundColor Yellow
  Invoke-NativeChecked -FilePath $python -Arguments @(
    "-m", "scripts.migrate_evidence_encryption",
    "--apply",
    "--confirm-database-backup",
    "--report", $applyReport
  )

  Invoke-NativeChecked -FilePath $python -Arguments @(
    "-m", "scripts.audit_evidence_encryption",
    "--report", $auditReport
  )

  Write-Host "Historical evidence migration and post-audit passed." -ForegroundColor Green
}
finally {
  Pop-Location
}
