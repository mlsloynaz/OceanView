# Start OceanView UI + local OceanView-API (SAM) for development.
# Usage: .\scripts\dev-local.ps1 [-ApiPort 3001] [-ApiRoot C:\Code\OceanView-API]

param(
  [int]$ApiPort = 3001,
  [string]$ApiRoot = "",
  [switch]$SkipApi
)

$ErrorActionPreference = "Stop"

$UiRoot = Split-Path $PSScriptRoot -Parent
if (-not $ApiRoot) {
  $ApiRoot = Join-Path (Split-Path $UiRoot -Parent) "OceanView-API"
}

function Test-OceanViewApiHealth {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 3
    return $response.Content -match '"service"\s*:\s*"oceanview-api"'
  } catch {
    return $false
  }
}

function Test-PortInUse {
  param([int]$Port)
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

Write-Host "OceanView local dev" -ForegroundColor Cyan
Write-Host "  UI:  $UiRoot"
Write-Host "  API: $ApiRoot (port $ApiPort)"
Write-Host ""

if (-not (Test-Path $ApiRoot)) {
  throw "OceanView-API not found at $ApiRoot. Clone it or pass -ApiRoot."
}

$samScript = Join-Path $ApiRoot "scripts\sam.ps1"
if (-not (Test-Path $samScript)) {
  throw "SAM helper not found: $samScript"
}

if (Test-OceanViewApiHealth -Port $ApiPort) {
  Write-Host "OceanView-API already running on port $ApiPort." -ForegroundColor Green
} elseif ($SkipApi) {
  throw "OceanView-API is not healthy on port $ApiPort and -SkipApi was set."
} else {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI not found. Install Docker Desktop (required for sam local)."
  }
  $dockerOk = $false
  try {
    docker info *> $null
    $dockerOk = $LASTEXITCODE -eq 0
  } catch {
    $dockerOk = $false
  }
  if (-not $dockerOk) {
    throw "Docker is not running. Start Docker Desktop, then retry."
  }

  if (Test-PortInUse -Port $ApiPort) {
    throw "Port $ApiPort is in use by another app (not OceanView-API). Use -ApiPort or stop that process."
  }

  Write-Host "Starting OceanView-API in a new terminal (SAM local)..." -ForegroundColor Yellow
  $apiCmd = @"
Set-Location '$ApiRoot'
Write-Host 'OceanView-API - SAM local on port $ApiPort' -ForegroundColor Cyan
& '$samScript' local start-api --port $ApiPort
"@
  Start-Process powershell -ArgumentList @("-NoExit", "-Command", $apiCmd) | Out-Null

  Write-Host "Waiting for API health..." -ForegroundColor Yellow
  $ready = $false
  for ($i = 1; $i -le 90; $i++) {
    if (Test-OceanViewApiHealth -Port $ApiPort) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
    if ($i % 5 -eq 0) {
      Write-Host "  still waiting ($($i * 2)s)..."
    }
  }
  if (-not $ready) {
    throw "OceanView-API did not become healthy on port $ApiPort. Check the API terminal for errors."
  }
  Write-Host "API ready: http://127.0.0.1:$ApiPort/health" -ForegroundColor Green
}

$env:VITE_DEV_API_PROXY_TARGET = "http://127.0.0.1:$ApiPort"
Write-Host ""
Write-Host "Starting UI (Vite) - proxy /api -> $env:VITE_DEV_API_PROXY_TARGET" -ForegroundColor Yellow
Write-Host "Open http://localhost:5173/admin for Candles pane" -ForegroundColor Cyan
Write-Host ""

Set-Location $UiRoot
npm run dev
