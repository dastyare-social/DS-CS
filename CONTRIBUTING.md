# Contributing

Guide for humans and AI agents working on Dastyare Social CS.

## Setup

1. Clone the repo and install dependencies: `bun install`
2. Copy `.env.example` to `.env` and fill in all values
3. Start PostgreSQL and set `DATABASE_URL`
4. Run `bun run dev` — config generation, migrations, and admin bootstrap run automatically on build; for dev, run `bun run db:migrate` and `bun run bootstrap:admin` manually if needed

## Development workflow

1. Edit `config/app.config.yml` for profile changes → `bun run generate:config`
2. Edit Drizzle schemas in `src/lib/db/schema/` → `bun run db:generate` → review migration → `bun run db:migrate`
3. Add or change API behavior in `src/lib/api/` first, then wire in `src/app/api/*/route.ts`
4. Add JSDoc `@openapi` annotations to route handlers when changing API surface
5. Regenerate OpenAPI: `bun run openapi:generate`
6. Lint: `bun run lint`

## API documentation workflow

This project uses [next-openapi-gen](https://github.com/tazo90/next-openapi-gen). Route handlers are the source of truth.

Example annotation:

```typescript
/**
 * List posts
 * @description Returns paginated posts with reactions. Use type=count for total, type=shorts for vertical videos.
 * @tag Posts
 * @openapi
 */
export async function GET(req: NextRequest) { ... }
```

After editing annotations or route signatures:

```bash
bun run openapi:generate
```

Commit both the route changes and the regenerated `public/openapi.json`.

## Code conventions

- **Minimal diffs:** Change only what the task requires
- **Business logic:** Lives in `src/lib/api/`, not route files
- **Validation:** Use Zod schemas from `src/lib/db/schema/` (drizzle-zod)
- **Imports:** Use `@/` path alias
- **Components:** Functional React, Tailwind CSS 4, match existing component style
- **No secrets:** Never commit `.env`, credentials, or API keys

## File ownership

| Area | Location |
|------|----------|
| REST routes | `src/app/api/` |
| API logic | `src/lib/api/` |
| Database | `src/lib/db/schema/`, `src/lib/db/migrations/` |
| Auth | `src/lib/auth/` |
| Frontend pages | `src/app/(routes)/` |
| UI components | `src/components/` |
| App config | `config/app.config.yml` |
| Translations | `translations/` |
| OpenAPI output | `public/openapi.json` (generated) |
| Agent docs | `AGENTS.md`, `llms.txt` |

## Pull request checklist

- [ ] `bun run lint` passes
- [ ] API changes include JSDoc annotations and regenerated OpenAPI
- [ ] Schema changes include a Drizzle migration
- [ ] No secrets or `.env` files in the diff
- [ ] Config YAML updated (not JSON) if profile metadata changed

## AI agent notes

- Read [AGENTS.md](./AGENTS.md) before making changes
- Read [README.md](./README.md) for architecture overview
- Prefer REST API docs at `/docs` and `/openapi.json` for integration work
- Do not refactor unrelated code or introduce new abstractions without request
