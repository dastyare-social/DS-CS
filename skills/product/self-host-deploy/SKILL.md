---
name: self-host-deploy
description: Install, run, update and back up a self-hosted DS-CS channel with Docker Compose or Vercel. Use for the one-command installer, env var setup, reverse proxying, port layout, backing up the database, or moving a channel to a new version. For writing content use post-with-media.
---

# Self-hosting DS-CS

## What you need

- Docker and curl
- A domain with HTTPS (required for browser push notifications)
- Ports: `8729` (app), `9000` / `9001` (S3 console)

The stack ships Postgres 16 and rustfs (S3-compatible storage) alongside the app. You do not need to provision either.

## Option A — one command

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/scripts/install.sh | bash
```

Into a specific directory:

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/scripts/install.sh -o install.sh
bash install.sh /opt/ds-cs
```

The script downloads `docker-compose.yml`, drops in the three editable brand files, creates `.env` with generated secrets if none exists, and starts the stack. It is non-destructive: existing files are left intact rather than overwritten. Compose runs under the pinned project name `ds-cs`, so containers and volumes are prefixed `ds-cs-` regardless of the install directory — two installs cannot collide on volume names.

**Review the generated `.env` before using this in production.** The secrets it writes are locally safe, not production-safe.

## Option B — compose by hand

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/docker-compose.yml -o docker-compose.yml
cp .env.example .env
$EDITOR .env
docker compose up -d
```

The app container runs migrations and bootstraps the admin user automatically on boot. That is why `db:migrate` runs before `next build` in the build script — schema changes ship as files, never as live database edits.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `API_KEY` | Shared key for REST writes and MCP write tools |
| `MCP_API_KEY` | Optional separate key for the stdio MCP server |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Auth |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Bootstrap admin, used once |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_FORCE_PATH_STYLE` | Media storage |
| `S3_PUBLIC_BASE_URL` | Browser-reachable base for media URLs — keep in sync with the published rustfs port |
| `NEXT_PUBLIC_APP_URL` | Public URL; drives sitemap, canonical URLs and OG images |
| `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY`, `WEBPUSH_PRIVATE_KEY`, `WEBPUSH_SUBJECT` | Web Push (VAPID) |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Unblocks search engines; default blocks indexing |
| `MEDIA_MAX_*_SIZE_MB`, `MEDIA_ALLOWED_MIME_TYPES` | Upload limits |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `POSTHOG_API_KEY` | Analytics |

`NEXT_PUBLIC_APP_URL` being wrong is the most common self-hosting mistake: the sitemap, canonical URLs and OG images are all built from it, so they silently point at localhost.

## Reverse proxy

Terminate TLS at Caddy, nginx or Traefik and proxy to port `8729`. Push notifications require HTTPS — the Service Worker does not register on plain HTTP outside `localhost`.

Also proxy or expose the S3 port if media URLs should be served from your own domain; then set `S3_PUBLIC_BASE_URL` to match. Media served from an unconfigured domain falls back to unoptimized images, which is slower but not broken.

## Vercel

The `Dockerfile.vercel` in the install is a pull-only blueprint (FROM `dastyaresocial/ds-cs:latest` with a PORT-aware CMD) so an installed folder can deploy to Vercel Fluid compute without the app source. Configure the same env vars there. Remember the database and S3 are external services — Vercel does not run your Postgres or rustfs.

## Updating an existing install

```bash
cd /opt/ds-cs
docker compose pull
docker compose up -d
```

Migrations run on boot. Config files are bind-mounted and read per request, so a config edit does not need an update at all.

## Backups

Two things matter and they live in different places:

```bash
# database
docker compose exec -T db pg_dump -U postgres ds-cs > backup.sql

# media
docker run --rm -v ds-cs_rustfs_data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/media.tar.gz -C /data .
```

The media backup volume name follows the pinned project name — confirm it with `docker volume ls | grep rustfs` before assuming. Losing media is not recoverable by re-running the installer; it is the one backup that actually matters.

Restore:

```bash
docker compose exec -T db psql -U postgres ds-cs < backup.sql
```

## Verify

```bash
docker compose ps
curl -s http://localhost:8729/api/posts?type=count
curl -s https://your-domain.com/.well-known/mcp
```

Open the channel, confirm the feed loads, then confirm a media upload round-trips — that exercises the app, Postgres and S3 together.
