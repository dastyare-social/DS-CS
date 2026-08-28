# CONTEXT.md — Dastyare Social CS

Compact context for AI agents, LLMs, and maintainers. Read this first for the
quick answer; use `AGENTS.md` for the full agent/API guide and `llms.txt` for
the crawl map.

> WARNING: SEO & LLM discovery is experimental. sitemaps, llms.txt, structured
> data, and MCP endpoints follow current best practices, but discovery by
> search engines or AI assistants cannot be relied on.

## What this is

A self-hosted, open-source **creator studio** (Next.js). The channel owner
publishes posts (text / image / video / voice / file) and ephemeral stories on
their own server and domain. The product thesis: own your content instead of
renting reach on a platform you don't control.

## The one sentence

Post on a platform you don't own and the reach you build isn't yours — DS-CS
keeps that reach working for you on your own infrastructure.

## Quick facts

- **Runtime:** Bun, Node 20+, PostgreSQL, S3-compatible storage
- **Dev port:** 8729
- **Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Tailwind CSS 4, tRPC, Better Auth
- **Public site:** home feed `/`, explore `/explore`, single post `/posts/{id}`, optional `/resume`
- **Creator panel (auth):** `/os`, login `/os/register`
- **Agent surfaces:** `/api/mcp` (MCP tools), `/openapi.json`, `/docs` (Scalar), `/llms.txt`, `/agents.md`, `/context.md`

## Key conventions (drives all decisions)

- **Config is YAML.** Edit `config/app.config.yml`, never hand-edit `app.config.json`.
  `config/resume.config.yml` is parsed fresh on every request; its **first key must
  be `enabled:`** and a `general.name` is required.
- **Import alias:** `@/` → `src/`.
- **Business logic lives in `src/lib/api/`**, not in route handlers.
- **OpenAPI:** annotate route handlers with JSDoc, run `bun run openapi:generate`.
- **PostHog analytics:** client events via `src/lib/analytics/client.ts`, server
  events via `src/lib/analytics/server.ts`. Gracefully no-ops when env is unset.
- **Auth model:** public reads are open; writes + uploads need the shared `API_KEY`
  (`Bearer` header) or a Better Auth session. MCP write tools follow the same rule.

## What NOT to do

- Do not refactor unrelated code.
- Do not expose or fetch `POSTHOG_API_KEY` / `WEBPUSH_PRIVATE_KEY` / secrets.
- External agents: use the REST API (`/api/*`) — avoid the internal tRPC router.
- Do not treat SEO / LLM discovery as a guarantee.

## Fast commands

```bash
bun run dev                 # dev server :8729
bun run build               # prod build (config, icons, migrate, bootstrap)
bun run openapi:generate    # regen OpenAPI from route JSDoc
bun run db:generate         # migration after schema change
bun run db:migrate          # apply migrations
bun run lint                # ESLint
bun run mcp                 # local stdio MCP server
```

## Where to look for everything

| Surface | File / path |
|---|---|
| Full agent + API guide | `AGENTS.md` (also served at `/agents.md`) |
| Readme / marketing | `README.md` (also served at `/readme.md`) |
| Analytics setup | `docs/posthog-dashboard-guide.md` |
| PWA + push history | `docs/pwa-guide.md` |
| MCP client setup | `docs/mcp-guide.md` |
| Crawl / LLM map | `llms.txt` |

*Last updated: August 2026*
