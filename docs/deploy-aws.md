# Deploy OceanView UI — S3 + CloudFront + GitHub Actions

Static hosting for the Vite/React app. Cognito and API routing are documented in [plan.md](./plan.md) for a later phase.

## Architecture

```
GitHub (push main) → GitHub Actions → S3 bucket → CloudFront → users
                                              ↘ /api/* → API Gateway (OceanView-API)
```

- **S3**: private bucket; only CloudFront can read objects (Origin Access Control).
- **CloudFront**: HTTPS, SPA routing, **`/api/*` → API Gateway** (same domain, no CORS).
- **GitHub Actions**: build `dist/` and `aws s3 sync` on every push to `main`.

The UI calls **`/api/tickers`**, **`/api/candles/*`**, etc. (relative URLs). CloudFront forwards to API Gateway `.../prod/tickers`.

Auth uses **OIDC** (no long-lived AWS access keys in GitHub).

---

## 1. One-time AWS setup

### 1.1 S3 bucket

1. Create bucket, e.g. `oceanview-ui-prod` in `us-east-1`.
2. **Block all public access** — enabled.
3. No static website hosting (CloudFront is the entry point).

### 1.2 CloudFront distribution

| Setting | Value |
|--------|--------|
| Origin | S3 bucket above |
| Origin access | **Origin access control (OAC)** — create new OAC, apply bucket policy when prompted |
| Default root object | `index.html` |
| Compress objects | Yes |
| Viewer protocol | Redirect HTTP to HTTPS |

**SPA routing** (required for `/market`, `/admin`):

CloudFront → **Error pages** → Create custom error response:

| HTTP error | Response page path | HTTP response code |
|------------|-------------------|-------------------|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

Note the **Distribution ID** (e.g. `E1234ABCD`) for GitHub variables.

### 1.3 CloudFront `/api/*` → API Gateway (same domain)

Do this on the **same** distribution that serves the UI. API base URL in the app is **`/api`** (see `.env.production`).

**API Gateway** (OceanView-API):

| Item | Value |
|------|--------|
| Host | `7bko9drijd.execute-api.us-east-1.amazonaws.com` |
| Stage path | `/prod` |
| Example | `GET .../prod/tickers` |

#### Step A — CloudFront Function (strip `/api` prefix)

1. CloudFront → **Functions** → **Create function**
2. Name: `oceanview-api-rewrite`
3. Paste code from [`infrastructure/cloudfront-api-rewrite.js`](../infrastructure/cloudfront-api-rewrite.js)
4. **Save** → **Publish**

#### Step B — Second origin (API)

CloudFront → your distribution → **Origins** → **Create origin**:

| Field | Value |
|-------|--------|
| Origin domain | `7bko9drijd.execute-api.us-east-1.amazonaws.com` |
| Protocol | HTTPS only |
| Origin path | `/prod` |
| Name | `oceanview-api` (suggested) |

#### Step C — Cache behavior `/api/*`

**Behaviors** → **Create behavior** (must be **above** the default `*` S3 behavior):

| Field | Value |
|-------|--------|
| Path pattern | `/api/*` |
| Origin | `oceanview-api` |
| Viewer protocol | Redirect HTTP to HTTPS |
| Allowed HTTP methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewerExceptHostHeader** (or CORS-S3Origin if needed) |
| Function associations | **Viewer request** → `oceanview-api-rewrite` |

**Do not cache** API responses (POST bodies, job status).

#### Request flow

```
Browser  GET https://YOUR_CF_DOMAIN/api/tickers
    → CloudFront Function: uri → /tickers
    → Origin path /prod
    → API Gateway GET /prod/tickers
```

#### Verify

```powershell
$cf = "https://YOUR_CLOUDFRONT_DOMAIN"
curl.exe "$cf/api/tickers"
curl.exe "$cf/api/health"
```

Open the UI → **Admin → Candles** → should show **Live API** and load tickers with no CORS errors in DevTools.

#### Local dev

`npm run dev` proxies `/api` to API Gateway (see `vite.config.ts`). Same paths as production.

### 1.4 GitHub OIDC provider (account-level, once)

If not already configured:

1. IAM → **Identity providers** → Add provider → **OpenID Connect**.
2. Provider URL: `https://token.actions.githubusercontent.com`
3. Audience: `sts.amazonaws.com`

### 1.5 IAM role for GitHub Actions

Create role **GitHubActionsOceanViewUI** with:

**Trust policy** (replace `ACCOUNT_ID` and confirm repo):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:mlsloynaz/OceanView:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Permissions policy** (replace bucket name and distribution ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DeployOceanViewUI",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::oceanview-ui-prod"
    },
    {
      "Sid": "DeployOceanViewUIObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::oceanview-ui-prod/*"
    },
    {
      "Sid": "InvalidateCloudFront",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

Copy the role **ARN** (e.g. `arn:aws:iam::123456789012:role/GitHubActionsOceanViewUI`).

---

## 2. GitHub repository configuration

Repo: `mlsloynaz/OceanView`

### Secret

| Name | Value |
|------|--------|
| `AWS_ROLE_ARN` | IAM role ARN from §1.5 |

Settings → Secrets and variables → Actions → **Secrets**.

### Variables

Settings → Secrets and variables → Actions → **Variables** (optional overrides; defaults live in `.env.production`):

| Name | Example | Required |
|------|---------|----------|
| `AWS_REGION` | `us-east-1` | Yes |
| `S3_BUCKET` | `oceanview-ui-prod` | Yes |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1234ABCDEF` | Yes |

### Environment (optional but recommended)

Create environment **production** under Settings → Environments. The workflow uses `environment: production` so you can add approval gates later.

---

## 3. Deploy

Push to `main`:

```bash
git push origin main
```

Or run manually: Actions → **Deploy UI** → **Run workflow**.

### What the workflow does

1. `npm ci` && `npm run build`
2. Upload `dist/` to S3 (long cache on hashed assets, short cache on `index.html` and `data/`)
3. CloudFront invalidation `/*`

---

## 4. Manual deploy (local)

```powershell
cd c:\Code\OceanView
npm run build
aws s3 sync dist/ s3://oceanview-ui-prod --delete
aws cloudfront create-invalidation --distribution-id EXXXXX --paths "/*"
```

Requires AWS CLI configured with credentials that can write to the bucket.

---

## 5. Updating optimal ranges only

After editing `data/rango-optimo.json`, either push to `main` (full deploy) or:

```powershell
npm run build
aws s3 cp dist/data/rango-optimo.json s3://oceanview-ui-prod/data/rango-optimo.json `
  --cache-control "public,max-age=300,must-revalidate"
aws cloudfront create-invalidation --distribution-id EXXXXX --paths "/data/*"
```

---

## 6. Custom domain (later)

1. Request ACM certificate in **us-east-1**.
2. Add alternate domain name on CloudFront.
3. Route 53 (or DNS): CNAME to CloudFront domain.

---

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| `/admin` 404 on refresh | Add CloudFront 403/404 → `index.html` (200) |
| GitHub Action `AccessDenied` on S3 | Check IAM role policy and OAC bucket policy |
| GitHub Action `Not authorized to perform sts:AssumeRoleWithWebIdentity` | OIDC trust `sub` must match `repo:OWNER/REPO:ref:refs/heads/main` |
| Stale UI after deploy | Invalidation takes 1–3 min; hard-refresh browser |
| Candles API fails in prod | Complete §1.3 (`/api/*` behavior); redeploy UI; test `curl https://CF_DOMAIN/api/tickers` |
| Candles API CORS error | UI should use `/api` not full API Gateway URL; check `.env.production` |
| `/api/*` returns 403/502 | Behavior order: `/api/*` above `*`; origin path `/prod`; function published |

---

## 8. Next (not in this doc)

- Cognito login — [plan.md](./plan.md) Phase E
