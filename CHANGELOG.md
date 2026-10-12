# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MIT license, security policy, code of conduct, issue/PR templates
- Open-source readiness cleanup (neutralized default profile config, fixed
  placeholder URLs, fixed CI S3 env var name)
- `CONTEXT.md` served at `/context.md` — compact agent context surfaced in `llms.txt`
- MCP tool call error tracking — `mcp_tool_called` now carries `tool` + `isError`
- Client error tracking — `window.onerror` / `unhandledrejection` → `client_error` event
- First-party agent skills in `skills/` (dev: `add-orpc-endpoint`, `add-component`,
  `db-migration`, `release`; product: `post-with-media`, `manage-stories`,
  `webhooks`, `brand-config`, `self-host-deploy`, `mcp-connect`) — instructions
  that tell an agent how to work on this codebase and operate a channel
- `ds-cs` CLI (`scripts/cli`, publishable as `npx ds-cs`) — installs skills from
  DS-CS or any other skills repo, wires up MCP config for OpenCode / Claude Code /
  Cursor / Codex / Windsurf, and stores channel credentials with a login check.
  Shares the `skills-lock.json` format with `npx skills`, so both can install
  into one project without clobbering each other
- Outbound webhooks — register endpoints and receive signed real-time events
  (`post.created|updated|deleted|reacted|viewed`,
  `story.created|updated|deleted|viewed|liked`), with HMAC signature
  verification, automatic retries with backoff, and per-webhook delivery status
  (`lastStatus`, `lastAttemptAt`, `failureCount`)

## [0.1.0] - Initial release

- Next.js creator studio with REST API and OpenAPI docs
- Posts, stories, reactions, likes, and views APIs
- Better Auth integration (sessions, API keys, admin bootstrap)
- Self-hosted S3-compatible media uploads
- Web push notifications (optional)
- Docker Compose (app, PostgreSQL, local S3-compatible storage)
- PostHog analytics (client and server)
