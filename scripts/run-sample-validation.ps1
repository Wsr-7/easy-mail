$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root "data"
$digestPath = Join-Path $dataDir "mail-digest.md"

if (-not (Test-Path $dataDir)) {
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
}

$collector = Join-Path $PSScriptRoot "collect-outlook-mails.vbs"
cscript.exe //nologo $collector --sample --output $digestPath
Push-Location $root
try {
  & npm.cmd run compile
  node --test out/test/digest.test.js out/test/analysis-schema.test.js out/test/summary.test.js out/test/dashboard-state.test.js
} finally {
  Pop-Location
}

Write-Output "Sample validation complete."
Write-Output $digestPath
