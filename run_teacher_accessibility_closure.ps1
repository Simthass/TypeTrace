[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$RunFullBrowserSuite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepositoryRoot = $PSScriptRoot
$FrontendRoot = Join-Path $RepositoryRoot "frontend"

function Resolve-CommandPath {
    param([Parameter(Mandatory = $true)][string[]]$Names)

    foreach ($Name in $Names) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($null -ne $Command) {
            return $Command.Source
        }
    }

    throw "Required command was not found: $($Names -join ', ')"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Host ("> {0} {1}" -f $FilePath, ($Arguments -join " ")) -ForegroundColor Cyan
    & $FilePath @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw ("Command failed with exit code {0}: {1} {2}" -f `
            $LASTEXITCODE, $FilePath, ($Arguments -join " "))
    }
}

if (-not (Test-Path $FrontendRoot -PathType Container)) {
    throw "Frontend directory was not found: $FrontendRoot"
}

$Npm = Resolve-CommandPath -Names @("npm.cmd", "npm")
$Npx = Resolve-CommandPath -Names @("npx.cmd", "npx")

Write-Host "Repository root: $RepositoryRoot"
Write-Host "== Part 4E/4F teacher responsive and accessibility gates =="

Push-Location $FrontendRoot
try {
    if (-not $SkipInstall) {
        Invoke-Checked -FilePath $Npm -Arguments @("ci")
    }

    Invoke-Checked -FilePath $Npm -Arguments @("run", "test", "--", "--coverage")
    Invoke-Checked -FilePath $Npm -Arguments @("run", "lint")
    Invoke-Checked -FilePath $Npm -Arguments @("run", "build")

    Invoke-Checked -FilePath $Npx -Arguments @(
        "playwright",
        "test",
        "--project=chromium-mobile-responsive",
        "--project=chromium-tablet-responsive",
        "--project=chromium-accessibility"
    )

    if ($RunFullBrowserSuite) {
        Invoke-Checked -FilePath $Npx -Arguments @("playwright", "test")
    }
}
finally {
    Pop-Location
}

Write-Host "Part 4E/4F teacher responsive and accessibility closure passed." -ForegroundColor Green
