# AGENTS.md — Dastyare Social CS

Guide for AI agents consuming or extending this project. **Primary audience: external LLMs and agents calling the REST API.**

> [!WARNING]
> **SEO & LLM discovery is experimental.** This app exposes `llms.txt`, sitemaps, structured data, and MCP endpoints per current best practices, but whether search engines or AI assistants discover, cite, or surface its content can't be fully relied on.

## Project summary

Dastyare Social CS is a Next.js creator studio. It exposes a REST API for posts, stories, and outgoing webhooks, with Better Auth for authentication. The frontend uses oRPC internally; external agents should prefer the documented REST endpoints.

- **Runtime:** Bun, Node 20+, PostgreSQL, S3-compatible storage
- **Dev port:** 8729
- **Config:** `config/app.config.yml` → generated JSON at build time; `config/about.config.yml` → read at request time (no generation step)

## API entry points

| Resource | Path | Purpose |
|----------|------|---------|
| OpenAPI spec | `/openapi.json` | Machine-readable API contract |
| Interactive docs | `/docs` | Scalar UI with MCP support |
| LLM site map | `/llms.txt` | Curated links for LLM crawlers |
| Project context | `/context.md` | Compact agent context — read first |
| REST base | `/api` | All REST endpoints (see OpenAPI paths) |
| Auth | `/api/auth/*` | Better Auth (sign-in, sessions, API keys) |
| oRPC | `/api/rpc` | Internal frontend RPC — avoid for external integrations |

## Authentication

Better Auth with email/password, bearer tokens, and API keys.

- **Sign in:** `POST /api/auth/sign-in/email` with `{ "email", "password" }`
- **Bearer token:** `Authorization: Bearer <token>` on protected routes
- **API keys:** Created via Better Auth API key plugin; pass as bearer token

Public read endpoints (GET posts/stories) do not require auth. Write operations (POST, PATCH, DELETE) and media uploads require either the shared API key (`Authorization: Bearer <API_KEY>`) or a valid Better Auth session.

Admin bootstrap: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`; `bun run bootstrap:admin` creates or updates the admin user.

## Media Upload — Upload Files For Posts And Stories

Upload files first, then reference the returned URL when creating posts or stories.

### Presigned Upload (Recommended — Real Progress)

Browser uploads directly to S3, giving real upload progress via XHR.

1. **`POST /api/upload/presign`** — JSON body `{ filename, mimeType }`. Returns:

```json
{
  "uploadUrl": "https://s3.../media/image/abc.jpg?X-Amz-...",
  "key": "media/image/abc.jpg",
  "kind": "image",
  "mimeType": "image/jpeg"
}
```

2. **PUT file directly to `uploadUrl`** — browser sends file straight to S3 via XHR PUT with `Content-Type: mimeType`. Real `xhr.upload.progress` tracking.

3. **`POST /api/upload/confirm`** — JSON body `{ key, mimeType, filename, size, width, height, duration }`. Returns the full media object with public URL.

### Server-Side Upload (API clients / scripts)

- **`POST /api/upload`** — multipart/form-data with `file` field. Server buffers file then uploads to S3. Returns the full media object. Use for curl, MCP tools, and server-to-server integrations — no browser progress needed.

## REST API — Posts

Base: `/api/posts`

### List Posts — Paginated Feed

```
GET /api/posts?page=1&limit=20&search=keyword
GET /api/posts?type=count          → { "total": number }
GET /api/posts?type=shorts         → vertical videos only (1080×1920)
```

Response: `{ items: PostWithReactions[], total, hasMore, page, limit }`

Post types: `text`, `image`, `video`, `voice`, `file`

### Create Post — Upload Media Via URL

```
POST /api/posts
Content-Type: application/json
{ "content": "Hello world" }

POST /api/posts
Content-Type: application/json
{ "content": "Hello", "media": [{ "url": "https://cdn.example.com/media/image/abc.jpg", "type": "image", "width": 1080, "height": 1920 }] }
```

Returns `201` with the created post. Upload files via `/api/upload` or `/api/upload/presign` + `/api/upload/confirm` first, then reference the returned URL. Multiple media items create one post per item, or a single image post when all items are images.

### Batch Views — Increment View Counts

```
POST /api/posts
{ "action": "batch-view", "ids": ["id1", "id2"] }
```

### Single Post — Get, Update, Or Delete

```
GET    /api/posts/{post_id}
PATCH  /api/posts/{post_id}     body: partial post fields
DELETE /api/posts/{post_id}
```

### Post Actions — React Or View

```
POST /api/posts/{post_id}
{ "action": "reaction", "emoji": "👍" }

POST /api/posts/{post_id}
{ "action": "view" }
```

## REST API — Stories

Base: `/api/stories`

Story types: `image`, `video`

### List Stories — Paginated Feed

```
GET /api/stories?page=1&limit=20&search=keyword
GET /api/stories?type=count        → { "total": number }
GET /api/stories?kind=image        → filter by kind
GET /api/stories?kind=video
```

### Create Story — Upload Media Via URL

```
POST /api/stories
Content-Type: application/json
{ "type": "image", "media": { "url": "https://cdn.example.com/media/image/abc.jpg", "width": 1080, "height": 1920 } }

POST /api/stories
Content-Type: application/json
{ "type": "video", "media": [{ "url": "https://cdn.example.com/media/video/abc.mp4", "duration": 8000 }] }
```

Upload files via `/api/upload` or `/api/upload/presign` + `/api/upload/confirm` first, then reference the returned URL. An array of media creates one story per item (returns the first).

### Single Story — Get, Update, Or Delete

```
GET    /api/stories/{story_id}
PATCH  /api/stories/{story_id}
DELETE /api/stories/{story_id}
```

### Story Actions — View Or Like

```
POST /api/stories/{story_id}
{ "action": "view" }

POST /api/stories/{story_id}
{ "action": "like", "direction": "inc" | "dec" }
```

## REST API — Webhooks

Register endpoints to receive real-time events for posts and stories. Requires `Authorization: Bearer <API_KEY>`.

```
GET    /api/webhooks                     → list webhooks (with delivery status)
POST   /api/webhooks                     body: { "url": "https://...", "events": [...] }
GET    /api/webhooks/{webhook_id}        → single webhook
PATCH  /api/webhooks/{webhook_id}        body: partial { url?, events?, active? }
DELETE /api/webhooks/{webhook_id}
```

Events: `post.created | post.updated | post.deleted | post.reacted | post.viewed | story.created | story.updated | story.deleted | story.viewed | story.liked`

- `POST /api/webhooks` returns the webhook with its `secret` (only shown this once).
- Each event is delivered as a signed HTTP POST to the webhook URL with envelope `{ id, event, timestamp, data }`.
- Signature: `x-ds-webhook-signature: t=<unix>,v1=<hex>` = HMAC-SHA256 over `t.<unix>.<rawBody>` using the webhook `secret` (not the API key).
- Failed deliveries retry with backoff (up to 3 attempts). Status tracked per webhook: `lastStatus`, `lastAttemptAt`, `failureCount`.

## Data models (summary)

**PostWithReactions:** `id`, `type`, `content`, `views`, `pinnedAt`, `media` (JSONB), `createdAt`, `updatedAt`, `reactions[]` (`emoji`, `count`)

**StoryItem:** `id`, `type`, `url`, `duration`, `likes`, `views`, `createdAt`

Full schemas: `/openapi.json` → `components.schemas`

## Skills and the `ds-cs` CLI

DS-CS ships first-party agent skills in [`skills/`](./skills) — instructions that
tell an agent how to use this codebase and how to operate a channel. Install them
with the CLI in [`scripts/cli`](./scripts/cli):

```bash
bun run ds-cs init          # create skills directories (and optionally MCP config)
bun run ds-cs add           # browse the registry
bun run ds-cs add db-migration   # install one by name
bun run ds-cs list          # what is installed, and where it came from
```

Inside a DS-CS checkout `ds-cs add` installs from the local `skills/` directory
rather than from GitHub, so edits reinstall immediately.

The CLI reads and writes the same `skills-lock.json` as `npx skills`
(vercel-labs), so third-party skills and DS-CS skills coexist in one project
without either clobbering the other's state. `ds-cs update` refuses to overwrite
a skill with local edits unless `--force` is passed.

| Skill | Covers |
|-------|--------|
| [`dev/add-orpc-endpoint`](./skills/dev/add-orpc-endpoint) | Adding a procedure to `src/lib/orpc/router.ts` |
| [`dev/add-component`](./skills/dev/add-component) | Components without breaking the design system |
| [`dev/db-migration`](./skills/dev/db-migration) | Drizzle schema changes and migrations |
| [`dev/release`](./skills/dev/release) | Version bump, annotated tag, push |
| [`product/post-with-media`](./skills/product/post-with-media) | Posts, media upload, pinning |
| [`product/manage-stories`](./skills/product/manage-stories) | Ephemeral stories |
| [`product/webhooks`](./skills/product/webhooks) | Signed event delivery |
| [`product/brand-config`](./skills/product/brand-config) | Channel identity and the `/about` page |
| [`product/self-host-deploy`](./skills/product/self-host-deploy) | Install, update, back up |
| [`product/mcp-connect`](./skills/product/mcp-connect) | Connecting an agent over MCP |

CLI tests: `bun run skills:test`.

## Code layout for agents editing this repo

| Path | Responsibility |
|------|----------------|
| `src/app/api/*/route.ts` | REST handlers — add JSDoc `@openapi` tags here |
| `src/lib/api/` | Business logic (queries, mutations, S3 uploads) |
| `src/lib/db/schema/` | Drizzle tables + Zod schemas via drizzle-zod |
| `src/lib/orpc/router.ts` | oRPC procedures mirroring posts/stories logic |
| `src/lib/webhooks/` | Outbound webhook delivery (emit + HMAC signing + retries) |
| `src/lib/auth/` | Better Auth server config and React client |
| `src/lib/filters/` | Content filtering (NSFW words, HTML sanitization) |

## Conventions

- **Imports:** `@/` alias maps to `src/`
- **API logic:** Keep in `src/lib/api/`, not in route handlers
- **Schemas:** Drizzle schema → drizzle-zod → route validation
- **OpenAPI:** Annotate route handlers with JSDoc; run `bun run openapi:generate`
- **Config:** Edit YAML, never hand-edit `app.config.json`; `about.config.yml` is parsed fresh on every request — keep its `enabled` key first
- **Corners:** plain `border-radius` only — no `corner-shape` is applied anywhere in this app. `rounded-*` is stock Tailwind v4 (`rounded-xl` = 12px … `rounded-4xl` = 32px, `rounded-full` = true circle). Corner smoothing (`corner-shape: superellipse(n)`) was tried and removed: it read as a change to corner *size* rather than shape, and two radius-compensation scales (×1.21, then ×1.15) visibly oversized every corner, worst on the short full-bleed bars. Do not re-add it globally; if revisited, scope it to specific surfaces. The `@toolwind/corner-shape` package is unusable (its `superellipse` support is commented out and it imports an undeclared dependency). See `docs/design-system.md` §3 and the note in `src/styles/globals.css`.
- **Do not** refactor unrelated code; match existing patterns

## Environment variables

See `.env.example`. Critical vars:

- `DATABASE_URL` — PostgreSQL connection
- `API_KEY` — Shared API key for protected REST + MCP write operations
- `MCP_API_KEY` — Optional; enables write tools on the stdio MCP server when `API_KEY` is not set
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` — Auth
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — Bootstrap admin
- `S3_*` — Media storage (endpoint, bucket, credentials)
- `NEXT_PUBLIC_APP_URL` — Public URL for SEO/metadata
- `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` — Browser public key for Web Push
- `WEBPUSH_PRIVATE_KEY` — Private VAPID key for server-side sending
- `WEBPUSH_SUBJECT` — Contact URI such as `mailto:you@example.com`
- `NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS` — Comma-separated list of domains for Next.js Image optimization (e.g., `"example.com,cdn.example.com"`). Media from S3 storage is automatically included.

## Image Optimization Notes

- Remote images from S3 storage (`S3_ENDPOINT` or `S3_PUBLIC_BASE_URL`) are automatically configured for Next.js Image optimization
- Additional domains can be added via `NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS` environment variable
- Images from unconfigured domains use `unoptimized` mode (no size/format optimization)
- The `next.config.ts` dynamically builds `remotePatterns` from environment variables

## Search Console / SEO (agent notes)

- DNS verification (Cloudflare) is the recommended and simplest method; if the operator has already verified the domain via Cloudflare DNS TXT records, the app does not need to serve meta tags or verification files.
- The app supports optional verification helpers controlled by env vars:
	- `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true` — enables meta/file verification behavior.
	- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` — meta token (used when `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true`).
	- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE` — filename for HTML-file verification.
	- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE_CONTENT` — optional exact file contents.
	- `NEXT_PUBLIC_ALLOW_INDEXING=true` — when set in production, allows search engines to index the site; default behavior blocks indexing with `X-Robots-Tag`.
- The `verification.google` field in `src/app/(routes)/layout.tsx` (Next.js metadata API) injects `google-site-verification` only when `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true` and `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is set.
- `src/app/google-verification/route.ts` (reached only via a scoped rewrite for the exact verification filename in `next.config.ts`) serves a verification file only when `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true` and matching filename env vars are present.
- `src/app/sitemap.ts` generates `/sitemap.xml` based on `app_url` and posts; ensure `NEXT_PUBLIC_APP_URL` is correct in production.
 - The app explicitly blocks indexing for sensitive routes (see `next.config.ts` `alwaysNoIndex`). By default these include `/os/*`, `/api/*`, `/agents.md`, and `/docs/*`.


## Analytics / PostHog (for agents)

This project sends analytics to PostHog for both client and server events. Agents and crawlers should be aware of the following configuration and events:

- Environment variables (see `.env.example`):
	- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` — client-side public token/key used by `posthog-js` (browser).
	- `POSTHOG_API_KEY` — server-side secret key used by `posthog-node`.
	- `NEXT_PUBLIC_POSTHOG_HOST` — custom host for self-hosted PostHog (defaults to `https://app.posthog.com`).

- Event names emitted by the server (important for agent telemetry and audit):
	- `llm_asset_requested` → properties: `{ asset: string, path: string }` (when `/openapi.json`, `/llms.txt`, `/agents.md`, or `/context.md` are requested)
	- `posts_list_requested` → `{ page, limit, has_search, type }` (GET `/api/posts` list)
	- `post_requested` → `{ post_id }` (GET `/api/posts/{id}`)
	- `post_created` → `{ post_id, post_type, has_media, content_length }`
	- `post_updated` → `{ post_id, updated_fields, post_type }`
	- `post_viewed` → `{ post_id, views }`
	- `post_reacted` → `{ post_id, emoji, reaction_count }`
	- `post_batch_viewed` → `{ post_ids, count }`
	- `post_deleted` → `{ post_id }`
	- `stories_list_requested` → `{ page, limit, has_search, kind }` (GET `/api/stories` list)
	- `story_requested` → `{ story_id }` (GET `/api/stories/{id}`)
	- `story_created` → `{ story_id, story_type, has_media, views, likes }`
	- `story_updated` → `{ story_id, updated_fields, story_type }`
	- `story_viewed` → `{ story_id, views }`
	- `story_liked` → `{ story_id, direction, likes }`
	- `story_deleted` → `{ story_id }`
  - `push_subscription_saved` → `{ endpoint, active, user_agent }`
  - `push_subscription_failed` → `{ error }`
  - `push_notifications_sent` → `{ sent, failed, total }`
  - `push_notifications_failed` → `{ error }`
  - `mcp_tool_called` → `{ method, tool, authenticated, isError }` — MCP tool calls are captured after the response is available, so `tool` names and per-call `isError` (success/failure) are tracked for observability

Client events (browser) include `client_error` → `{ message, stack, error_name, source, url }` emitted on uncaught exceptions / unhandled promise rejections via `setupClientErrorTracking()` in `src/lib/analytics/client.ts`.

Guidance for agents:

- Agents should not expose or attempt to fetch `POSTHOG_API_KEY` or other secrets. Use the public `/docs`, `/openapi.json`, and other read endpoints to discover API shapes.
- If instrumenting behaviors or verifying telemetry, prefer observable read endpoints (e.g., `/api/posts`) and correlate local actions with emitted events.
- For AI tooling that generates requests, respect rate limits and auth requirements (see `API_KEY` and Better Auth plugin).

Installation notes (for operators)

- Automated setup: operators can run PostHog's AI wizard from the project root to scaffold client-side setup:

```bash
npx -y @posthog/wizard@latest
```

- Manual steps (mapping to this repo):

	1. Install `posthog-js` (client) and ensure `posthog-node` is available on the server.

		 ```bash
		 bun add posthog-js posthog-node
		 ```

	2. Copy the dashboard **Project API key / token** into `NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY` and a server **Personal API key** or **Project Secret** into `POSTHOG_API_KEY`.

	3. Client init is centralized in `src/lib/analytics/client.ts`. Agents should not attempt to read or fetch `POSTHOG_API_KEY` (server secret).

## Release & versioning

**Whenever someone — a human or an agent — says "stage and push changes", treat it as a release, not just a commit.** Do not push a bare commit.

The sequence, in order:

1. **Review the changes first.** `git status`, `git diff`, and `git diff --cached`. Decide what is actually being released and whether anything unrelated is in the working tree.
2. **Stage selectively.** Stage only the files belonging to this change. If unrelated edits are present, leave them unstaged and say so explicitly — never sweep them in silently.
3. **Bump the version in `package.json`** based on the nature of the change (see the table below). `next.config.ts` bakes it into the build as `NEXT_PUBLIC_APP_VERSION`, which drives the in-app update banner.
4. **Commit and push.**
5. **Tag the commit you just pushed** as `v<new version>` (annotated), and push the tag:
   ```bash
   git tag -a v0.3.4 -m "v0.3.4"
   git push origin main --follow-tags
   ```
6. **Report** the new version, the tag, and anything you deliberately left out.

### Version bump rules

Keep-a-Changelog / SemVer. Judge the bump from the diff, not from the commit message.

| Change | Bump | Example |
|---|---|---|
| Bug fix, refactor, internal/infra change with no user-visible effect | **patch** | `v0.3.3` → `v0.3.4` |
| New feature, new endpoint, new capability | **minor** | `v0.3.4` → `v0.4.0` |
| Breaking change — removed/renamed public API, config or env var changes, DB migrations that break existing data | **major** | `v0.4.0` → `v1.0.0` |

Notes:

- Never skip a number. Read the current version from `package.json` first — it is the source of truth.
- A version bump is **always** included; never push without one.
- Do not bump for a bump alone. If the diff is empty or contains only whitespace, stop and ask.
- If the changes are ambiguous between two levels, choose the **lower** one and mention the alternative in your report.

### Tag convention

Tags are annotated and named `vMAJOR.MINOR.PATCH`. The tag points at the commit that carries that version — matching history: `v0.3.3` → `bdf48a1`, `v0.3.2` → `03edf03`, `v0.3.1` → `9d18494`.

Before tagging, confirm nothing is already tagged at that name:

```bash
git tag -l            # existing tags
git tag -l v0.3.4     # must be empty before you create it
```

Never move or force-update an existing tag that has already been pushed. If a tag already exists, stop and ask.

## Common commands

```bash
bun run dev                  # Start dev server
bun run openapi:generate     # Regenerate OpenAPI from route JSDoc
bun run db:generate          # New migration after schema change
bun run db:migrate           # Apply migrations
bun run lint                 # ESLint
bun run test                 # Test suite — ALWAYS via this script (see below)
bun run ds-cs add            # Install agent skills
bun run skills:test          # CLI test suite
```

### Always run tests with `bun run test`, never bare `bun test`

The `test` script passes `--isolate`, which gives each test file a fresh global. Without it, Bun shares one module registry across every test file, so a `vi.mock('../some-component')` in one file silently replaces that module for **every file that runs after it**.

This is not hypothetical — it broke CI on Linux while passing on macOS:

- `src/components/__tests__/shorts.test.tsx` mocks `../short`
- `short.test.tsx` then imported the **stub** instead of the real component, and the two loader tests failed with `Unable to find [data-testid="loader"]`
- File discovery order is filesystem-dependent, so it passed locally (macOS) and failed on CI (Linux)

`--isolate` is a **CLI flag only** — Bun's `bunfig.toml` `[test]` section has no `isolate` key and silently ignores unknown keys, so it cannot be defaulted in config. Always go through `bun run test`.

## Deployment helpers

Use Docker Compose to run the app with database and local storage.

```bash
docker compose up -d --build
```

For development with hot reload and mounted code:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## MCP integration

The app ships a real MCP server exposing posts, stories, webhooks, and the resume config as tools. Read tools (`list_posts`, `get_post`, `list_stories`, `get_story`, `count_stories`, `list_webhooks`, `get_webhook`, `get_resume_config`) are public. Write tools (`create_post`, `update_post`, `delete_post`, `create_story`, `update_story`, `delete_story`, `create_webhook`, `update_webhook`, `delete_webhook`, `update_resume_config`, `set_resume_enabled`) require API-key auth. Webhook tools manage the same endpoints as `GET/POST /api/webhooks` and `GET/PATCH/DELETE /api/webhooks/{id}`. Resume tools read/edit `config/about.config.yml` (the `/about` page); its first key must be `enabled:`.

Two transports are provided:

### 1. Remote (Streamable HTTP) — served by the app

- Endpoint: `{APP_URL}/api/mcp` (`POST`/`GET`/`DELETE`, JSON responses enabled)
- Discovery: `{APP_URL}/.well-known/mcp` returns an `mcpServers` manifest
- The `/docs` Scalar UI shows MCP connection details via its `mcp` config

Connect from a remote MCP client (`.mcp.json`):

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "{APP_URL}/api/mcp"
    }
  }
}
```

For write access, include the API key as a header on the MCP server:

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "{APP_URL}/api/mcp",
      "headers": { "Authorization": "Bearer {API_KEY}" }
    }
  }
}
```

### 2. Local (stdio) — separate process

Run `bun run mcp` (wraps `scripts/mcp-server.ts`) to start a stdio MCP server that connects directly to the database. Write tools are enabled only when `MCP_API_KEY` or `API_KEY` is set. Register it for local agents:

```json
{
  "mcpServers": {
    "ds-cs": {
      "command": "bun",
      "args": ["run", "mcp"]
    }
  }
}
```

The repo root already includes this registration in `.mcp.json` (auto-discovered by Claude Code / Cursor).

### Tool reference

| Tool | Auth | Description |
|------|------|-------------|
| `list_posts` | public | Paginated posts; `type=count`/`shorts`, `search` |
| `get_post` | public | Single post by id |
| `list_stories` | public | Paginated stories; `type` filter |
| `get_story` | public | Single story by id |
| `count_stories` | public | Total story count |
| `create_post` | API key | Create text or media post |
| `update_post` | API key | Update content / pin status |
| `delete_post` | API key | Delete post |
| `create_story` | API key | Create story from media URL |
| `update_story` | API key | Update story media/views/likes |
| `delete_story` | API key | Delete story |

Implementation lives in `src/mcp/` (`server.ts`, `tools/`), the HTTP route in `src/app/api/mcp/route.ts`, and the stdio entry in `scripts/mcp-server.ts`.

The `/docs` Scalar UI also exposes MCP discovery derived from the OpenAPI spec.
