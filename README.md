# Dastyare Social — CS

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Deploy](https://img.shields.io/badge/deploy-Docker%20%7C%20Bun-lightgrey)](https://github.com/yourname/dastyare_social_cs)
[![Stars](https://img.shields.io/badge/stars-PLACEHOLDER-yellow)](https://github.com/yourname/dastyare_social_cs/stargazers)
[![Forks](https://img.shields.io/badge/forks-PLACEHOLDER-lightgrey)](https://github.com/yourname/dastyare_social_cs/network/members)

## Why this project

Dastyare Social CS is a production-ready creator studio built around:
- modern REST API with OpenAPI docs and MCP-ready agent support
- self-hosted media upload via S3-compatible storage
- Better Auth integration for sessions, API keys, and admin bootstrap

## Popularity & growth

- clear deployment and self-hosting documentation
- a fast developer workflow with Bun and Drizzle migrations
- a growing open-source mindset for maintainability and QA

> Replace the badge placeholders above with live GitHub stars/forks once the repo is public.

## Quick start

**Requirements:** Bun, Node.js 20+, PostgreSQL, an S3-compatible storage provider, and FFmpeg/FFprobe (for video dimension detection).

### Local quick start

```bash
cp .env.example .env
bun install
bun run dev          # http://localhost:8729
```

### One-command server install

Use the install script to bootstrap the repository on a fresh server or VPS.
```bash
curl -fsSL https://raw.githubusercontent.com/yourname/dastyare_social_cs/main/scripts/install.sh | bash
```
> The script creates a default `.env`, builds Docker Compose services, and starts the app.

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

### PostHog analytics configuration

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (required for client-side): Public project token/key used by `posthog-js` in the browser. Find it in PostHog under Project Settings → Setup → JavaScript snippet. This value is safe to expose to browsers but avoid committing it in public repos if you don't want to disclose analytics to third parties.
- `POSTHOG_API_KEY` (required for server-side): Secret key used by `posthog-node` for server capture and optional local evaluation. Use a Project Secret or Personal API Key from PostHog and keep it private (never commit to source control).
- `NEXT_PUBLIC_POSTHOG_HOST` (optional): PostHog host URL. Defaults to `https://app.posthog.com` for PostHog Cloud. If you self-host PostHog, use your host URL such as `https://us.i.posthog.com` or `https://analytics.example.com`.

How to set keys:

1. Create or sign in to your PostHog account and open the target Project.
2. For client events, copy the **Project API key / token** (JavaScript snippet) into `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`.
3. For server events, create a **Personal API key** or use a **Project Secret** (recommended) and set it as `POSTHOG_API_KEY`.
4. Optionally set `NEXT_PUBLIC_POSTHOG_HOST` (and `POSTHOG_HOST` if preferred) to your PostHog host.
5. Restart the dev server or rebuild (`bun run dev` / `bun run build`).

Security notes:

- Never commit `POSTHOG_API_KEY` to the repo. Use secret managers (GitHub Actions secrets, Docker secrets, Vault) in CI/CD.
- Rotate keys periodically and restrict the scope of Personal API keys where possible.

Troubleshooting:

- If you see no events in PostHog, ensure `POSTHOG_API_KEY` is present in the runtime environment for server processes and `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is present for the browser build.
- Check the network tab for client-side `capture` calls and server logs for PostHog capture failures.

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

## Docker Compose

### Production

```bash
docker compose up -d --build
```

The default `docker-compose.yml` includes services for:

- `app` — the Next.js app
- `db` — PostgreSQL
- `minio` — local S3-compatible storage

### Development

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

The `docker-compose.dev.yml` file mounts the repository into the container and runs the dev server.

## Architecture

```
src/

## Production checklist (SEO / Search Console)

Follow these before going live:

- Set `NEXT_PUBLIC_APP_URL` to your production URL (use `https://`).
- Add one of these verification methods in your production environment:
 - Set `NEXT_PUBLIC_ALLOW_INDEXING` to `true` in production when you want search engines to index the site. By default indexing is blocked via `X-Robots-Tag`.
 - If you need app-sided Search Console helpers (meta/file), enable them with `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true` and then choose one verification method:
  - Meta tag: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to the token Google provides.
  - File: set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE` (filename) or `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (token). Optionally set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE_CONTENT` to the exact file Google gives you. The app serves the file at `https://<your-host>/<filename>` when `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true`.
- Ensure `robots.txt` and `/sitemap.xml` are reachable (this app generates them via `src/app/robots.ts` and `src/app/sitemap.ts`).
- Verify HTTPS on your host and make sure `NEXT_PUBLIC_APP_URL` uses `https://`.
- After deploying, add your site in Google Search Console and verify ownership using the chosen method. Then submit `/sitemap.xml` in the Sitemaps section.

For a full verification and Lighthouse guide, see [SEARCH-CONSOLE.md](SEARCH-CONSOLE.md).

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

## Releases

Push a version tag to publish a GitHub Release with automatically generated
release notes:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Use semantic versions: patch releases for fixes (`v0.1.1`), minor releases for
new features (`v0.2.0`), and major releases for breaking changes (`v1.0.0`).

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
