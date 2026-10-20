# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Global transient error bar (`src/components/error-bar.tsx`, raised through
  `raiseError()` in `src/lib/error-bar.ts`) — mounted once in
  `src/app/(routes)/layout.tsx` and available on every route. Identical
  `liquid-glass` material, size and style to the PWA install bar; parks above
  the install bar on `/`, above the update bar on `/os`, and above the
  scroll-to-bottom button on both. Auto-dismisses after 4s, a new message
  replaces and restarts the timer, an identical repeat is a no-op so a flapping
  error cannot hold it open, and `X` dismisses early. Replaces the 5s red
  write-error toast and the 4s rejected-files notice on `/os`. Wired on `/`,
  `/os`, `/explore` and `/posts/[post_id]` via the `--error-bar-bottom` /
  `--error-bar-height` chain — see `docs/design-system.md` §6
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
- `ds-cs` CLI (`scripts/cli`, published as `@dastyaresocial/ds-cs`) — installs skills from
  DS-CS or any other skills repo, wires up MCP config for OpenCode / Claude Code /
  Cursor / Codex / Windsurf, and stores channel credentials with a login check.
  Shares the `skills-lock.json` format with `npx skills`, so both can install
  into one project without clobbering each other
- Interactive setup flow for `ds-cs init` and `ds-cs add` — asks whether to
  install into this project or the user directory, which agents should read the
  skills (searchable multi-select, preselected from what was last chosen or what
  is detected), and whether files are symlinked or copied. `ds-cs add` also gets
  a searchable skill picker that matches names, paths and descriptions and takes
  several skills at once. Choices persist per user in
  `~/.config/ds-cs/preferences.json`. Non-interactive runs are unchanged.
- Outbound webhooks — register endpoints and receive signed real-time events
  (`post.created|updated|deleted|reacted|viewed`,
  `story.created|updated|deleted|viewed|liked`), with HMAC signature
  verification, automatic retries with backoff, and per-endpoint delivery status
  (`lastStatus`, `lastAttemptAt`, `failureCount`)
- Scroll safe zone on every scrolling list (`/`, `/os`, `/posts/[id]`,
  `/explore`) — a gradient that blurs and washes out content where it passes
  under fixed chrome, so items dissolve into the header and footer instead of
  being sliced off by a hard line. Instagram-style, but per edge: a band only
  appears while its own edge has more list behind it, so the start and end of a
  list are never covered by a fade that has nothing to fade. Masked crossfade
  yields a *ramping* blur radius (`√alpha`), so the blur is a second layer with
  its own curve rather than being flattened by the wash's; `--scroll-fade-blur`
  caps it at 2px. Documented in `docs/design-system.md` §5.

## [0.1.0] - Initial release

- Next.js creator studio with REST API and OpenAPI docs
- Posts, stories, reactions, likes, and views APIs
- Better Auth integration (sessions, API keys, admin bootstrap)
- Self-hosted S3-compatible media uploads
- Web push notifications (optional)
- Docker Compose (app, PostgreSQL, local S3-compatible storage)
- PostHog analytics (client and server)
