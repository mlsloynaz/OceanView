# Environment configuration

How OceanView UI and API handle config locally vs production, and what belongs in git vs AWS.

## Summary

| What | Local | Production | Store secrets in |
|------|--------|------------|------------------|
| **UI** (`OceanView`) | `.env.development` + `.env.development.local` | `.env.production` (build-time) | Nothing secret today |
| **API** (`OceanView-API`) | `.env` (gitignored) | `template.yaml` + Lambda env | **AWS Secrets Manager** |
| **Deploy / infra** | N/A | GitHub Actions | **GitHub Secrets & Variables** |

**Rule:** Never commit secrets (API keys, tokens, passwords). Commit only non-secret defaults (`/api`, table names, feature flags).

---

## OceanView UI (Vite)

Vite embeds `VITE_*` variables into the JavaScript bundle at **build time**. They are **not** server-side secrets — anyone can see them in the browser.

### Committed (safe)

| File | When loaded |
|------|-------------|
| `.env.development` | `npm run dev` |
| `.env.production` | `npm run build` |
| `.env.example` | Documentation only |

Current values are non-secret: `VITE_API_BASE_URL=/api`, `VITE_USE_MOCK_CANDLES=false`, `VITE_USE_MOCK_MARKET=true` (dev) / `false` (production).

| Flag | Feature doc |
|------|-------------|
| `VITE_USE_MOCK_MARKET` | [market-page.md](./market-page.md) |
| `VITE_USE_MOCK_CANDLES` | [candles-pane.md](./candles-pane.md) |

### Gitignored (personal / machine-specific)

| File | Purpose |
|------|---------|
| `.env.development.local` | Local SAM proxy, mock mode, etc. |
| `.env.local` | Overrides all modes |

**Setup:**

```powershell
cd C:\Code\OceanView
copy .env.development.local.example .env.development.local
# Edit VITE_DEV_API_PROXY_TARGET if needed
npm run dev
```

Or use `npm run dev:local` (sets proxy automatically).

### Production UI deploy

GitHub Actions runs `npm run build`, which reads **`.env.production`** from the repo. No `.env` file is needed on AWS for the static site.

Optional overrides via GitHub **Variables** (only if you add them to the workflow `env:` block):

- `VITE_API_BASE_URL`
- `VITE_USE_MOCK_CANDLES`
- `VITE_USE_MOCK_MARKET`

Today the workflow uses committed `.env.production` only.

### Do UI secrets belong in AWS?

**Not for this app.** There are no private keys in the UI. If you later add a public Cognito client ID, that is still safe to commit (OAuth public client).

Do **not** put Schwab or AWS credentials in UI `.env` files.

---

## OceanView API (Lambda)

### Local (`sam local`)

```powershell
cd C:\Code\OceanView-API
copy .env.example .env
# .env is gitignored
.\scripts\sam.ps1 local start-api --port 3001
```

`.env` points at shared DynamoDB table names and `AWS_REGION`. Your **AWS CLI profile** supplies credentials.

### Production (deployed Lambda)

| Config | Where |
|--------|--------|
| Table names, region | `template.yaml` → Lambda environment variables |
| Schwab OAuth tokens | **Secrets Manager** `oceanview/schwab` |
| IAM permissions | SAM / CloudFormation |

Deploy with `.\scripts\deploy.ps1` — no `.env` on Lambda.

### Schwab secret (AWS)

Create/update in Secrets Manager (same JSON shape as FinanceAI `finance-ai/schwab`):

```json
{
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "...",
  "access_token": "...",
  "expires_at": "..."
}
```

The API reads this at runtime; it never belongs in git.

---

## GitHub Actions (deploy)

| Type | Examples | Location |
|------|----------|----------|
| **Secret** | `AWS_ROLE_ARN` | GitHub → Settings → Secrets |
| **Variable** | `AWS_REGION`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` | GitHub → Variables |

These replace a `.env` file for CI/CD.

---

## AWS options (when to use what)

| Service | Use for |
|---------|---------|
| **Secrets Manager** | Schwab tokens, DB passwords, API keys (API already uses this) |
| **SSM Parameter Store** | Non-secret shared config (table prefixes, feature flags) — optional |
| **Lambda env vars** | Non-secret per-function config (already in `template.yaml`) |
| **GitHub Secrets/Vars** | CI deploy credentials and bucket names |

For OceanView today, **Secrets Manager + template.yaml + GitHub Variables** is enough. SSM is optional if you want one place to edit table names without redeploying SAM.

---

## Quick reference

```text
Developer laptop
  OceanView/.env.development.local  →  Vite dev proxy, mock flag
  OceanView-API/.env                →  table names, region (local SAM)

Git repo (committed)
  OceanView/.env.development
  OceanView/.env.production
  *.example files

AWS
  Secrets Manager: oceanview/schwab
  Lambda env: from template.yaml
  DynamoDB: OceanView-* tables

GitHub
  Secrets: AWS_ROLE_ARN
  Variables: S3_BUCKET, CLOUDFRONT_DISTRIBUTION_ID, AWS_REGION
```

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Documentation index |
| [market-page.md](./market-page.md) | Market feature flags and local live API |
| [candles-pane.md](./candles-pane.md) | Admin candles mock flag |
| [cursor-rules-skills.md](./cursor-rules-skills.md) | `npm run dev:local` |
| [aws-urls.md](./aws-urls.md) | Production URLs |
