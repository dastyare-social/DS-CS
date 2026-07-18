# Self-hosting guide

This document covers how to self-host Dastyare Social CS from scratch on common platforms such as Vercel, VPS, Docker, Railway, Render, and similar services.

## 1) What you need before deployment

You need four core services:

1. A PostgreSQL database
2. An S3-compatible object storage provider for media uploads
3. A domain with HTTPS
4. A server or platform to run the Next.js app

## 2) Required environment variables

Copy [.env.example](./.env.example) to `.env` and fill the values.

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
S3_BUCKET_NAME="dastyare-social-cs"
S3_FORCE_PATH_STYLE=true
```

### Optional web push variables

```dotenv
NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY="<public-key>"
WEBPUSH_PRIVATE_KEY="<private-key>"
WEBPUSH_SUBJECT="mailto:you@example.com"
```

### Recommended values

- `BETTER_AUTH_SECRET` should be a long random string.
- `API_KEY` should be a strong secret used for protected API routes.
- `WEBPUSH_SUBJECT` should be a valid URI such as `mailto:you@example.com`.

### How to generate or obtain every required value

- `DATABASE_URL`: Copy the full connection URL from your PostgreSQL provider, or build it from `host`, `port`, `user`, `password`, and `database`.
  - Example local value: `postgresql://dastyare_user:strong-password@127.0.0.1:5432/dastyare_social_cs`
  - Example managed provider value: `postgresql://username:password@db.example.com:5432/dastyare_social_cs?sslmode=require`
- `ADMIN_EMAIL`: Use a valid email address for the bootstrap admin user.
- `ADMIN_PASSWORD`: Choose a strong password, or generate one with a password manager.
- `API_KEY`: Generate a secure API key with `openssl rand -hex 32`, `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`, or a trusted secret manager.
- `API_KEY_RATE_LIMIT_MAX_REQUESTS`: Set the number of requests allowed per window for API key clients.
- `API_KEY_RATE_LIMIT_WINDOW_MS`: Set the rate limit window in milliseconds. Example: `60000` for one minute.
- `BETTER_AUTH_URL`: Set to the same public domain that users will access.
- `BETTER_AUTH_SECRET`: Generate a random secret string with `openssl rand -base64 32`.
- `NEXT_PUBLIC_APP_URL`: Set to your live app URL for SEO, metadata, and client links.
- `S3_ENDPOINT`: Use the endpoint from your S3-compatible provider or local MinIO installation.
- `S3_REGION`: Use the provider region.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`: Use storage credentials from your storage provider.
- `S3_BUCKET_NAME`: Use the name of your media bucket.
- `S3_FORCE_PATH_STYLE`: Set `true` for MinIO or path-style endpoints, `false` for AWS standard endpoints.
- `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` / `WEBPUSH_PRIVATE_KEY`: Generate with `npx web-push generate-vapid-keys` and paste the values directly.
- `WEBPUSH_SUBJECT`: Use a valid contact URI such as `mailto:you@example.com`.

### If you use AI to help fill env values

AI can help you generate example values and shell commands, but do not ask any AI to store or keep your real production secrets. Always verify the output and keep actual secrets only in `.env` or your deployment vault.

## 3) Database setup

### Option A: Neon / Supabase Postgres / managed PostgreSQL

Use any PostgreSQL 14+ compatible provider.

Example:

```dotenv
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
```

After the database is ready, run:

```bash
bun run db:migrate
bun run bootstrap:admin
```

### Option B: Self-hosted PostgreSQL on a VPS

Install PostgreSQL and create a database:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql
```

Inside PostgreSQL:

```sql
CREATE DATABASE dastyare_social_cs;
CREATE USER dastyare_user WITH PASSWORD 'strong-password';
ALTER ROLE dastyare_user WITH SUPERUSER;
GRANT ALL PRIVILEGES ON DATABASE dastyare_social_cs TO dastyare_user;
```

Then set:

```dotenv
DATABASE_URL="postgresql://dastyare_user:strong-password@127.0.0.1:5432/dastyare_social_cs"
```

## 4) S3-compatible object storage setup

This project uploads media to S3-compatible storage.

### Recommended providers

- Supabase Storage (S3-compatible)
- Cloudflare R2
- AWS S3
- MinIO (self-hosted)

### Example for Supabase Storage

1. Create a bucket.
2. Enable S3-compatible access.
3. Use the endpoint, region, access key, secret key, and bucket name in the env vars above.

### Example for MinIO

```dotenv
S3_ENDPOINT="http://your-minio-host:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET_NAME="dastyare-social-cs"
S3_FORCE_PATH_STYLE=true
```

## 5) Build and run locally

```bash
bun install
bun run dev
```

The app runs on port `8729` by default.

## 6) Production build

```bash
bun run build
```

For production, run migrations before starting the app:

```bash
bun run db:migrate
bun run start
```

## 7) Docker deployment

A Dockerfile is included. Build and run it locally:

```bash
docker build -t dastyare-social-cs .
docker run -p 8729:8729 --env-file .env dastyare-social-cs
```

### Docker Hub / registry deployment

Push the image to a registry such as Docker Hub or GitHub Container Registry, then deploy it to your target platform.

Example:

```bash
docker build -t yourname/dastyare-social-cs:latest .
docker push yourname/dastyare-social-cs:latest
```

## 8) Deploy on a VPS

### Example with Docker Compose

Use the included Dockerfile and a compose file such as:

```yaml
services:
  app:
    image: yourname/dastyare-social-cs:latest
    ports:
      - "8729:8729"
    env_file:
      - .env
    restart: always
```

Then:

```bash
docker compose up -d
```

### Reverse proxy

If you run behind Nginx or Caddy, make sure the app is reachable over HTTPS and forward traffic to port `8729`.

## 9) Deploy on Vercel

Vercel can host the frontend, but this project also depends on PostgreSQL and S3-compatible storage, so you should treat those as external services.

### Vercel setup

1. Import the GitHub repository in Vercel.
2. Set the environment variables from the `.env` file.
3. Make sure `NEXT_PUBLIC_APP_URL` uses your Vercel domain.
4. Add a PostgreSQL provider and S3-compatible storage provider.
5. Run migrations as a build or post-deploy step.

### Important note

Because the app uses server-side runtime and database access, Vercel is suitable for the app shell but you still need real database and storage backing services.

## 10) Deploy on Railway

1. Create a new Railway project.
2. Connect the GitHub repo.
3. Add a PostgreSQL service.
4. Add the app service and set the environment variables.
5. Set the start command to:

```bash
bun run db:migrate && bun run start
```

## 11) Deploy on Render

1. Create a new Web Service from the GitHub repo.
2. Choose the Dockerfile or a Node environment.
3. Add the environment variables.
4. Set the start command:

```bash
bun run db:migrate && bun run start
```

## 12) Deploy on a PaaS with Docker support

Platforms such as Fly.io, CapRover, and similar services can work if they support Docker or a Node runtime and allow custom environment variables.

## 13) Browser push notifications

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

- Users can enable notifications from the modal.
- If the browser does not support push notifications, the UI will explain that.
- If notifications are blocked by the browser, the UI will explain that.
- If VAPID keys are missing, the UI will show a setup-required message.

## 14) Production checklist

- Set all required environment variables
- Create a PostgreSQL database and run migrations
- Create or connect S3-compatible storage and configure bucket credentials
- Make sure the app is served over HTTPS
- Make sure `/sw.js` is reachable
- Set the admin bootstrap credentials
- Test creating a post and a story after deployment
- Check `/docs` and `/openapi.json` after the first startup

## 15) Recommended provider examples

### Supabase

Use Supabase Postgres for the database and Supabase Storage for S3-compatible uploads.

### Independent providers

You can use:

- Neon + Cloudflare R2
- Railway Postgres + Cloudflare R2
- VPS + MinIO + PostgreSQL
- Render Postgres + AWS S3
