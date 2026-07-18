# Dastyare Social — CS

Personal creator studio and social profile platform built with Next.js. Publish posts (threads, shorts, media), stories, and manage content through a REST API designed for creators, operators, and AI agents.

[![Status](https://img.shields.io/badge/status-production-ready-brightgreen)](https://github.com/yourname/dastyare_social_cs)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Deploy](https://img.shields.io/badge/deploy-Docker%20%7C%20Bun-lightgrey)](https://github.com/yourname/dastyare_social_cs)
[![Stars](https://img.shields.io/badge/stars-PLACEHOLDER-yellow)](https://github.com/yourname/dastyare_social_cs/stargazers)
[![Forks](https://img.shields.io/badge/forks-PLACEHOLDER-lightgrey)](https://github.com/yourname/dastyare_social_cs/network/members)

## Why this project

Dastyare Social CS is a production-ready creator studio built around:
- modern REST API with OpenAPI docs and MCP-ready agent support
- self-hosted media upload via S3-compatible storage
- Better Auth integration for sessions, API keys, and admin bootstrap
- PWA-friendly frontend with posts, shorts, stories, and docs pages
- built with Bun, Next.js, PostgreSQL, Drizzle ORM, Tailwind CSS, and Better Auth

## Popularity & growth

This repository is prepared for production and designed for early adoption by creators, self-hosters, and developer teams. It is built to scale with:
- open API discoverability via `/docs` and `/openapi.json`
- clear deployment and self-hosting documentation
- a fast developer workflow with Bun and Drizzle migrations
- a growing open-source mindset for maintainability and QA

> Replace the badge placeholders above with live GitHub stars/forks once the repo is public.

## Quick start

**Requirements:** Bun, Node.js 20+, PostgreSQL, and an S3-compatible storage provider.

```bash
cp .env.example .env
bun install
bun run dev          # http://localhost:8729
```

On first build, migrations run automatically and an admin user is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Environment variables

Copy `.env.example` to `.env` and fill the values before running the app. Do not commit `.env` to source control.

### Core environment variables

- `DATABASE_URL`
  - PostgreSQL connection string.
  - Example: `postgresql://dastyare_user:strong-password@127.0.0.1:5432/dastyare_social_cs`
  - For hosted providers, use the URL supplied by the provider.
- `ADMIN_EMAIL`
  - Administrator email used by bootstrap and admin sign-in.
- `ADMIN_PASSWORD`
  - Bootstrap admin password. Use a strong password or secret passphrase.
- `API_KEY`
  - Shared API key for protected REST routes.
  - Generate with `openssl rand -hex 32` or a secure secret generator.
- `API_KEY_RATE_LIMIT_MAX_REQUESTS`
  - Max requests allowed per window for API key clients.
- `API_KEY_RATE_LIMIT_WINDOW_MS`
  - Window size in milliseconds for API key rate limiting.
- `BETTER_AUTH_URL`
  - Public base URL where the app is served.
  - Example: `https://app.example.com`
- `BETTER_AUTH_SECRET`
  - Long random secret for Better Auth session signing.
  - Generate with `openssl rand -base64 32`.

### S3 / media storage variables

- `S3_ENDPOINT`
  - S3-compatible object storage endpoint.
  - Example: `https://s3.us-east-1.amazonaws.com`, `https://<bucket>.<region>.digitaloceanspaces.com`, or `http://localhost:9000` for MinIO.
- `S3_REGION`
  - Storage region for your provider.
- `S3_ACCESS_KEY_ID`
  - Storage access key.
- `S3_SECRET_ACCESS_KEY`
  - Storage secret key.
- `S3_BUCKET_NAME`
  - Bucket name used for uploads.
- `S3_FORCE_PATH_STYLE`
  - Set `true` for MinIO and path-style endpoints, `false` for AWS standard endpoints.

### Frontend and web push variables

- `NEXT_PUBLIC_APP_URL`
  - Public app URL used for metadata and client-side links.
  - Example: `https://app.example.com`
- `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY`
- `WEBPUSH_PRIVATE_KEY`
- `WEBPUSH_SUBJECT`
  - Valid contact URI such as `mailto:you@example.com`.
  - Generate VAPID keys with `npx web-push generate-vapid-keys`.
- `NEXT_PUBLIC_ANIMATED_EMOJIES`
  - Optional boolean toggle for animated emoji support.
- `DS_SH_URL` / `DS_SH_API_KEY`
  - Optional values used for third-party streaming or webhook features when configured.

### How to fill these values

- Use your provider dashboard for `DATABASE_URL`, `S3_*`, and `BETTER_AUTH_URL`.
- Generate strong secrets with `openssl rand -hex 32`, `openssl rand -base64 32`, or a secure password manager.
- For `NEXT_PUBLIC_APP_URL`, use the site URL that will be available in production.
- For web push VAPID keys, run `npx web-push generate-vapid-keys` and copy both keys into your `.env`.
- AI can help draft example configs and shell commands, but never store or commit actual secret values.

## Pages and project showcase

Dastyare Social CS includes these pages:

- `/` — public feed and home dashboard
- `/explore` — discover posts, shorts, and stories
- `/os` — operator/admin dashboard and management tools
- `/posts` — create, edit, and review posts
- `/stories` — upload and manage story content
- `/docs` — interactive API docs and agent reference
- `/pwa-self-test` — PWA install verification and service worker test page
- `/resume` — public profile / creator resume page

### Demo preview

![Demo placeholder](./public/demo-placeholder.png)
*Alt text:* Dastyare Social CS demo placeholder screenshot showing the home feed, explore page, admin dashboard, and API documentation.

> Replace this image with a screenshot or GIF once your app is running.

### Video demo

[![Video demo placeholder](./public/video-demo-placeholder.png)](https://example.com)
*Alt text:* Dastyare Social CS product demo video placeholder.

> Replace this link and thumbnail with your actual demo video after recording.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Generate config + start dev server (port 8729) |
| `bun run build` | Config, migrate, bootstrap admin, production build |
| `bun run start` | Start production server |
| `bun run lint` | ESLint |
| `bun run generate:config` | Sync `config/app.config.yml` → `config/app.config.json` |
| `bun run bootstrap:admin` | Create or update admin user from env |
| `bun run db:migrate` | Run Drizzle migrations |
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run openapi:generate` | Regenerate `public/openapi.json` from route JSDoc |

## Architecture

```
src/
├── app/
│   ├── (routes)/          # Pages: home, explore, os (admin), resume
│   ├── api/                 # REST API (OpenAPI-documented)
│   │   ├── posts/           # Posts CRUD, reactions, views
│   │   ├── stories/         # Stories CRUD, likes, views
│   │   ├── auth/            # Better Auth handler
│   │   └── trpc/            # Internal tRPC (used by frontend)
│   └── docs/                # Scalar API reference UI
├── components/              # React UI components
├── config/                  # App config, routes, constants
├── lib/
│   ├── api/                 # Business logic (posts, stories)
│   ├── auth/                # Better Auth server + client
│   ├── db/                  # Drizzle schema + migrations
│   ├── filters/             # Content sanitization (NSFW, HTML)
│   └── trpc/                # tRPC router (frontend data layer)
config/
└── app.config.yml           # Profile metadata (name, bio, username)
```

**Stack:** Next.js 16 · React 19 · Bun · PostgreSQL · Drizzle ORM · Better Auth · tRPC · Tailwind CSS 4 · next-intl · AWS S3 (media uploads)

## API documentation

| Resource | URL |
|----------|-----|
| Interactive docs (Scalar) | `/docs` |
| OpenAPI spec (JSON) | `/openapi.json` |
| LLM site map | `/llms.txt` |
| Auth OpenAPI | `/api/auth/openapi` (Better Auth) |

Base URL for REST endpoints: `{APP_URL}/api`

See [AGENTS.md](./AGENTS.md) for a complete API reference written for AI agents, and [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow.

## Configuration

- **App profile:** Edit `config/app.config.yml`, then run `bun run generate:config`
- **Environment:** Copy `.env.example` — never commit secrets
- **Port:** Default `8729` (set in `package.json` scripts)

## Deployment

Docker multi-stage build included. See `Dockerfile`. Production build skips DB migration at image build time; run migrations at container start or via CI.

For a complete self-hosting guide covering environment variables, PostgreSQL, S3-compatible storage, Docker, VPS, Vercel, Railway, Render, and browser push notifications, see [SELF-HOSTING.md](./SELF-HOSTING.md).

## Web push notifications (self-hosted)

Browser push notifications are supported for modern browsers on HTTPS. They are optional and only send to users who explicitly enable them from the notification modal.

### 1) Generate VAPID keys

Run this locally or in your deployment environment:

```bash
npx web-push generate-vapid-keys
```

The command prints a public key and a private key.

### 2) Fill in the environment variables

In your `.env` or deployment secrets, set:

```dotenv
NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY="<public-key>"
WEBPUSH_PRIVATE_KEY="<private-key>"
WEBPUSH_SUBJECT="mailto:hey@omidshabab.com"
```

You can set `WEBPUSH_SUBJECT` to any valid contact string, but `mailto:your-email@example.com` is the most common and recommended format.

### 3) Requirements

- The app must run on HTTPS in production.
- The browser must support Web Push.
- The browser must allow notifications for your domain.

### 4) Notes

- The feature is browser push only, not email.
- If VAPID keys are missing, the app will show a setup message instead of failing silently.
- The push subscription is stored in the database so the server can target active subscribers.

See [SELF-HOSTING.md](./SELF-HOSTING.md) for a full production checklist.
