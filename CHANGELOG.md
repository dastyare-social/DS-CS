# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- v1.0.0 workspace scaffold: Mastra agent runtime with the Zernio hosted MCP
  server (OAuth 2.1 + PKCE, per-user encrypted token storage, six vendored
  Zernio agent skills) and resizable, empty desktop side panels around the `/`
  and `/os` feeds. Panels appear from 1184px — the narrowest viewport where
  both panels fit at their minimum widths without touching the 672px feed —
  and read as quiet columns (a soft surface wash, a hairline divider and a
  visible drag handle). Below that the mobile layout stays single-column.
  Agent UI wiring is intentionally not included. See `docs/mastra-zernio.md`
- Mastra agent capabilities behind the same scaffold: web search (`web_search`
  with Tavily/Brave auto-detect plus the built-in `web_fetch`), channel data
  tools (`list_channel_posts`, `get_channel_post`, `channel_stats`),
  `repurpose_post` with per-platform limits, and `search_channel` over published
  posts. Video and transcript tools (`transcribe_media`, `analyze_video`,
  `analyze_script`) handle direct media URLs, SRT/WebVTT/plain transcripts and
  deterministic hook/pacing/readability analysis. `check_copy` is a
  deterministic QA pass for posts, articles, captions, hashtags, scripts, email
  and Reddit. `plan_posting_schedule` turns a cadence into dated slots and a
  cron expression, and `bun run agent:cron` runs code-defined recurring agent
  jobs from the host scheduler. Eighteen specialists (planner, researcher,
  engagement analyst, LinkedIn, Instagram, TikTok, X, Reddit, general social,
  script, video analyst, first comment, hashtags, Substack, email newsletter,
  editor, quality reviewer, repurpose editor) are exposed to the orchestrator as
  `agent-<id>` tools. Human-in-the-loop: `ask_user` asks instead of guessing,
  `request_approval` gates publish/schedule/delete/message/ad-spend actions and
  fails closed without a host, and Zernio MCP write tools are approval-gated by
  tool annotations and name policy. Guardrails cover prompt injection, PII,
  moderation, channel content policy, and per-user token/cost budgets; memory is
  Postgres-backed; retrieval defaults to full-text search with opt-in pgvector
  hybrid search (`bun run rag:pgvector`, `bun run rag:index`). No chat route or
  UI is mounted, so suspended runs stay suspended until a host resumes them.
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

### Fixed

- Dev server instability, which made every route render the not-found page.
  Turbopack's dev server wedged on this machine in both directions: with its
  on-disk cache enabled it spun the compiler at 400%+ CPU while writing and
  compacting `.next/dev` (~550 MB) and stopped answering requests; with the
  cache disabled it grew the heap without bound, tripped Next's memory guard
  (`⚠ Server is approaching the used memory threshold, restarting...`) and
  died with `FATAL ERROR: Ineffective mark-compacts near heap limit`. Because
  `globalNotFound` is enabled, a wedged server renders the not-found page for
  `/`, `/about`, `/os` and everything else. `bun run dev` now runs webpack
  (`next dev --webpack`): ~25 MB resident, sub-second responses, a
  1,400-request soak with zero failures. `bun run dev:turbo` keeps the old
  behaviour. The failure mode and its diagnostics are documented in
  `AGENTS.md` → "If every route shows the not-found page"
- Not-found pages now render at the Workshop project's size: the description
  line is 24px (`text-2xl`) and the "Get Back To Home Page" button is 24px
  instead of the 14px it was pinned to. In the Workshop project the same line
  inherits `div { font-size: 24px }` from the base layer and the button carries
  `text-[24px]`; this app has no such base rule, so the size is stated at the
  call site
- Dragging one edge of the centre panel no longer resizes both of its edges.
  The feed used to be centred between two equal side columns, so any change to
  its width moved both edges: the drag was symmetric and the column you were
  holding appeared to move away from you. The columns now fill the window and
  a drag moves the boundary it sits on — the boundary follows the pointer
  exactly, the two columns that meet there trade width, and the feed's other
  edge stays put. The feed's width and the left column's width are saved in
  cookies, and the right column takes the rest of the window.
- The workspace feed no longer jumps on load. The saved width was in
  localStorage, so the server could not see it: the page painted at the
  fallback 672px and then resized to the saved width after hydration. The
  width is now a cookie (`ds.workspace.feed-width`) that the server can read,
  and an inline script in the layout publishes it before the first paint.
- A DS — CS — WEB product switcher at the top of the left column. CS is this
  app and is the active segment; DS and WEB link to `NEXT_PUBLIC_DS_URL` and
  `NEXT_PUBLIC_WEB_URL`, and an unset URL renders that segment as a label
  rather than a dead link
- The desktop workspace is three columns now — a sidebar, the feed and an
  assistant panel — and the fixed chrome follows the feed instead of the
  viewport. The top header, the pinned bar and the footers were hard-coded to
  `max-w-2xl`, so as soon as the feed was not exactly 672px wide they
  overflowed it or sat off-centre. The shell now publishes
  `--workspace-feed-width` (the feed's width) and `--workspace-shift` (the
  feed's measured centre against the viewport's), and every fixed element sizes
  itself from those. The row is the full width of the window: the sidebar
  against the left edge, the panel against the right edge, the feed resizable
  in between (480–960) and centred. Each column is resized by dragging the
  **whole edge strip** it owns — the sidebar's right edge, the feed's left and
  right edges, the panel's left edge, since the right panel is against the
  window edge and has nothing to grab there. There is no grip or other
  indicator in the middle of a column. The columns are also actually visible
  now — they were painted with a 4% wash and a 5% border, which composites to
  `#f6f6f6` on the `#fdfdfd` page, three levels of difference, i.e. nothing;
  the surface is now `bg-secondary/[0.07]` with a `border-secondary/20`
  divider. The columns appear from 1024px; below it the feed is full width and
  the mobile layout is untouched

## [0.1.0] - Initial release

- Next.js creator studio with REST API and OpenAPI docs
- Posts, stories, reactions, likes, and views APIs
- Better Auth integration (sessions, API keys, admin bootstrap)
- Self-hosted S3-compatible media uploads
- Web push notifications (optional)
- Docker Compose (app, PostgreSQL, local S3-compatible storage)
- PostHog analytics (client and server)
