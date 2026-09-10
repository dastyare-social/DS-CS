# Self-hosting guide

This document covers how to self-host Dastyare Social CS with two supported options:

1. **One-command install script** — pulls the prebuilt image and starts everything with Docker Compose.
2. **Manual Docker Compose** — run the production compose file yourself.

Both options use the prebuilt image `dastyaresocial/ds-cs` and ship with a PostgreSQL database and rustfs (an S3-compatible storage server) bundled in the compose stack.

## 1) What you need

- A server (or desktop machine) with **Docker** and **curl** installed
- A domain with HTTPS (recommended for production; required for browser push notifications)
- Open ports: `8729` (app), `9000`/`9001` (S3 console)

## 2) Option A: One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/scripts/install.sh | bash
```

The script:

- downloads `docker-compose.yml` (if not already present)
- creates a `.env` file with safe local defaults (or leaves an existing one intact)
- starts the stack with `docker compose up -d` (no build step — the prebuilt image is pulled)

To install into a specific directory, run the script locally with a target directory:

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/scripts/install.sh -o install.sh
bash install.sh /opt/ds-cs
```

> Review and update the generated `.env` (admin credentials, secrets, and your public URL) before using this in production.

## 3) Option B: Manual Docker Compose

Download the production compose file and run it directly:

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/docker-compose.yml -o docker-compose.yml
```

Copy the environment example and adjust the values:

```bash
cp .env.example .env
```

Then start the stack (pulls `dastyaresocial/ds-cs:latest` plus `postgres:16` and `rustfs/rustfs`):

```bash
docker compose up -d
```

The app container runs migrations and bootstraps the admin user automatically on startup.

After both options, open `http://localhost:8729` (or `https://your-domain.com`).

## 4) Reverse proxy

If you run behind Nginx or Caddy, forward traffic to port `8729` and make the app reachable over HTTPS.

## 5) Required environment variables

Copy [.env.example](./.env.example) to `.env` and adjust the values.

### Core app variables

```dotenv
DATABASE_URL="postgresql://user:password@host:5432/db"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="strong-password"
API_KEY="your-api-key"
API_KEY_RATE_LIMIT_MAX_REQUESTS=30
API_KEY_RATE_LIMIT_WINDOW_MS=60000
BETTER_AUTH_URL="https://your-domain.com"
BETTER_AUTH_SECRET="long-random-secret"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### S3 / media storage variables

```dotenv
S3_ENDPOINT="https://your-s3-provider.example.com"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret"
S3_BUCKET_NAME="ds-cs"
S3_FORCE_PATH_STYLE=true
```

### Optional web push variables

See the [browser push notifications](#6-browser-push-notifications) section to generate VAPID keys.

```dotenv
NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY="<public-key>"
WEBPUSH_PRIVATE_KEY="<private-key>"
WEBPUSH_SUBJECT="mailto:you@example.com"
```

### How to generate or obtain every required value

- `DATABASE_URL`: Copy the full connection URL from your PostgreSQL provider. With the bundled compose Postgres, keep `postgresql://postgres:postgres@db:5432/dastyare_social_cs`.
- `ADMIN_EMAIL`: A valid email address for the bootstrap admin user.
- `ADMIN_PASSWORD`: Choose a strong password.
- `API_KEY`: Generate a secure API key with `openssl rand -hex 32`.
- `BETTER_AUTH_SECRET`: Generate with `openssl rand -base64 32`.
- `NEXT_PUBLIC_APP_URL`: Your public app URL (used for SEO, metadata, and client links).
- `S3_ENDPOINT`: Endpoint from your S3-compatible provider. With the bundled rustfs service, use `http://rustfs:9000`.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: Storage credentials. The bundled rustfs defaults to `minioadmin` / `minioadmin`.
- `S3_BUCKET_NAME`: Name of your media bucket. The bundled stack creates `ds-cs` automatically.
- `S3_FORCE_PATH_STYLE`: Set `true` for rustfs/MinIO/path-style endpoints, `false` for AWS standard endpoints.
- `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` / `WEBPUSH_PRIVATE_KEY`: Generate with `npx web-push generate-vapid-keys`.

## 6) Browser push notifications

Push notifications require HTTPS in production.

### Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Then configure:

```dotenv
NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY="<public-key>"
WEBPUSH_PRIVATE_KEY="<private-key>"
WEBPUSH_SUBJECT="mailto:you@example.com"
```

### Runtime behavior

- Users can enable notifications from a modal.
- If the browser does not support push notifications, the UI will explain that.
- If notifications are blocked by the browser, the UI will explain that.
- If VAPID keys are missing, the UI will show a setup-required message.

## 7) Production checklist

- Set all required environment variables
- Use strong `ADMIN_PASSWORD`, `API_KEY`, and `BETTER_AUTH_SECRET`
- Point `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` at your public domain
- Serve the app over HTTPS and forward traffic to port `8729`
- Confirm `S3_ENDPOINT` / credentials match your storage (bundled rustfs or an external provider)
- Confirm the admin account was bootstrapped (container runs migrations + admin bootstrap on startup)
- Test creating a post and a story after deployment
- Check `/docs` and `/openapi.json` after the first startup