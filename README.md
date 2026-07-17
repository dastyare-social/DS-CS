# Dastyare Social — CS

Personal creator studio and social profile platform built with Next.js. Publish posts (threads, shorts, media), stories, and manage content through a REST API designed for humans and AI agents alike.

## Quick start

**Requirements:** [Bun](https://bun.sh), Node.js 20+, PostgreSQL

```bash
cp .env.example .env
# Fill in DATABASE_URL, BETTER_AUTH_*, ADMIN_*, and S3_* values

bun install
bun run dev          # http://localhost:8729
```

On first build, migrations run automatically and an admin user is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

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
