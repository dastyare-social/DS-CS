# Mastra + Zernio (scaffold)

The v1.0.0 scaffold adds a [Mastra](https://mastra.ai) agent runtime and connects
it to [Zernio](https://zernio.com)'s hosted MCP server. It ships **without UI**:
no chat surface is mounted, and no agent HTTP route is registered yet. The agent
itself is complete enough to be called from server code: it has tools, a
specialist roster, guardrails, memory and retrieval.

## What is in the tree

| Path | Purpose |
|---|---|
| `src/mastra/index.ts` | `Mastra` instance — registers the orchestrator, the specialists and Postgres storage |
| `src/mastra/agents/zernio.ts` | Orchestrator: model, tools, delegation rules, skills, memory |
| `src/mastra/agents/specialist.ts` | Shared factory for the specialist agents |
| `src/mastra/agents/subagents/` | The specialist roster (planner, researcher, writers, editor, …) |
| `src/mastra/tools/web-search.ts` | `web_search` (Tavily/Brave) and the built-in `web_fetch` |
| `src/mastra/tools/channel-data.ts` | `list_channel_posts`, `get_channel_post`, `channel_stats` |
| `src/mastra/tools/repurpose.ts` | `repurpose_post` — source + format playbook |
| `src/mastra/tools/knowledge.ts` | `search_channel` — retrieval over the channel's own posts |
| `src/mastra/tools/video.ts` | `transcribe_media`, `analyze_video`, `analyze_script` |
| `src/mastra/tools/quality.ts` | `check_copy` — deterministic QA for any draft |
| `src/mastra/tools/schedules.ts` | `plan_posting_schedule` — dated slots + cron |
| `src/mastra/text/metrics.ts` | Shared word/sentence/readability measurements |
| `src/mastra/repurpose/specs.ts` | Format limits and rules for each target platform |
| `src/mastra/schedules/plan.ts` | Cadence → calendar slots and cron expression |
| `src/mastra/schedules/jobs.ts` | Agent cron job definitions (prompts + schedules) |
| `src/mastra/guardrails/` | Prompt injection, PII, moderation, token/cost, channel content policy |
| `src/mastra/memory/` | Postgres-backed thread memory and working-memory template |
| `src/mastra/rag/` | Chunking, embeddings, keyword and hybrid retrieval |
| `src/mastra/mcp/zernio.ts` | Per-user `MCPClient` factory for `https://mcp.zernio.com/mcp` |
| `src/mastra/oauth/zernio-provider.ts` | `MCPOAuthClientProvider` configuration and redirect URL |
| `src/mastra/skills.ts` | The six vendored Zernio skills, as filesystem paths |
| `src/lib/agents/oauth-storage.ts` | `OAuthStorage` backed by Postgres, encrypted at rest |
| `src/lib/db/schema/mcp-oauth.ts` | `mcp_oauth_storage` table |
| `src/app/api/agents/zernio/authorize/route.ts` | Starts OAuth for the signed-in user |
| `src/app/api/agents/zernio/callback/route.ts` | Hosted OAuth callback (code + PKCE exchange) |
| `scripts/enable-pgvector.ts` | Opt-in pgvector table (`bun run rag:pgvector`) |
| `scripts/index-channel-knowledge.ts` | Embed existing posts (`bun run rag:index`) |
| `scripts/agent-cron.ts` | Run one agent cron job (`bun run agent:cron`) |
| `skills/zernio/*/SKILL.md` | The same skills, installed in the DS-CS registry |

## Environment

```bash
OPENROUTER_API_KEY=...
MASTRA_MODEL="openrouter/anthropic/claude-sonnet-4.5"
MASTRA_SUBAGENT_MODEL="openrouter/anthropic/claude-sonnet-4.5"   # optional
MASTRA_GUARDRAIL_MODEL="openrouter/openai/gpt-4o-mini"           # optional

# Budget and ceilings (guardrails fail open only on malformed values)
MASTRA_COST_BUDGET_USD=0.5
MASTRA_COST_WINDOW="24h"
MASTRA_INPUT_TOKEN_LIMIT=32000
MASTRA_OUTPUT_TOKEN_LIMIT=4000

# Web search: either provider, or neither (web_fetch still works)
TAVILY_API_KEY=...
BRAVE_SEARCH_API_KEY=...

# Transcription: OpenAI-compatible /audio/transcriptions (falls back to OPENAI_API_KEY)
TRANSCRIPTION_API_KEY=...
TRANSCRIPTION_BASE_URL="https://api.openai.com/v1"
TRANSCRIPTION_MODEL="whisper-1"
TRANSCRIPTION_MAX_BYTES=26214400

# Semantic retrieval is opt-in; without a key, keyword search is used
RAG_EMBEDDING_API_KEY=...          # or OPENAI_API_KEY
RAG_EMBEDDING_BASE_URL="https://api.openai.com/v1"
RAG_EMBEDDING_MODEL="text-embedding-3-small"
RAG_EMBEDDING_DIMENSIONS=1536

ZERNIO_MCP_URL="https://mcp.zernio.com/mcp"

# Choose ONE client identity (Mastra never uses dynamic client registration):
ZERNIO_CLIENT_METADATA_URL="https://your-domain.com/api/agents/zernio/client-metadata"
# or
ZERNIO_CLIENT_ID=...
ZERNIO_CLIENT_SECRET=...

MCP_OAUTH_ENCRYPTION_KEY=...   # optional; falls back to BETTER_AUTH_SECRET
```

The OAuth redirect URI to register with Zernio is:

```
{NEXT_PUBLIC_APP_URL}/api/agents/zernio/callback
```

### Why a pre-registered client or CIMD?

`MCPOAuthClientProvider` deliberately does not perform dynamic client
registration. Zernio advertises a registration endpoint, but Mastra will not call
it. Configure either:

- **CIMD** (`ZERNIO_CLIENT_METADATA_URL`) — an HTTPS, non-root-path document
  containing the same `client_id` (the URL), `client_name` and `redirect_uris`.
  Zernio fetches it during authorization.
- **Pre-registered client** (`ZERNIO_CLIENT_ID` / `ZERNIO_CLIENT_SECRET`) — the
  redirect URI above must be registered exactly.

## OAuth flow

1. A signed-in user hits `GET /api/agents/zernio/authorize`.
2. The route pins a `state` (`beginAuthorizationSession`), stores it in an
   httpOnly cookie scoped to `/api/agents/zernio`, and triggers discovery with
   `client.listTools()`.
3. Zernio rejects the connection with `401`, the provider emits the
   authorization URL, and the route redirects the browser to it. The SDK has
   already persisted the PKCE verifier and discovery state through
   `PostgresOAuthStorage`.
4. Zernio redirects back to `GET /api/agents/zernio/callback`. The route checks
   the state cookie, confirms the Better Auth session matches, then calls the
   MCP SDK's `auth()` with the code. The provider exchanges it using the stored
   verifier and binds the resulting tokens to Zernio's issuer.
5. Tokens land in `mcp_oauth_storage`, namespaced by user and server.

Mastra's interactive `authenticate()` helper is not used: it only handles
loopback (`http://127.0.0.1`) callbacks, while this app has an HTTPS callback.

## Storage and encryption

`mcp_oauth_storage` is a key/value table unique on
`(user_id, server, key)`. Values are AES-256-GCM encrypted in
`src/lib/agents/oauth-storage.ts` before insert. Rotating the encryption key
invalidates existing connections; affected users re-authorize.

## Skills

The six Zernio skills are vendored verbatim (plus Agent Skills frontmatter) from
`https://zernio.com/.well-known/agent-skills/`:

`schedule-post`, `connect-account`, `list-analytics`, `send-message`, `run-ads`,
`manage-blog-articles`.

They live under `skills/zernio/` so `ds-cs add` sees them, and
`src/mastra/skills.ts` points the agent at the same directories. Do not copy
them a second time.

## Tools

| Tool | What it does | Notes |
|---|---|---|
| `web_search` | Tavily or Brave, auto-detected from env | Mastra's built-in `webSearchTool` is provider-defined and throws for OpenRouter, so search is explicit here |
| `web_fetch` | Reads a URL, no API key | Mastra built-in; keeps working when no search key is set |
| `list_channel_posts` | Paginated posts with views and reactions | Reads the same queries the feed uses |
| `get_channel_post` | One post, with media URLs | Used before repurposing |
| `channel_stats` | Post/story counts and accumulated views | `views` is text in the schema, so the aggregate guards the cast |
| `repurpose_post` | Source post + per-platform playbook | Returns limits and rules; the model writes the variants |
| `search_channel` | Retrieval over published posts | Keyword by default, hybrid when embeddings are configured |
| `transcribe_media` | Direct media URL → transcript + timed cues | OpenAI-compatible endpoint; platform pages are refused, not scraped |
| `analyze_video` | URL or pasted transcript → hook, pacing, filler, CTA | Transcribes first when given a URL |
| `analyze_script` | Script analysis without transcription | Plain text, SRT or WebVTT |
| `check_copy` | Deterministic QA for a draft | Limits, hook, slop, hashtags, links, readability, platform rules |
| `plan_posting_schedule` | Cadence → dated slots + cron | Plans only; publishing stays with Zernio |

Without a search key `web_search` returns a `note` rather than throwing: a clear
"not configured" is easier for a model to handle than a tool error it will try to
work around. The transcription tools follow the same rule.

## Specialists (subagents)

The orchestrator (`zernio`) delegates through Mastra's agent tools. Each key in
`specialistAgents` becomes an `agent-<id>` tool, so the id is part of the
model-facing surface.

| Agent | Use it for |
|---|---|
| `content-planner` | Calendars and campaigns: slots, platforms, sequencing |
| `researcher` | Cited briefs from the web and the channel |
| `engagement-analyst` | What performed, from this channel's own numbers |
| `linkedin-writer` | LinkedIn posts |
| `instagram-writer` | IG captions and carousels |
| `tiktok-writer` | TikTok hook, beats, caption, sound, tags |
| `x-writer` | X posts and threads |
| `reddit-writer` | Reddit titles and value-first posts that respect subreddit rules |
| `social-writer` | Facebook, Threads, Bluesky, Pinterest, YouTube community, Mastodon |
| `script-writer` | Spoken video scripts with timestamps and visuals |
| `video-analyst` | Transcript/script critique: hook, pacing, filler, CTA |
| `first-comment-writer` | Pinned comment, source list, link drop |
| `hashtag-analyst` | Hashtag and keyword sets per platform |
| `substack-writer` | Long-form Substack articles |
| `newsletter-writer` | Email newsletter issues |
| `editor` | Final pass: truth, fit, voice, safety |
| `quality-reviewer` | Checklist verdict and score for any draft |
| `repurpose-editor` | One source post into the full multi-format set |

Routing rules live in the orchestrator's instructions: delegate drafting, route
facts through the researcher, run `check_copy` (or the quality reviewer) before
the editor, and pass the source material in the prompt (a specialist cannot see
the parent conversation).

Specialists use `MASTRA_SUBAGENT_MODEL`, get only the tools their role needs
(writers read the channel and can QA their own draft; researchers also browse;
the video analyst gets transcription and script analysis), and carry the local
content policy plus an output token ceiling. The model-backed guardrails run on
the orchestrator only — repeating a detection call inside every delegation would
multiply latency and cost for the same protection.

## Video and transcripts

`src/mastra/tools/video.ts` has three layers:

1. `parseTranscript` accepts SRT, WebVTT or plain text. Timed cues give it a
   real runtime and a first-cue timestamp; a plain transcript still works.
2. `transcribeMedia` downloads a **direct** audio/video URL (25 MB ceiling by
   default) and posts it to an OpenAI-compatible `/audio/transcriptions`
   endpoint. Platform pages (YouTube, TikTok, Instagram…) are refused with a
   note rather than scraped: it is brittle and a terms-of-service problem.
3. `analyzeScript` is deterministic: hook, words per minute, filler phrases,
   long sentences, Flesch reading ease, CTA and number/specificity checks. The
   model interprets the numbers; it never counts words itself.

`analyze_video` combines 1–3, so an agent can take a URL or a pasted transcript
and get one report. The `video-analyst` specialist turns that report into a
verdict, ranked fixes and (only when the hook is weak) one rewritten hook.

## Quality assurance

`check_copy` (`src/mastra/tools/quality.ts`) is the shared checklist for posts,
threads, captions, articles, emails, scripts, hashtag sets and Reddit posts:

- hard character limits, per platform, from `REPURPOSE_TARGETS` and
  `REUSE_LIMITS` — one place to change a number;
- first-line length and stock openings ("excited to announce…");
- AI-slop and engagement-bait phrases, filler, all-caps ratio;
- hashtag count, duplicates, generic tags and platform etiquette;
- links (Instagram captions are not clickable), repeated sentences;
- article subheads and paragraph length, email subject length, Reddit title and
  self-promotion disclosure;
- script pacing via the same analyser as `analyze_video`.

It returns a 0–100 score, a `ship` / `revise` / `rewrite` verdict and issues
sorted by severity. The score is advisory; the blockers are the errors.

## Schedules and cron jobs

Two separate things share the word "schedule":

- **Publishing.** The Zernio `schedule-post` skill queues posts. The
  `plan_posting_schedule` tool only plans: it turns a cadence (days per week,
  publish time, timezone, platform rotation) into dated slots with a
  flagship → repurpose → community rotation, plus a cron expression.
- **Agent jobs.** `src/mastra/schedules/jobs.ts` defines recurring prompts
  (weekly content plan, daily analytics digest, weekly repurpose, monthly
  newsletter). The app has no long-lived worker and the current Postgres store
  has no schedules domain, so they are run by the host:

  ```bash
  bun run agent:cron -- --list
  bun run agent:cron -- --job daily-analytics-digest
  ```

  Point crontab or a Kubernetes CronJob at the second command. The job prompts
  are code, so they are reviewed and tested like any other prompt.

## Guardrails

Order matters, and is enforced in `src/mastra/guardrails/index.ts`:

Input — content policy (local), PII redaction, prompt-injection detection,
token ceiling, per-user cost ceiling.

Output — moderation, content policy, output token ceiling.

- `PIIDetector` redacts to `[EMAIL]`-style placeholders before the model sees
  the text.
- `PromptInjectionDetector` blocks at a 0.75 threshold.
- `TokenCostControl` aggregates per `resourceId` (the signed-in user) over
  `MASTRA_COST_WINDOW`, warns at 80% and blocks at the budget.
- The content policy is the repo's own `filterString` (NSFW map + HTML
  sanitization), so a draft the agent proposes is filtered exactly like a post
  the composer submits.

Detectors use `MASTRA_GUARDRAIL_MODEL` and `errorStrategy: "warn"`: a provider
outage is logged, not silently turned into an unusable agent.

## Memory

`zernioMemory()` builds a `Memory` on the shared `PostgresStore` with
`lastMessages: 20`, working memory enabled (channel identity, voice, publishing
defaults, standing instructions) and semantic recall off.

Always pass the context from the helper:

```ts
import { zernioMemoryContext } from "@/mastra/memory";

await agent.generate(prompt, {
  memory: zernioMemoryContext(session.user.id, threadId),
});
```

`resource` is the user id, which is what keeps one user's threads out of
another's listing. The helper throws on an empty id rather than writing to the
anonymous bucket.

## Retrieval (RAG)

Two paths, in `src/mastra/rag/`:

1. **Keyword (default).** Postgres full-text search over `posts.content`, backed
   by the `posts_content_fts_idx` GIN index (migration `0008`). No extension and
   no provider key. If `websearch_to_tsquery` matches nothing, a substring scan
   runs before returning empty.
2. **Hybrid (opt-in).** When `RAG_EMBEDDING_API_KEY` (or `OPENAI_API_KEY`) is
   set *and* the pgvector table exists, `search_channel` embeds the query and
   merges semantic hits with keyword hits.

Enabling it:

```bash
# requires a Postgres image with the vector extension, e.g. pgvector/pgvector
bun run rag:pgvector   # create extension, table, HNSW index
bun run rag:index      # chunk and embed existing posts
```

`rag:pgvector` refuses to change the dimension of an existing table; drop and
re-index when you change embedding models. The stock `postgres:16` image in
`docker-compose.yml` does **not** ship pgvector — swap the image before enabling
the hybrid path.

Embeddings use any OpenAI-compatible endpoint. OpenRouter (the model provider)
does not serve embeddings, hence the separate `RAG_EMBEDDING_*` settings.

## Attaching Zernio MCP tools

The Zernio MCP tools cannot be attached at module scope because credentials are
per user:

```ts
import { createZernioMcpClient } from "@/mastra/mcp/zernio";

const { client } = createZernioMcpClient({ userId });
const tools = await client.listTools(); // namespaced zernio_*
// pass to an agent run, then:
await client.disconnect();
```

`forwardInstructions` is intentionally `false` until Zernio's server
instructions have been reviewed — they are injected into the system prompt.

## Deployment notes

- `skills/` must be present in the runtime image at `process.cwd()/skills`;
  Mastra's `LocalSkillSource` reads from disk.
- `src/mastra/index.ts` only constructs `PostgresStore` when `DATABASE_URL` is
  set, so importing the module in a credential-less environment does not throw.
- Guardrails add one cheap model call per detection type on the orchestrator
  turn. Budget accordingly, and set `MASTRA_GUARDRAIL_MODEL` to something small.
- `TokenCostControl` reads cost from Mastra observability, so it needs the
  Postgres store to be initialized; without `DATABASE_URL` the cost guard is
  inert.
- The scaffold does not add the `mastra` CLI. Add it when local Studio work
  starts.
- Transcription is optional and only touches direct media URLs. The default
  25 MB ceiling matches the common Whisper limit; raise
  `TRANSCRIPTION_MAX_BYTES` only if the provider does too.
- Agent cron jobs inherit the host's timezone. Set the same timezone as
  `plan_posting_schedule` and the channel, or a 09:00 slot fires at the wrong
  hour.
- `bun run agent:cron` exits non-zero on an unknown job or a failed run, so it
  works as a cron/Kubernetes job without extra wrapper logic.
