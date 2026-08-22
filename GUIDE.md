# Dastyare Social — CS — Developer Guide

A complete, hands-on guide to the **Dastyare Social CS** project: a production-ready creator studio with a REST API, OpenAPI docs, self-hosted media uploads, Better Auth, web push notifications, an MCP agent server, and an operator ("OS") dashboard.

This guide complements `README.md` (quick start + self-hosting) and `AGENTS.md` (agent-facing API reference). It focuses on how the code is organized and how the pieces work together.

---

## 1. Overview

Dastyare Social CS is a single Next.js app that serves:

- **Public creator site** — home feed, explore (shorts + threads), post pages, resume page.
- **Operator dashboard** (`/os`) — manage posts, stories, media, and admin account.
- **REST API** — OpenAPI-documented endpoints for posts, stories, media, push, and auth.
- **tRPC layer** — used internally by the frontend for reads and writes.
- **MCP server** — lets AI agents interact with the content via stdio or HTTP.
- **Web push notifications** — browser push to opted-in subscribers via VAPID + Web Push.

Design principles:

- **Server-first**: business logic lives in `src/lib/api/*` (mutations/queries), shared by REST routes, tRPC procedures, server actions, and MCP tools. Auth and demo-mode guards are enforced in that shared layer.
- **OpenAPI-first REST**: route handlers carry `@id` / `@description` JSDoc that `openapi:generate` turns into `public/openapi.json` served by Scalar at `/docs`.
- **Self-hostable**: PostgreSQL + S3-compatible storage (MinIO, R2, S3, etc.), Docker Compose, and a one-line server install script.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router, Turbopack build) |
| UI | React 19, Tailwind CSS 4, Radix UI primitives, lucide-react, nextjs-toploader, GSAP |
| Language | TypeScript 5 (strict), Bun runtime |
| ORM / DB | Drizzle ORM + PostgreSQL (via `pg` / `postgres`) |
| Auth | Better Auth (sessions, accounts, API keys, admin bootstrap) |
| API | tRPC 11 (frontend), REST route handlers (OpenAPI via JSDoc) |
| Media | AWS SDK v3 (S3-compatible), sharp, ffmpeg-probe |
| Push | web-push (VAPID), Service Worker push + notification handlers |
| Analytics | PostHog (posthog-js client + posthog-node server) |
| i18n | next-intl (single `en` locale) |
| Tests | bun test (vitest-compatible runners), @testing-library/react, Playwright (dev) |
| Lint | ESLint (eslint-config-next + typescript) |
| MCP | @modelcontextprotocol/sdk (stdio + HTTP) |

---

## 3. Repo layout

```
config/                  # app.config.yml/.json (name, username, etc.)
scripts/
  install.sh             # one-line server bootstrap (curl | bash)
  bootstrap-admin.ts     # create/update admin from env
  generate-app-config.ts # yml -> src/config/app.ts
  generate-icons.ts      # app/manifest icons from source art
  mcp-server.ts          # standalone stdio MCP server entrypoint
  validate-sitemap.js    # sitemap sanity check
public/
  sw.js                  # service worker (hand-written, self-contained)
  openapi.json           # generated OpenAPI spec
  web-app-manifest-*.png # PWA icons
src/
  app/
    (routes)/            # pages: (main) feed, explore, os (admin), posts/[post_id], resume
    api/                 # REST: posts, stories, media, upload, push, auth, trpc, mcp, og, .well-known/mcp
    manifest.ts          # PWA web app manifest
    robots.ts, sitemap.ts, llms.txt, agents.md, docs/readme
  components/            # UI components + modals (notifications, profile)
  config/                # generated app config, routes, constants, locale
  lib/
    api/posts|stories/   # mutations.ts + queries.ts + index.ts (shared business logic)
    auth/                # Better Auth server/client + API key auth
    db/                  # drizzle schema, migrations, migrate.ts
    filters/             # content sanitization pipeline (NSFW, HTML)
    media/               # S3 upload, size/MIME config, auth
    notifications/       # client (subscribe/toggle), push (send), status
    trpc/                # tRPC router + procedures (posts, stories)
    utils/               # shared helpers, media utils
    hooks/               # use-posts, use-media-upload
  mcp/                   # MCP server factory + posts/stories tools
  services/locale.ts     # locale resolution
  styles/globals.css
translations/en.json     # next-intl messages
```

---

## 4. Prerequisites & setup

Requirements: **Bun**, Node.js 20+, **PostgreSQL**, an **S3-compatible storage** provider, and **FFmpeg/FFprobe** (for video dimension detection).

```bash
cp .env.example .env      # then fill in the values (see §5)
bun install
bun run dev               # http://localhost:8729
```

Useful one-time steps:

```bash
docker compose -f docker-compose.dev.yml up -d db minio   # local Postgres + MinIO
bun run db:migrate                                         # apply schema
bun run bootstrap:admin                                    # create admin account
npx web-push generate-vapid-keys                           # for push (§8)
```

Or bootstrap a fresh server with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/dastyare-social/DS-CS/main/scripts/install.sh | bash
```

---

## 5. Environment variables

All documented in `.env.example` with comments. Key groups:

| Group | Variables |
|---|---|
| Database | `DATABASE_URL` |
| Admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD` (used by `bootstrap:admin`) |
| API auth | `API_KEY`, `API_KEY_RATE_LIMIT_MAX_REQUESTS`, `API_KEY_RATE_LIMIT_WINDOW_MS`, optional `MCP_API_KEY` |
| Auth | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` |
| Media/S3 | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_BASE_URL`, `MEDIA_MAX_*_SIZE_MB`, `MEDIA_ALLOWED_MIME_TYPES`, `MEDIA_KEY_PREFIX` |
| Push | `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY`, `WEBPUSH_PRIVATE_KEY`, `WEBPUSH_SUBJECT` |
| App | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ANIMATED_EMOJIES`, `DS_SH_URL`, `DS_SH_API_KEY` |
| Analytics | `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `POSTHOG_API_KEY` |
| SEO | `NEXT_PUBLIC_ALLOW_INDEXING`, `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION*`, `NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS` |

**Important conventions:**

- `NEXT_PUBLIC_*` variables are inlined into the client bundle. Anything without the prefix is **server-only** — reading it in a client component yields `undefined`.
- Never commit `.env`. It is git-ignored.
- `DEMO_MODE` (see §11) is intentionally **not** in `.env.example` or the README — it is an operator-only switch documented in this guide.

---

## 6. Common commands

| Command | What it does |
|---|---|
| `bun run dev` | Generate config/icons, start dev server on :8729 |
| `bun run build` | Config → icons → `db:migrate` → `bootstrap:admin` → `next build` |
| `bun run start` | Serve production build on :8729 |
| `bun run lint` | ESLint over the repo |
| `bun test` | Run unit tests (bun test) |
| `bun run db:generate` | Create a migration from schema changes |
| `bun run db:migrate` | Apply migrations |
| `bun run db:push` | Push schema + seed |
| `bun run db:studio` | Drizzle Studio UI |
| `bun run db:check` | Validate schema/migrations |
| `bun run openapi:generate` | Regenerate `public/openapi.json` from route JSDoc |
| `bun run validate:sitemap` | Validate generated sitemap |
| `bun run mcp` | Start the standalone stdio MCP server |
| `bunx tsc --noEmit` | Type-check (no emit) |
| `bunx playwright test` | Run Playwright e2e tests (if configured) |

> Note: the build runs `db:migrate` and `bootstrap:admin`, so it requires `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

---

## 7. Configuration & i18n

- **App profile** lives in `config/app.config.yml` (name, username, description). `bun run generate:config` syncs it into `src/config/app.ts`, which the app reads everywhere (metadata, header, manifest, OG images).
- **Locale** is a single `en` locale (`src/config/locale.ts`). Messages are in `translations/en.json`, served via next-intl (`src/i18n.ts`). `src/services/locale.ts` resolves the current locale (persisted preference → default).

---

## 8. Database

Drizzle schema in `src/lib/db/schema/`:

- `users`, `sessions`, `accounts`, `verifications` — Better Auth tables.
- `posts` — content rows with `media` (JSON), optional pinning (`pinned_at`).
- `stories` — story content (image/video) with view + like counters.
- `reactions` — post emoji reactions.
- `subscribers` — push subscription storage (endpoint, keys, active flag).
- `push-subscriptions` — push subscription records used by `sendPushNotification`.

Migration workflow:

```bash
# 1) change a schema file
# 2) generate
bun run db:generate
# 3) inspect + apply
bun run db:migrate
```

Migrations are plain SQL under `src/lib/db/migrations/`. `scripts/bootstrap-admin.ts` creates/updates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 9. Architecture & data flow

The key rule: **`src/lib/api/*` is the single source of truth for business logic.** Everything else is a thin transport on top.

```
UI (React) ──► tRPC procedures ──┐
External ────► REST handlers ────┼──► src/lib/api/{posts,stories}/mutations.ts & queries.ts ──► Drizzle ──► Postgres
AI agents ───► MCP tools ────────┘
```

- **`src/lib/api/posts/mutations.ts`**: `createPost`, `updatePost`, `deletePostById`, `viewPost`, `batchIncrementViews`, `addReaction`, plus `sendPushNotification` on new content.
- **`src/lib/api/stories/mutations.ts`**: `createStory`, `updateStory`, `deleteStoryById`, `incrementStoryViews`, `toggleStoryLike`.
- **`src/lib/api/*/queries.ts`**: reads — lists with pagination/search, counts, by-id.
- **REST handlers** (`src/app/api/...`) validate input with zod and call the same functions; mutations are additionally guarded by API-key auth where appropriate.
- **tRPC** (`src/lib/trpc/router.ts`) exposes `posts.*` and `stories.*` procedures (list, count, getById, create, update, delete, view, like, reaction, batchView). The frontend hooks (`src/lib/hooks/use-posts.ts`, `use-media-upload.ts`) consume these.
- **Server actions** (`src/lib/actions/*`) wrap the shared functions for `useTransition`-style client usage (e.g., view batching).

---

## 10. Features walkthrough

### 10.1 Media upload (S3)

- `POST /api/upload` accepts multipart `file`; `POST /api/upload-stream` is the same but streams real-time progress via SSE.
- `src/lib/media/upload.ts` validates size/MIME (see `MEDIA_*` env), probes dimensions (sharp / ffmpeg-probe), uploads to the S3-compatible bucket, and returns `{ url, key, kind, mimeType, size, width, height, duration }`.
- Use the returned `url` as `media` when creating posts/stories. `src/lib/media/config.ts` builds the bucket client; `src/lib/media/auth.ts` guards access where needed.

### 10.2 Content filters

`src/lib/filters/` runs a sanitization pipeline (HTML/script stripping, NSFW handling) over text content before rendering. `render-post-markdown.tsx` renders post markdown client-side.

### 10.3 Posts & stories

- Posts support text and media (`text | image | video | voice | file`), emoji reactions, pinning, views, and search.
- Stories support image/video, likes, and views.
- Publishing triggers `sendPushNotification` to active subscribers (§10.4).

### 10.4 Web push notifications

Flow:

1. Operator sets VAPID keys (`NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY`, `WEBPUSH_PRIVATE_KEY`, `WEBPUSH_SUBJECT`).
2. User opens the notification modal (`src/components/modals/notifications.tsx`) via "Join My Channel".
3. `src/lib/notifications/client.ts` registers `/sw.js`, requests `Notification.requestPermission()`, subscribes via `pushManager.subscribe`, and POSTs the subscription to `/api/push`.
4. On new posts/stories, `sendPushNotification` (`src/lib/notifications/push.ts`) uses `web-push` to deliver to stored subscribers.
5. The service worker (`public/sw.js`) handles `push` (show notification) and `notificationclick` (open target URL).

**Notifications are independent of PWA install** — enabling browser push does not require installing the app.

### 10.5 PWA (install to home screen)

- `src/app/manifest.ts` serves a valid web app manifest (name, standalone display, 192/512 icons).
- `public/sw.js` is a self-contained service worker with `install`/`activate`/`fetch` handlers (runtime caching, network-first navigations) plus `push`/`notificationclick`.
- `src/components/register-pwa.tsx` registers `/sw.js` on page load (mounted in the routes layout).
- Because the served `sw.js` registers a fetch handler and the manifest is valid, Chrome surfaces the **built-in address-bar install icon** automatically on HTTPS — no custom install UI is needed.

> The SW is hand-maintained in `public/sw.js`. Do not rely on a build step to generate it (Serwist was removed because Next 16's Turbopack build does not run its webpack plugin).

### 10.6 OS admin dashboard

- `/os` is the operator panel (`src/app/(routes)/os/`). It requires admin sign-in (Better Auth) and exposes post management: create, edit, pin/unpin, delete, plus stories and media management.
- Route handlers and mutations apply the same business logic and guards as the public surface (including demo mode).

### 10.7 SEO, analytics & metadata

- `src/app/robots.ts` + `src/app/sitemap.ts` generate `robots.txt` and `sitemap.xml`; `src/app/llms.txt` and `agents.md` serve agent-oriented docs.
- `src/components/seo.tsx` and `next.config.ts` `headers()` control `X-Robots-Tag`. Indexing is blocked unless `NEXT_PUBLIC_ALLOW_INDEXING=true`.
- PostHog captures client events (`src/lib/analytics/client.ts`) and server events (`src/lib/analytics/server.ts`), wired through `src/components/analytics.tsx`.
- OG images: `src/app/api/og/*` generate home/explore/post cards via `ImageResponse`.

### 10.8 MCP (agents)

Two entrypoints:

- **HTTP**: `src/app/api/mcp/route.ts` (+ discovery at `src/app/.well-known/mcp/route.ts`).
- **stdio**: `bun run mcp` (`scripts/mcp-server.ts`), used by the repo's `.mcp.json`.

`src/mcp/server.ts` builds the server with post + story tools. Write tools honor a `canWrite` callback wired to demo mode and/or `MCP_API_KEY`/`API_KEY`.

### 10.9 Demo mode

An **operator-only** switch (set `DEMO_MODE=true` in the server `.env`):

- Disables **create/update/delete** across the whole app — REST returns `403 {"error":"Read-only demo mode is active"}`, mutations throw `DemoModeError` ("Demo mode is enabled: create, update and delete operations are disabled.").
- **Reads, views, likes, and redirects keep working** (internal helpers `updatePostInternal` / `updateStoryInternal` bypass the guard for view/like bookkeeping).
- Enforced by `src/lib/demo-mode.ts` (`isDemoMode()` / `assertWritable()`) called at the top of every write mutation and REST write handler.
- The UI is unchanged; when a write fails, the OS dashboard shows a transient error toast instead of hiding controls.
- `DEMO_MODE` is deliberately not in `.env.example` or public docs.

---

## 11. Auth

- **Sessions** — Better Auth (email/password) via `/api/auth/*`. Admin sign-in on `/os`.
- **API keys** — `src/lib/auth/api-key.ts` implements `requireApiKeyAuth`, which expects `Authorization: Bearer <API_KEY>` (not `x-api-key`). REST write/read routes use it; rate limits are configured via `API_KEY_RATE_LIMIT_*`.
- **MCP** — can require `MCP_API_KEY` (falls back to `API_KEY`).

---

## 12. Testing

```bash
bun test                 # unit tests
bunx tsc --noEmit        # type-check
bun run lint             # ESLint
bunx playwright test     # e2e (if configured)
```

Test locations: `src/components/__tests__/`, `src/lib/**/__tests__/` (e.g. `filters`, `media`, `hooks`, `auth`, `notifications`). `test-setup.ts` + `src/types/bun-test.d.ts` wire the bun test runner; `vitest` and `jsdom`/`happy-dom` are available.

---

## 13. Deployment

- **Docker Compose** (`docker-compose.yml`): `app`, `db` (Postgres), `minio` (S3-compatible). Dev variant: `docker-compose.dev.yml`. `docker compose up -d --build`.
- **VPS** — `scripts/install.sh` bootstraps env, DB, and services.
- **Vercel / Railway / Render** — see `SELF-HOSTING.md` for per-provider steps (DB, S3/MinIO, VAPID, env).
- **Releases** — push a semantic version tag (`git tag v0.1.1 && git push origin v0.1.1`) to trigger a GitHub Release with generated notes.

Production checklist (also in README/`SEARCH-CONSOLE.md`): HTTPS, `NEXT_PUBLIC_APP_URL=https://...`, indexing enabled, robots/sitemap reachable, VAPID keys set, admin bootstrapped.

---

## 14. Git workflow

- **Conventional commits**: `feat(scope):`, `fix(scope):`, `chore:`, etc.
- **Branching**: small self-contained fixes commit directly to `main`. Larger features get a branch (e.g. `feat/push-flow`) merged into `main` via PR — even solo, this keeps `main` shippable and gives a review/revert checkpoint.
- Before committing: `git status`, `git diff`, `git log --oneline -10`; stage only intended files; never commit secrets (`.env`, keys).

---

## 15. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Push "Setup required" | VAPID keys missing (`NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` / `WEBPUSH_PRIVATE_KEY`). |
| 403 on writes | Demo mode active, or missing/wrong `Authorization: Bearer <API_KEY>`. |
| Build fails on `bootstrap:admin` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` not set. |
| Media upload 400 | MIME/size exceeds `MEDIA_MAX_*_SIZE_MB` / `MEDIA_ALLOWED_MIME_TYPES`. |
| No install icon in Chrome | Ensure `public/sw.js` is served with a fetch handler and the manifest is valid on HTTPS. |
| SEO not indexed | `NEXT_PUBLIC_ALLOW_INDEXING` not `true`; check `X-Robots-Tag` in network tab. |
