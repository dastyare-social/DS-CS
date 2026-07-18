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

Public read endpoints (GET posts/stories) do not require auth. Write operations (POST, PATCH, DELETE) may require authentication depending on deployment configuration — check `/docs` for `@auth` annotations after regeneration.

Admin bootstrap: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`; `bun run bootstrap:admin` creates or updates the admin user.

## REST API — Posts

Base: `/api/posts`

### List posts

```
GET /api/posts?page=1&limit=20&search=keyword
GET /api/posts?type=count          → { "total": number }
GET /api/posts?type=shorts         → vertical videos only (1080×1920)
```

Response: `{ items: PostWithReactions[], total, hasMore, page, limit }`

Post types: `text`, `image`, `video`, `voice`, `file`

### Create post

```
POST /api/posts
Content-Type: application/json
{ "content": "Hello world" }

POST /api/posts
Content-Type: multipart/form-data
content=<string>, file=<File>
```

Returns `201` with the created post. File uploads infer type from MIME and store in S3.

### Batch increment views

```
POST /api/posts
{ "action": "batch-view", "ids": ["id1", "id2"] }
```

### Single post

```
GET    /api/posts/{post_id}
PATCH  /api/posts/{post_id}     body: partial post fields
DELETE /api/posts/{post_id}
```

### Post actions (POST on single post)

```
POST /api/posts/{post_id}
{ "action": "reaction", "emoji": "👍" }

POST /api/posts/{post_id}
{ "action": "view" }
```

## REST API — Stories

Base: `/api/stories`

Story types: `image`, `video`

### List stories

```
GET /api/stories?page=1&limit=20&search=keyword
GET /api/stories?type=count        → { "total": number }
GET /api/stories?kind=image        → filter by kind
GET /api/stories?kind=video
```

### Create story

```
POST /api/stories
Content-Type: multipart/form-data
type=image|video, file=<File>, views=<string>, likes=<string>, media=<JSON string>

POST /api/stories
Content-Type: application/json
{ "type": "image", "media": { ... } }
```

### Single story

```
GET    /api/stories/{story_id}
PATCH  /api/stories/{story_id}
DELETE /api/stories/{story_id}
```

### Story actions

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
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` — Auth
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — Bootstrap admin
- `S3_*` — Media storage (endpoint, bucket, credentials)
- `NEXT_PUBLIC_APP_URL` — Public URL for SEO/metadata
- `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` — Browser public key for Web Push
- `WEBPUSH_PRIVATE_KEY` — Private VAPID key for server-side sending
- `WEBPUSH_SUBJECT` — Contact URI such as `mailto:hey@omidshabab.com`

## Push notification endpoints

- `POST /api/push` — Store a browser push subscription. Requires `Authorization: Bearer <API_KEY>`.
- `POST /api/push/send` — Send push notifications to all active subscribers. Requires `Authorization: Bearer <API_KEY>`.
- These endpoints are intended for browser push only; they do not send email.

Never commit `.env` or expose secrets in generated docs.

## Common commands

```bash
bun run dev                  # Start dev server
bun run openapi:generate     # Regenerate OpenAPI from route JSDoc
bun run db:generate          # New migration after schema change
bun run db:migrate           # Apply migrations
bun run lint                 # ESLint
```

## MCP integration

The `/docs` Scalar UI exposes MCP for tool-using agents. Point your MCP client at the docs URL to discover available API operations from the OpenAPI spec.
