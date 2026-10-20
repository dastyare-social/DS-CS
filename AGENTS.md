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
| [`zernio/*`](./skills/zernio) | Scheduling, analytics, messaging, ads and blogs via Zernio (also loaded by the Mastra agent) |

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
| `src/mastra/` | Mastra agent scaffold — orchestrator, specialists, tools (web, channel, video, QA, schedules), guardrails, memory, RAG, Zernio MCP/OAuth, skills |
| `src/components/workspace-shell.tsx` | Resizable desktop side panels around the feed (empty by design) |

## Conventions

- **Imports:** `@/` alias maps to `src/`
- **API logic:** Keep in `src/lib/api/`, not in route handlers
- **Schemas:** Drizzle schema → drizzle-zod → route validation
- **OpenAPI:** Annotate route handlers with JSDoc; run `bun run openapi:generate`
- **Config:** Edit YAML, never hand-edit `app.config.json`; `about.config.yml` is parsed fresh on every request — keep its `enabled` key first
- **Corners:** plain `border-radius` only — no `corner-shape` is applied anywhere in this app. `rounded-*` is stock Tailwind v4 (`rounded-xl` = 12px … `rounded-4xl` = 32px, `rounded-full` = true circle). Corner smoothing (`corner-shape: superellipse(n)`) was tried and removed: it read as a change to corner *size* rather than shape, and two radius-compensation scales (×1.21, then ×1.15) visibly oversized every corner, worst on the short full-bleed bars. Do not re-add it globally; if revisited, scope it to specific surfaces. The `@toolwind/corner-shape` package is unusable (its `superellipse` support is commented out and it imports an undeclared dependency). See `docs/design-system.md` §3 and the note in `src/styles/globals.css`.
- **Transient errors:** call `raiseError()` from `@/lib/error-bar` — it drives the global error bar (`src/components/error-bar.tsx`), which is mounted once in `src/app/(routes)/layout.tsx` and shares the install/update bar's exact shape, size and style. Use it for rejected writes and other failures with no better home; **do not** use it for form validation, per-attachment upload chips (they carry their own retry), or persistent load/publish error screens. A new message replaces and restarts a 4s timer; an identical repeat is a no-op so a flapping error can't hold it open. See `docs/design-system.md` §6
- **Adding a page with bottom chrome:** set `--error-bar-bottom` next to the existing `--chat-footer-height` write in that page's `updateHeaderFooterOffsets`, then add `var(--error-bar-height, 0px)` to its feed `pb`, scroll safe zone `bottomInset` and scroll-to-bottom `bottom`. Without both, the bar floats at `0px` (or overlaps). See `docs/design-system.md` §6.1
- **Desktop side panels:** `WorkspaceShell` wraps the `/` and `/os` feeds. Both panels are empty and resize with pointer drag, arrow keys (16px), Home/End, or double-click to reset; widths persist in localStorage. They are hidden below `xl` (1280px). The shell publishes `--workspace-shift` (`(sidebar − panel) / 2`); fixed, viewport-centred chrome (pinned bar, `/os` load-error banner) must add `margin-left: var(--workspace-shift, 0px)` or it drifts off the feed. Width math lives in `src/lib/workspace-layout.ts`.
- **Step transitions:** opacity + an 8px drift at `260ms cubic-bezier(0.23,1,0.32,1)` — `transition-[opacity,translate]`, never `transition-all` or `max-h-*`. A revealed field animates its **measured** height on the same curve and stays `inert` while collapsed; every move ships a `motion-reduce` fallback. See `docs/design-system.md` §11
- **Email placeholders:** always `hey@dastyare.social` — never a personal address (`hey@omidshabab.com`). This is display copy, not a dev credential.
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
- `OPENROUTER_API_KEY` — Model provider key for the Mastra agent
- `MASTRA_MODEL` — orchestrator `provider/model` string, defaults to `openrouter/anthropic/claude-sonnet-4.5`
- `MASTRA_SUBAGENT_MODEL` — optional model override for the specialist roster; falls back to `MASTRA_MODEL`
- `MASTRA_GUARDRAIL_MODEL` — optional small model for the guardrail detectors; falls back to `MASTRA_MODEL`
- `MASTRA_COST_BUDGET_USD`, `MASTRA_COST_WINDOW` — per-user spend ceiling and window (default `0.5` / `24h`); malformed values fail open
- `MASTRA_INPUT_TOKEN_LIMIT`, `MASTRA_OUTPUT_TOKEN_LIMIT` — per-turn token ceilings (default `32000` / `4000`)
- `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY` — optional web search providers, detected Tavily-first; without either, `web_search` returns a "not configured" note and `web_fetch` still works
- `RAG_EMBEDDING_API_KEY` (or `OPENAI_API_KEY`), `RAG_EMBEDDING_BASE_URL`, `RAG_EMBEDDING_MODEL`, `RAG_EMBEDDING_DIMENSIONS` — opt-in hybrid retrieval; keyword search needs no configuration
- `TRANSCRIPTION_API_KEY` (or `OPENAI_API_KEY`), `TRANSCRIPTION_BASE_URL`, `TRANSCRIPTION_MODEL`, `TRANSCRIPTION_MAX_BYTES` — optional video/audio transcription; direct media URLs only
- `ZERNIO_MCP_URL` — Zernio hosted MCP endpoint (default `https://mcp.zernio.com/mcp`)
- `ZERNIO_CLIENT_METADATA_URL` **or** `ZERNIO_CLIENT_ID` / `ZERNIO_CLIENT_SECRET` — exactly one Zernio client identity; Mastra never performs dynamic client registration
- `MCP_OAUTH_ENCRYPTION_KEY` — encrypts stored MCP OAuth tokens; falls back to `BETTER_AUTH_SECRET`

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

## Mastra agent scaffold

`src/mastra/` is a working agent runtime with **no UI or HTTP route** yet. The
Zernio orchestrator (`agents/zernio.ts`) is callable from server code and owns
the tool surface; `src/mastra/index.ts` registers it plus the specialist roster.

### Orchestrator tools

| Tool | Purpose |
|------|---------|
| `web_search` | Tavily or Brave, auto-detected; returns a `note` when unconfigured |
| `web_fetch` | Reads a URL; always available, no key |
| `list_channel_posts`, `get_channel_post`, `channel_stats` | Read this channel's posts and totals |
| `search_channel` | Retrieval over published posts (keyword, or hybrid with embeddings) |
| `repurpose_post` | Source post + per-platform limits/rules; the model writes the variants |
| `transcribe_media` | Direct media URL → transcript + timed cues; refuses platform pages |
| `analyze_video` | URL or pasted transcript → hook, pacing, filler, CTA |
| `analyze_script` | Script analysis without transcription (plain, SRT, WebVTT) |
| `check_copy` | Deterministic QA for posts, articles, captions, hashtags, scripts, email, Reddit |
| `plan_posting_schedule` | Cadence → dated slots + cron expression (plans only) |

Zernio MCP tools are attached per user at call time — `createZernioMcpClient({ userId })`
returns a client because credentials are not module-global.

### Specialists (subagents)

Mastra exposes each entry in `agents/subagents/index.ts` as an `agent-<id>` tool.
The roster is: `content-planner`, `researcher`, `engagement-analyst`,
`linkedin-writer`, `instagram-writer`, `tiktok-writer`, `x-writer`,
`reddit-writer`, `social-writer`, `script-writer`, `video-analyst`,
`first-comment-writer`, `hashtag-analyst`, `substack-writer`,
`newsletter-writer`, `editor`, `quality-reviewer`, `repurpose-editor`.

- The `id` is model-facing; the `description` is what the orchestrator routes on.
- Specialists cannot see the parent conversation — pass the source material in
  the delegation prompt.
- Writers get read-only channel tools plus `check_copy`; researchers also get
  `web_search` / `web_fetch`; the video analyst gets transcription and script
  analysis; the editor and quality reviewer can call `repurpose_post` and
  `check_copy` to check format limits.
- They use `MASTRA_SUBAGENT_MODEL`, carry the local content policy and an output
  token ceiling, but **not** the model-backed guardrails (the orchestrator runs
  those once per turn; repeating them per delegation multiplies cost).
- Do not give a specialist its own `agents` map — nesting delegations is not
  supported by the current routing rules.

### Guardrails, memory, retrieval

- Guardrail processors live in `src/mastra/guardrails/` and are ordered there:
  input = content policy → PII → prompt injection → token → cost; output =
  moderation → content policy → token. Detectors use `MASTRA_GUARDRAIL_MODEL`
  and `errorStrategy: "warn"` so a provider outage does not brick the agent.
- Memory (`src/mastra/memory/`) is Postgres-backed via the shared
  `PostgresStore`; pass `zernioMemoryContext(userId, threadId)` — `resource` is
  the user id, and the helper throws on an empty id.
- Retrieval (`src/mastra/rag/`) defaults to Postgres FTS on `posts.content`
  (GIN index, migration `0008`). Hybrid retrieval is opt-in:
  `bun run rag:pgvector` then `bun run rag:index`. The stock `postgres:16` image
  has no pgvector — swap the image first.
- Video (`src/mastra/tools/video.ts`): `parseTranscript` handles SRT/VTT/plain,
  `transcribeMedia` uses an OpenAI-compatible `/audio/transcriptions` endpoint
  on direct media URLs only (platform pages are refused, not scraped), and
  `analyzeScript` is deterministic (hook, WPM, filler, Flesch, CTA). Missing
  keys return a note, like `web_search`.
- QA (`src/mastra/tools/quality.ts`): `check_copy` enforces the same limits as
  `REPURPOSE_TARGETS` / `REUSE_LIMITS`, plus slop, bait, hashtags, links,
  readability, article structure, email subjects and Reddit rules. It scores
  0–100 and never rewrites.
- Schedules: `plan_posting_schedule` plans slots and a cron expression but does
  not publish; Zernio queues posts. Agent cron jobs live in
  `src/mastra/schedules/jobs.ts` and run from the host with
  `bun run agent:cron -- --job <id>` (or `--list`). The Postgres store has no
  schedules domain, so do not rely on `mastra.schedules` for persistence.

Full reference: `docs/mastra-zernio.md`.

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
bun run rag:pgvector         # Opt-in: create the pgvector table
bun run rag:index            # Opt-in: embed existing posts
bun run agent:cron -- --list # List agent cron jobs
bun run agent:cron -- --job <id>  # Run one agent cron job
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
