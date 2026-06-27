# Copies strategy catalog from OceanView-API (single source of truth).
param(
  [string]$ApiRoot = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\OceanView-API"),
  [string]$Dest = (Join-Path (Split-Path $PSScriptRoot -Parent) "data\strategies.json")
)

$source = Join-Path $ApiRoot "data\strategies.json"
if (-not (Test-Path $source)) {
  throw "Source not found: $source`nSet -ApiRoot to your OceanView-API clone."
}

Copy-Item -Path $source -Destination $Dest -Force
Write-Host "Synced $source -> $Dest" -ForegroundColor Green
