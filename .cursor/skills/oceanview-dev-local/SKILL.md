---
name: oceanview-dev-local
description: Start OceanView UI and local OceanView-API (SAM) together for development. Use when the user asks to run OceanView locally, start dev environment, local API integration, or dev-local script.
---

# OceanView local dev (UI + API)

## Quick start

From the **OceanView** repo root:

```powershell
npm run dev:local
```

Or directly:

```powershell
.\scripts\dev-local.ps1
```

## What it does

1. Finds sibling repo `OceanView-API` (default `..\OceanView-API` from UI root).
2. Starts `sam local start-api` in a **new PowerShell window** (Docker required).
3. Waits until `GET http://127.0.0.1:3001/health` returns `oceanview-api` JSON.
4. Runs `npm run dev` with `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:3001` (or use `.env.development.local`).

Default API port is **3001** (avoids conflicts with other apps on 3000).

## Options

```powershell
.\scripts\dev-local.ps1 -ApiPort 3002
.\scripts\dev-local.ps1 -ApiRoot C:\Code\OceanView-API
.\scripts\dev-local.ps1 -SkipApi   # UI only; API must already be healthy on the port
```

## Verify

```powershell
curl.exe http://127.0.0.1:3001/health
# {"ok": true, "service": "oceanview-api", ...}

# UI: http://localhost:5173/admin — subtitle should say Live API — /api
```

## Prerequisites

- Node.js + `npm install` in OceanView
- AWS SAM CLI + Docker Desktop running
- OceanView-API cloned next to OceanView (`C:\Code\OceanView-API`)
- AWS credentials configured (local SAM still uses DynamoDB in AWS)

## Agent behavior

When the user wants local full-stack dev, run `npm run dev:local` from `OceanView` (or `.\scripts\dev-local.ps1`). Do not use `sam.ps1` from the UI repo — it lives in OceanView-API only.

If port 3001 is taken, retry with `-ApiPort` and tell the user to set the same port in `VITE_DEV_API_PROXY_TARGET` if starting UI manually.
