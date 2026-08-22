# AGENTS.md — Dastyare Social CS

Guide for AI agents consuming or extending this project. **Primary audience: external LLMs and agents calling the REST API.**

## Project summary

Dastyare Social CS is a Next.js creator studio. It exposes a REST API for posts and stories, with Better Auth for authentication. The frontend uses tRPC internally; external agents should prefer the documented REST endpoints.

- **Runtime:** Bun, Node 20+, PostgreSQL, S3-compatible storage
- **Dev port:** 8729
- **Config:** `config/app.config.yml` → generated JSON at build time

## API entry points

| Resource | Path | Purpose |
|----------|------|---------|
| OpenAPI spec | `/openapi.json` | Machine-readable API contract |
| Interactive docs | `/docs` | Scalar UI with MCP support |
| LLM site map | `/llms.txt` | Curated links for LLM crawlers |
| REST base | `/api` | All REST endpoints (see OpenAPI paths) |
| Auth | `/api/auth/*` | Better Auth (sign-in, sessions, API keys) |
| tRPC | `/api/trpc` | Internal frontend RPC — avoid for external integrations |

## Authentication

Better Auth with email/password, bearer tokens, and API keys.

- **Sign in:** `POST /api/auth/sign-in/email` with `{ "email", "password" }`
- **Bearer token:** `Authorization: Bearer <token>` on protected routes
- **API keys:** Created via Better Auth API key plugin; pass as bearer token

Public read endpoints (GET posts/stories) do not require auth. Write operations (POST, PATCH, DELETE) and media uploads require either the shared API key (`Authorization: Bearer <API_KEY>`) or a valid Better Auth session.

Admin bootstrap: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`; `bun run bootstrap:admin` creates or updates the admin user.

## Media Upload — Upload Files For Posts And Stories

Upload files first, then reference the returned URL when creating posts or stories.

- **`POST /api/upload`** — multipart/form-data with `file` field. Validates MIME and size limits, uploads to S3 under `media/<kind>/<uuid>.<ext>`, and returns:

```json
{
  "url": "https://cdn.example.com/media/image/abc.jpg",
  "key": "media/image/abc.jpg",
  "kind": "image",
  "mimeType": "image/jpeg",
  "size": 12345,
  "width": 1080,
  "height": 1920,
  "duration": 0,
  "filename": "photo.jpg"
}
```

- **`POST /api/upload-stream`** — same as `/api/upload` but returns Server-Sent Events for real-time progress tracking. Events: `progress` (with `percent` 0–100), `done` (with full media object), `error` (with `error` message).

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

Returns `201` with the created post. Upload files via `/api/upload` or `/api/upload-stream` first, then reference the returned URL. Multiple media items create one post per item, or a single image post when all items are images.

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

Upload files via `/api/upload` or `/api/upload-stream` first, then reference the returned URL. An array of media creates one story per item (returns the first).

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

## Data models (summary)

**PostWithReactions:** `id`, `type`, `content`, `views`, `pinnedAt`, `media` (JSONB), `createdAt`, `updatedAt`, `reactions[]` (`emoji`, `count`)

**StoryItem:** `id`, `type`, `url`, `duration`, `likes`, `views`, `createdAt`

Full schemas: `/openapi.json` → `components.schemas`

## Code layout for agents editing this repo

| Path | Responsibility |
|------|----------------|
| `src/app/api/*/route.ts` | REST handlers — add JSDoc `@openapi` tags here |
| `src/lib/api/` | Business logic (queries, mutations, S3 uploads) |
| `src/lib/db/schema/` | Drizzle tables + Zod schemas via drizzle-zod |
| `src/lib/trpc/router.ts` | tRPC procedures mirroring posts/stories logic |
| `src/lib/auth/` | Better Auth server config and React client |
| `src/lib/filters/` | Content filtering (NSFW words, HTML sanitization) |

## Conventions

- **Imports:** `@/` alias maps to `src/`
- **API logic:** Keep in `src/lib/api/`, not in route handlers
- **Schemas:** Drizzle schema → drizzle-zod → route validation
- **OpenAPI:** Annotate route handlers with JSDoc; run `bun run openapi:generate`
- **Config:** Edit YAML, never hand-edit `app.config.json`
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
- `src/app/[file]/route.ts` serves a verification file only when `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true` and matching filename env vars are present.
- `src/app/sitemap.ts` generates `/sitemap.xml` based on `app_url` and posts; ensure `NEXT_PUBLIC_APP_URL` is correct in production.
 - The app explicitly blocks indexing for sensitive routes (see `next.config.ts` `alwaysNoIndex`). By default these include `/os/*`, `/api/*`, `/agents.md`, and `/docs/*`.


## Analytics / PostHog (for agents)

This project sends analytics to PostHog for both client and server events. Agents and crawlers should be aware of the following configuration and events:

- Environment variables (see `.env.example`):
	- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` — client-side public token/key used by `posthog-js` (browser).
	- `POSTHOG_API_KEY` — server-side secret key used by `posthog-node`.
	- `NEXT_PUBLIC_POSTHOG_HOST` — custom host for self-hosted PostHog (defaults to `https://app.posthog.com`).

- Event names emitted by the server (important for agent telemetry and audit):
	- `llm_asset_requested` → properties: `{ asset: string, path: string }` (when `/openapi.json`, `/llms.txt`, or `/agents.md` are requested)
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

## Common commands

```bash
bun run dev                  # Start dev server
bun run openapi:generate     # Regenerate OpenAPI from route JSDoc
bun run db:generate          # New migration after schema change
bun run db:migrate           # Apply migrations
bun run lint                 # ESLint
```

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

The app ships a real MCP server exposing posts and stories as tools. Read tools (`list_posts`, `get_post`, `list_stories`, `get_story`, `count_stories`) are public. Write tools (`create_post`, `update_post`, `delete_post`, `create_story`, `update_story`, `delete_story`) require API-key auth.

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
