# Deploying to Vercel — Dastyare Social CS

> This guide walks through deploying Dastyare Social CS to Vercel as a Docker container.
> Vercel runs the prebuilt Docker Hub image `dastyaresocial/ds-cs`, referenced by a pull-only
> `Dockerfile.vercel`, on Fluid compute; PostgreSQL, S3, and secrets stay external.

---

## Table of Contents

1. [Overview](#overview)
2. [How the Vercel Image Works](#how-the-vercel-image-works)
3. [Prerequisites](#prerequisites)
4. [Provision External Resources](#provision-external-resources)
5. [Environment Variables](#environment-variables)
6. [One-Off Database Setup](#one-off-database-setup)
7. [Deploy to Vercel](#deploy-to-vercel)
8. [Post-Deployment Checks](#post-deployment-checks)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Dastyare Social CS is a Next.js 16 (App Router) application. Vercel does **not** build the app
from this repository — it runs a prebuilt image pushed to Docker Hub (`dastyaresocial/ds-cs`,
the same image used by the Docker Compose self-host stack). The `Dockerfile.vercel` at the
repository root is a pull-only blueprint: it references that image and adds the runtime entry
point Vercel needs. The database and object storage are **not** bundled into the image — you
provision them yourself, and the app talks to them at runtime.

This results in a deployment where:

- Vercel pulls the prebuilt image and starts the Next.js server on **Fluid Compute**.
- The container listens on the `PORT` variable Vercel injects (the pull-only `Dockerfile`
  overrides the image's default `8729` port so the Vercel health check passes on `$PORT`,
  default 80).
- The one-off database migration and admin bootstrap run locally (or in CI) against production
  variables pulled from Vercel — never on the server and never during any image build.
- Shipping new code means re-pushing the Docker Hub image, then redeploying; a Vercel redeploy
  alone only picks up code that is already in the image.

If you prefer to run the app yourself instead, see the [Self-hosting guide](../SELF-HOSTING.md).

## How the Vercel Image Works

- Vercel looks for `Dockerfile.vercel` at the repository root and uses it as the container
  image definition. It is **pull-only** — there is no build stage, so Vercel never compiles
  the app, installs dependencies, or runs `next build`.
- The full multi-stage `Dockerfile` in this repo (Builder `node:22-bookworm` + Bun `v1.1.26`,
  runs `generate:config && generate:icons && next build`; Runtime `node:22-bookworm-slim`
  copies `.next`, `public`, `package.json`, `config`, and `node_modules`) is the **source** of
  the image. It is built and pushed to Docker Hub from your machine or CI, and is **not** used
  by Vercel directly.
- `Dockerfile.vercel` contains only:

  ```dockerfile
  FROM dastyaresocial/ds-cs:latest
  EXPOSE 80
  WORKDIR /app
  CMD ["sh", "-c", "node_modules/.bin/next start -h 0.0.0.0 -p ${PORT:-80}"]
  ```

- The stored image defaults to `next start -p 8729` (the self-host port). Vercel Fluid
  injects `PORT` (default 80) and health-checks the container, so the `CMD` override binds to
  `0.0.0.0:${PORT:-80}` to satisfy it.
- `latest` is used by default. Pin a specific tag (e.g. `FROM dastyaresocial/ds-cs:2026-09-01`)
  in this file if you want reproducible, tag-pinned deployments.

## Prerequisites

- A **Vercel** account and the project created in the dashboard (or `npx vercel link`).
- **Node.js 22+** (or Bun) and the Vercel CLI installed locally — Node is needed for the
  one-off database setup, not for building anything:
  ```bash
  npm install -g vercel
  ```
- The `dastyaresocial/ds-cs` image pushed to Docker Hub. Build and push it from a checkout of
  this repository (`docker build -t dastyaresocial/ds-cs:latest . && docker push
  dastyaresocial/ds-cs:latest`), or point `Dockerfile.vercel` at whatever image you use.
- An **external PostgreSQL** database (with TLS) that the app can reach at runtime — e.g. Neon,
  Supabase, or Railway. This replaces Postgres bundled in the self-host compose stack.
- An **S3-compatible object storage** bucket with access keys, used for media uploads.
- A **domain** pointed at Vercel (e.g. via Cloudflare, which is where the PostHog ingest relay is
  also configured) if you want a production URL, push notifications, and indexing.
- **(Optional)** A PostHog project if you want analytics — settings mirror the
  [PostHog dashboard guide](./posthog-dashboard-guide.md).

## Provision External Resources

Create these before deploying. None of them are created by Vercel.

### PostgreSQL

Create a database and note its connection string. Prefer a `postgresql://...` URL that works
over TLS (most managed providers give you one). You will set this as `DATABASE_URL`.

### S3 bucket

Create a bucket and the access keys, then set up CORS so the browser can upload media directly.
Replace `https://example.com` with your actual app domain(s) and keep the Vercel deployment
domains in the `AllowedOrigins` list. Example configuration:

```json
{
  "AllowedOrigins": ["https://example.com", "https://*.vercel.app"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"]
}
```

Note: for AWS S3, leave `S3_ENDPOINT` empty and keep `S3_FORCE_PATH_STYLE=true`. For a custom
S3-compatible endpoint (MinIO, DigitalOcean Spaces, Cloudflare R2), set `S3_ENDPOINT` to its
URL.

### Secrets

Generate a random secret for the API key and auth secret. Each one should be unique:

```bash
openssl rand -hex 32
```

Use one value for `API_KEY` and a different one for `BETTER_AUTH_SECRET`. `MCP_API_KEY` is
optional — it falls back to `API_KEY`.

> **Warning:** never commit `.env`, `.env.local`, or `npx vercel env pull` output — the app and
> tooling load `.env` from the working directory, but the file must stay secret and local.

### Web Push (VAPID)

Generate a key pair once; both halves go into environment variables, so keep them together:

```bash
npx web-push generate-vapid-keys
```

`publicKey` → `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY`, `privateKey` → `WEBPUSH_PRIVATE_KEY`. Also set
`WEBPUSH_SUBJECT` to a `mailto:` address you control.

## Environment Variables

There are two very different classes of variables here:

- **Runtime variables** — read from the process environment at runtime. These are set per
  environment in Vercel (or pulled locally for the one-off setup) and take effect on deploys
  without rebuilding the image.
- **`NEXT_PUBLIC_*` variables** — inlined into the client bundle when the Docker Hub image is
  built. On a pull-only deployment **Vercel-environment values for these are ignored**; to
  change one you must rebuild and re-push the image, then redeploy.

| Variable | Where it matters | Purpose | Example / notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | runtime (Vercel) | Postgres connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `ADMIN_EMAIL` | runtime (Vercel/local) | Bootstrap admin account | Your email |
| `ADMIN_PASSWORD` | runtime (Vercel/local) | Bootstrap admin password | Generate a strong one |
| `API_KEY` | runtime (Vercel) | API auth for `/api/*` and MCP | `openssl rand -hex 32` |
| `API_KEY_RATE_LIMIT_MAX_REQUESTS` | runtime (Vercel) | API rate limit | `30` |
| `API_KEY_RATE_LIMIT_WINDOW_MS` | runtime (Vercel) | API rate limit window | `60000` |
| `MCP_API_KEY` | runtime (Vercel) | MCP auth (optional) | falls back to `API_KEY` |
| `BETTER_AUTH_URL` | runtime (Vercel) | Auth base URL | `https://example.com` (your prod domain) |
| `BETTER_AUTH_SECRET` | runtime (Vercel) | Auth signing secret | `openssl rand -hex 32` |
| `S3_ENDPOINT` | runtime (Vercel) | S3 endpoint | empty for AWS S3 |
| `S3_REGION` | runtime (Vercel) | S3 region | `us-east-1` |
| `S3_ACCESS_KEY_ID` | runtime (Vercel) | S3 access key | from your bucket |
| `S3_SECRET_ACCESS_KEY` | runtime (Vercel) | S3 secret key | from your bucket |
| `S3_BUCKET_NAME` | runtime (Vercel) | Bucket name | `ds-cs` |
| `S3_FORCE_PATH_STYLE` | runtime (Vercel) | Path-style addressing | `true` |
| `S3_PUBLIC_BASE_URL` | runtime (Vercel) | Public base URL for media | `https://example.com` (or CDN/bucket URL) |
| `MEDIA_MAX_IMAGE_SIZE_MB` | runtime (Vercel) | Max image upload size | `10` |
| `MEDIA_MAX_VIDEO_SIZE_MB` | runtime (Vercel) | Max video upload size | `100` |
| `MEDIA_MAX_AUDIO_SIZE_MB` | runtime (Vercel) | Max audio upload size | `25` |
| `MEDIA_MAX_FILE_SIZE_MB` | runtime (Vercel) | Max file upload size | `25` |
| `MEDIA_ALLOWED_MIME_TYPES` | runtime (Vercel) | Allowed upload types | omit to use built-in allowlist |
| `MEDIA_KEY_PREFIX` | runtime (Vercel) | Object key prefix | `media` |
| `NEXT_PUBLIC_APP_URL` | image build (Docker Hub) | Public app URL | `https://example.com` |
| `WEBPUSH_SUBJECT` | runtime (Vercel) | Push subscription contact | `mailto:you@example.com` |
| `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` | image build (Docker Hub) | VAPID public key | from `generate-vapid-keys` |
| `WEBPUSH_PRIVATE_KEY` | runtime (Vercel) | VAPID private key | from `generate-vapid-keys` |
| `NEXT_PUBLIC_ALLOW_INDEXING` | image build (Docker Hub) | Googling/search indexing | `false` |
| `NEXT_PUBLIC_SHOW_INTERNAL_NAV` | image build (Docker Hub) | Show internal nav | `false` |
| `DEMO_MODE` | runtime (Vercel) | Demo mode | `false` |
| `NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS` | image build (Docker Hub) | Extra image domains | comma-separated list |
| `NEXT_PUBLIC_ANIMATED_EMOJIES` | image build (Docker Hub) | Animated emojis | `false` |
| `DS_SH_URL` / `DS_SH_API_KEY` | runtime (Vercel) | (Optional) shortener | only if you have one |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | image build (Docker Hub) | PostHog project token | see PostHog guide |
| `NEXT_PUBLIC_POSTHOG_HOST` | image build (Docker Hub) | PostHog host | `https://us.i.posthog.com` |
| `DISABLE_DEV_TEAM_PH` | runtime (Vercel) | Use Cloudflare relay | `true` |
| `PH_PERSONAL_API_KEY` | runtime (Vercel) | PostHog personal API key | for `bootstrap:posthog` |
| `PH_PROJECT_ID` | runtime (Vercel) | PostHog project ID | `581705` |
| `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE` | image build (Docker Hub) | Search Console support | `false` |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | image build (Docker Hub) | Site verification | from Search Console |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE` | image build (Docker Hub) | Verification file name | optional |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE_CONTENT` | image build (Docker Hub) | Verification file content | optional |

Set every **runtime** variable in the **Production** environment in Vercel. Set the
`NEXT_PUBLIC_*` variables when building and pushing the Docker Hub image — adding them to Vercel
has no effect on a pull-only deployment.

## One-Off Database Setup

Migrations and the admin bootstrap run against your production database **once**, from your
machine. They never run on the server and never during any image build.

```bash
npx vercel login
npx vercel link
npx vercel env pull .env --environment=production
npm run db:migrate
npm run bootstrap:admin
rm .env
```

Why this works:

- `src/lib/db/migrate.ts` and `scripts/bootstrap-admin.ts` load `dotenv/config`, so both read
  the pulled `.env` from the current directory.
- `npx vercel env pull` writes the production variables into `.env` (build `NEXT_PUBLIC_*`
  values are included too — harmless, since the file is local and removed afterwards).
- Delete `.env` when done so it never gets committed.

`bootstrap:admin` creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. If you later
reset the database, re-run these two commands.

## Deploy to Vercel

1. **Link the project:**
   ```bash
   npx vercel login
   npx vercel link
   ```
2. **Add environment variables** (Production) — either in the dashboard (Settings → Environment
   Variables) or with the CLI:
   ```bash
   npx vercel env add DATABASE_URL production
   npx vercel env add BETTER_AUTH_URL production
   # ... repeat for every runtime variable in the table above (skip the NEXT_PUBLIC_* rows)
   ```
3. **Push the image** (only when the app code changed, so the image carries the new build):
   ```bash
   docker build -t dastyaresocial/ds-cs:latest .
   docker push dastyaresocial/ds-cs:latest
   ```
4. **Deploy:**
   ```bash
   npx vercel --prod
   ```
   Vercel detects `Dockerfile.vercel`, pulls the prebuilt `dastyaresocial/ds-cs` image from
   Docker Hub, and starts the server on Fluid compute.

   If you connect the repo to a Git integration, every push to the production branch triggers a
   new deployment automatically — but code changes only appear after step 3 re-pushed the image.

There is no build step, so deployments are fast: Vercel pulls the image and boots it. A redeploy
only ships new code if the Docker Hub image was re-pushed first.

## Post-Deployment Checks

After the deployment is ready, verify each of these:

- Open `/docs` — the API playground loads and lists routes.
- Open `/openapi.json` — the OpenAPI document renders (this also confirms runtime env such as
  `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`).
- Open `/` — the landing page loads.
- Log in as the admin user created by `bootstrap:admin`.
- Open `/os` from that account and create a post with media — the file uploads to S3 and the
  stored URL points at `S3_PUBLIC_BASE_URL`.
- Confirm a browser can receive push notifications (VAPID keys must match the pair you stored).
- If `NEXT_PUBLIC_ALLOW_INDEXING=true`, verify the site in Google Search Console using
  `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION*`.
- If PostHog is configured, confirm events appear in the project (token, host, and optional
  Cloudflare `DISABLE_DEV_TEAM_PH` relay).
- Check the runtime: server listens on Vercel-injected `PORT` (default 80) — no container
  changes needed.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Deployment fails | Vercel doesn't build, so failures are almost always image pulls (Docker Hub is unreachable, the tag doesn't exist, or the image is private) or runtime env misconfiguration. Check the deployment logs. |
| Redeploy doesn't show my latest code | The code was never built into the image. Rebuild and re-push `dastyaresocial/ds-cs` (step 3 in [Deploy to Vercel](#deploy-to-vercel)), then redeploy. A Vercel redeploy alone re-runs the same pulled image. |
| `NEXT_PUBLIC_*` change in Vercel has no effect | These are inlined at image build time, so Vercel env values are ignored. Rebuild and re-push the image with the new values, then redeploy. |
| `next build` fails locally with a DB error | You didn't run `npm run build` — that script also runs `db:migrate` and `bootstrap:admin`. The Docker image build only runs `generate:config && generate:icons && next build` against no database. Use `npm run dev` for local development against a local DB. |
| 504 / very slow first request | Cold start on Fluid compute. Keep the runtime lean and warm up the deployed URL. |
| Image optimizer breaks on uploaded media | Empty `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE=true` is required for AWS S3 URLs; also set bucket CORS and add your domain to `NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS` (for a custom CDN use `S3_PUBLIC_BASE_URL`). |
| Vercel uses framework build instead of Dockerfile | The project preset may say Next.js (from `.vercel/project.json`). In project Settings → Build, ensure the deployment uses `Dockerfile.vercel` (e.g. preset "Other" / container-image import) and redeploy. |
| Media upload fails with CORS error | Bucket CORS block not set, or your domain is missing from `AllowedOrigins`. Update the S3 CORS JSON and wait for propagation. |
| Push notifications fail | VAPID public/private keys don't belong to the same pair. Regenerate with `npx web-push generate-vapid-keys`, rebuild the image with the new public key, update both variables, and redeploy. |
| `PORT`/`8729` confusion | Vercel injects `PORT`; the pull-only `Dockerfile.vercel` `CMD` binds to it (falling back to `80`). The self-host-only `8729` default in the stored image is used when no `PORT` is injected. No action needed. |

---

*Last updated: September 2026*