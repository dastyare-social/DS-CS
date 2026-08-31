# PostHog Dashboard Guide — Dastyare Social CS

> Complete setup guide for PostHog analytics dashboards, funnels, and insights
> tailored to Dastyare Social CS.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Event Taxonomy](#event-taxonomy)
3. [Overview](#overview)
4. [Content Engagement](#content-engagement)
5. [Push Notifications](#push-notifications)
6. [LLM & AI Visibility](#llm--ai-visibility)
7. [MCP Usage](#mcp-usage)
8. [User Growth & Retention](#user-growth--retention)
9. [Reliability](#reliability)
10. [Funnels](#funnels)
11. [Cohorts & Retention](#cohorts--retention)
12. [Session Replay](#session-replay)
13. [Alerts](#alerts)
14. [PostHog MCP Integration](#posthog-mcp-integration)

---

## Environment Variables

```bash
# Single analytics destination — Dastyare Social ORG PostHog project (581705),
# shared by the browser (posthog-js) and the server (posthog-node).
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN="phc_..."

# Relay server events to the Cloudflare reverse-proxy proxy
# (ingest.dastyare.social). Default true = on/send. Set to "false" to stop.
DISABLE_DEV_TEAM_PH=true
```

### Dev-team relay

Server events are relayed to PostHog via our Cloudflare reverse proxy
(`src/lib/analytics/server.ts` → `devrel.ts`). The relay is enabled by default;
set `DISABLE_DEV_TEAM_PH=false` to stop sending through the proxy while keeping
direct captures.

---

## Event Taxonomy

### Client Events (browser)

| Event | Properties | When |
|---|---|---|
| `$pageview` | `path`, `title`, `locale`, `page_type`, `referrer` | Every route change |
| `post_created` | `post_id`, `post_type`, `has_media`, `content_length` | Post published |
| `post_viewed` | `post_id` | Post opened |
| `post_reacted` | `post_id`, `emoji`, `reaction_count` | Reaction added |
| `post_pinned` | `post_id` | Post pinned |
| `post_unpinned` | `post_id` | Post unpinned |
| `post_batch_viewed` | `post_ids`, `count` | Scroll viewport batch |
| `story_viewed` | `story_id` | Story opened |
| `story_liked` | `story_id` | Story liked |
| `story_created` | `story_id`, `story_type` | Story published |
| `push_subscription_enabled` | `endpoint` | Notifications enabled |
| `push_subscription_disabled` | `endpoint` | Notifications disabled |
| `push_subscription_failed` | `error` or `status` | Subscription error |
| `client_error` | `message`, `stack`, `error_name`, `source`, `url` | Uncaught exception or unhandled rejection |

### Server Events (API)

| Event | Properties | When |
|---|---|---|
| `post_created` | `post_id`, `post_type`, `has_media`, `content_length` | Post inserted |
| `post_updated` | `post_id`, `updated_fields`, `post_type` | Post patched |
| `post_deleted` | `post_id` | Post removed |
| `post_reacted` | `post_id`, `emoji`, `reaction_count` | Reaction saved |
| `post_viewed` | `post_id`, `views` | View count incremented |
| `post_batch_viewed` | `post_ids`, `count` | Batch view increment |
| `posts_list_requested` | `page`, `limit`, `type`, `search` | Posts list fetched |
| `post_requested` | `post_id` | Single post fetched |
| `story_created` | `story_id`, `story_type`, `has_media` | Story inserted |
| `story_updated` | `story_id`, `updated_fields` | Story patched |
| `story_deleted` | `story_id` | Story removed |
| `story_viewed` | `story_id`, `views` | View count incremented |
| `story_liked` | `story_id`, `direction`, `likes` | Like toggled |
| `stories_list_requested` | `page`, `limit`, `type`, `search` | Stories list fetched |
| `story_requested` | `story_id` | Single story fetched |
| `push_subscription_saved` | `endpoint` | SW subscription saved |
| `push_subscription_checked` | `endpoint`, `active` | Subscription checked |
| `push_subscription_disabled` | `endpoint` | Backend unsubscribed |
| `push_notifications_sent` | `count` | Push sent to subscribers |
| `push_notifications_skipped` | `reason` | Push skipped |
| `llm_asset_requested` | `asset`, `path` | LLM/crawler hit endpoint |
| `mcp_session_created` | `authenticated` | MCP session initialized |
| `mcp_tool_called` | `method`, `tool`, `authenticated`, `isError` | MCP tool invoked (tool calls carry `tool` + `isError` for success/failure tracking) |

---

## Overview

**Purpose:** High-level site and product health — visitors, pageviews and content creation. Provisioned by the [PostHog Bootstrap](#posthog-bootstrap) script.

### Widgets

1. **Unique Visitors (DAU)** — Trends, distinct `$pageview`
2. **Weekly Active Users (WAU)** — Trends, weekly-active `$pageview`
3. **Monthly Active Users (MAU)** — Trends, monthly-active `$pageview`
4. **Pageviews** — Trends, total `$pageview`
5. **Top Pages** — Trends, `$pageview` broken down by `pathname` (top 20)
6. **Post Creation Rate** — Trends, total `post_created`
7. **Story Creation Rate** — Trends, total `story_created`

---

## Content Engagement

**Purpose:** What content performs best — posts, stories, reactions and formats.

### Widgets

1. **Posts by Type** — Trends, `post_created` broken down by `post_type` (`text`, `image`, `video`, `voice`, `file`)
2. **Media vs Text-Only Posts** — Trends, `post_created` broken down by `has_media`
3. **Post Views Over Time** — Trends, total `post_viewed`
4. **Reactions Per Post** — Trends, `post_reacted` broken down by `emoji`
5. **Most Reacted Posts** — Trends, `post_reacted` broken down by `post_id` (top 20)
6. **Story Views & Likes** — Trends, `story_viewed` + `story_liked`

---

## Push Notifications

**Purpose:** Push subscription and delivery health.

### Widgets

1. **Push Send Volume** — Trends, total `push_notifications_sent`
2. **Push Sends vs Skipped** — Trends, `push_notifications_sent` vs `push_notifications_skipped`
3. **Push Notification Failures** — Trends, total `push_notifications_failed`
4. **Push Subscriptions Opt-Ins vs Opt-Outs** — Trends, `push_subscription_saved` vs `push_subscription_disabled`
5. **Push Subscription Failures** — Trends, total `push_subscription_failed`

---

## LLM & AI Visibility

**Purpose:** How AI agents and LLM crawlers discover and use the platform.

### Widgets

1. **LLM Asset Requests** — Trends, `llm_asset_requested` broken down by `asset` (`llms.txt`, `agents.md`, `context.md`)
2. **MCP Sessions by Auth** — Trends, `mcp_session_created` broken down by `authenticated`
3. **MCP Auth vs Anonymous** — Trends, `mcp_tool_called` broken down by `authenticated`

---

## MCP Usage

**Purpose:** Model Context Protocol server and tool usage.

### Widgets

1. **MCP Tool Calls Over Time** — Trends, total `mcp_tool_called`
2. **Most Used MCP Tools** — Trends, `mcp_tool_called` broken down by `tool` (top 20)
3. **MCP Tool Errors** — Trends, `mcp_tool_called` broken down by `isError`

---

## User Growth & Retention

**Purpose:** Acquisition and retention.

### Widgets

1. **New Visitors (First Time)** — Trends, `$pageview` first-time-for-user math (reused from Overview)
2. **Weekly Retention** — Retention of `$pageview`, weekly, 8 intervals

---

## Reliability

**Purpose:** Performance and client-side errors.

### Widgets

1. **Web Vitals** — Trends, total `$web_vitals`
2. **Client Errors** — Trends, total `client_error`

---

## Funnels

The funnels above are provisioned by the bootstrap; the reference funnel recipes
(the original `posthog-dashboard-guide` design) are kept for context:

### Funnel 1 — Visitor to Subscriber

**Steps:**
1. `$pageview` (any page)
2. `push_subscription_enabled`

**Time window:** 30 days
**Conversion window:** Same session
**Breakdown:** By `page_type` of first pageview

### Funnel 2 — Visitor to Creator

**Steps:**
1. `$pageview` where `path` starts with `/`
2. `$pageview` where `path = "/os"` (visited panel)
3. `post_created` (created first post)

**Time window:** 30 days
**Conversion window:** 7 days

### Funnel 3 — Post to Engagement

**Steps:**
1. `post_created`
2. `post_viewed` (same post)
3. `post_reacted` (same post)

**Time window:** 7 days
**Conversion window:** Same session
**Breakdown:** By `post_type`

### Funnel 4 — Story to Engagement

**Steps:**
1. `story_created`
2. `story_viewed`
3. `story_liked`

**Time window:** 7 days
**Conversion window:** Same session

### Funnel 5 — LLM Discovery to API Usage

**Steps:**
1. `llm_asset_requested` where `asset = "llms.txt"` or `asset = "agents.md"`
2. `mcp_session_created`
3. `mcp_tool_called`

**Time window:** 30 days
**Conversion window:** 7 days

### Funnel 6 — Push Send to Click-Through

**Steps:**
1. `push_notifications_sent`
2. `$pageview` where `referrer = "web_push"` (requires SW to set referrer)

**Time window:** 7 days
**Conversion window:** 1 hour

---

## Cohorts & Retention

### Cohort 1 — Power Users
- Users who have created 10+ posts in the last 30 days
- Use for: Identifying engaged creators

### Cohort 2 — Passive Consumers
- Users who only view content (never create posts or stories)
- Use for: Targeting with "create your first post" prompts

### Cohort 3 — LLM Discovered
- Users whose first `$pageview` has `page_type = "llms"` or `page_type = "docs"`
- Use for: Tracking AI-driven user acquisition

### Retention Insight
- **User retention:** Weekly cohort, 12 weeks
- **Content creator retention:** Weekly cohort of users who created posts, 12 weeks
- **Push subscriber retention:** Weekly cohort of push-enabled users, 12 weeks

---

## Session Replay

PostHog session replay is **disabled** in the current configuration (`disable_session_recording: true`).

To enable for debugging:
1. Set `disable_session_recording: false` in `src/lib/analytics/client.ts`
2. Add session replay recording rates in PostHog project settings
3. Use only in staging/dev — never in production with real users without consent

---

## Alerts

Set up these alerts in PostHog → Alerts:

1. **Traffic Drop**
   - Metric: `$pageview` count
   - Condition: Drops more than 50% compared to previous day
   - Channel: Email

2. **Push Notification Failure Spike**
   - Metric: `push_notifications_failed` count
   - Condition: More than 5 in 1 hour
   - Channel: Email

3. **MCP Error Spike**
   - Metric: `mcp_tool_called` where `isError = true`
   - Condition: More than 10 in 1 hour
   - Channel: Email

4. **New LLM Crawler**
   - Metric: `llm_asset_requested` grouped by `asset`
   - Condition: New `referrer` value not seen before
   - Channel: Email

5. **Post Creation Anomaly**
   - Metric: `post_created` count
   - Condition: More than 200% of 7-day average
   - Channel: Email

---

## PostHog MCP Integration

PostHog itself exposes an MCP server so AI agents can query analytics data.

### Setup

1. Go to PostHog → Settings → MCP
2. Copy the MCP server URL
3. Add to your AI agent config:

```json
{
  "mcpServers": {
    "posthog": {
      "url": "https://us.i.posthog.com/api/mcp/",
      "headers": {
        "Authorization": "Bearer <POSTHOG_PERSONAL_API_KEY>"
      }
    }
  }
}
```

### Available PostHog MCP Tools

- `query` — Run SQL/HQL queries against your PostHog data
- `get_insight` — Retrieve a saved insight by ID
- `list_insights` — List all saved insights
- `list_dashboards` — List all dashboards
- `get_dashboard` — Get dashboard contents

### Use Cases

1. **Natural language analytics:** "How many posts were created this week?"
2. **Automated reporting:** "Generate a weekly engagement summary"
3. **Anomaly detection:** "Are there any unusual patterns in push notification failures?"
4. **LLM visibility tracking:** "Which LLM crawlers visited our site today?"

### Example Queries

```sql
-- Posts created per day (last 30 days)
SELECT toDate(timestamp) as day, count()
FROM events
WHERE event = 'post_created'
AND timestamp >= now() - interval 30 day
GROUP BY day
ORDER BY day

-- LLM traffic breakdown
SELECT properties.asset, count()
FROM events
WHERE event = 'llm_asset_requested'
AND timestamp >= now() - interval 7 day
GROUP BY properties.asset

-- Push notification delivery rate
SELECT
  countIf(event = 'push_notifications_sent') as sent,
  countIf(event = 'push_notifications_failed') as failed,
  round(sent / (sent + failed) * 100, 2) as delivery_rate
FROM events
WHERE event IN ('push_notifications_sent', 'push_notifications_failed')
AND timestamp >= now() - interval 7 day

-- MCP tool usage
SELECT properties.method, count()
FROM events
WHERE event = 'mcp_tool_called'
AND timestamp >= now() - interval 7 day
GROUP BY properties.method
ORDER BY count() DESC

-- User retention (weekly)
SELECT
  formatDateTime(timestamp, '%Y-W%V') as week,
  count(DISTINCT distinct_id) as active_users
FROM events
WHERE event = '$pageview'
AND timestamp >= now() - interval 12 week
GROUP BY week
ORDER BY week
```

---

## Implementation Notes

### Auto-flush in Serverless

Server events are flushed after each mutation to prevent data loss in serverless environments. The `flushServerEvents()` function is called in:

- `src/lib/api/posts/mutations.ts` — after every `captureServerEvent`
- `src/lib/api/stories/mutations.ts` — after every `captureServerEvent`
- `src/app/api/mcp/route.ts` — after every MCP request

### Analytics Graceful Degradation

When PostHog env vars are not set, all analytics silently no-op:
- `captureServerEvent()` returns immediately
- `captureClientEvent()` returns immediately
- No errors, no performance impact

### Privacy

- `autocapture: false` — no automatic DOM event capture
- `capture_pageview: false` — manual `$pageview` with minimal properties
- `disable_session_recording: true` — no session replay
- No personally identifiable information in event properties (only `user.id`)
- Server events default to `distinctId: "anonymous"`
- `client_error` captures only error message/stack + current URL, never PII

### Client Error Tracking

`setupClientErrorTracking()` (called from the `Analytics` client component) installs
`window.onerror` and `unhandledrejection` listeners that report to PostHog as
`client_error` events. It is idempotent and no-ops gracefully when PostHog env is
unset. See `src/lib/analytics/client.ts`.

---

## PostHog Bootstrap

`scripts/posthog-bootstrap.ts` provisions **this product's dashboard suite** via
the public REST API. It only references events the social app actually captures
(`post_*`, `story_*`, `push_*`, `mcp_*`, `llm_asset_requested`, `$pageview`,
`$web_vitals`, `client_error`) — no insight is created for features this app
does not have. This is the single source of truth for "the dashboards this
product ships with": 7 dashboards (see [Overview](#overview) through
[Reliability](#reliability) above) plus their insights. Global metrics shared
with other products (DAU, weekly retention, web vitals) keep the same insight
names, but push/MCP/LLM dashboards exist only here.

The suite is provisioned on the internal product project (581705). When several
products share a PostHog account, run the bootstrap per product so every
dashboard and insight is suffixed ` — {product}` (e.g. `Push Notifications —
CS`).

Run it with:

```bash
bun run bootstrap:posthog
```

It reads the target project from the environment:

| Env var | Required | Purpose |
|---|---|---|
| `PH_PROJECT_ID` | no | Numeric id of the PostHog project — auto-discovered from the key's `@current` project when unset |
| `PH_PERSONAL_API_KEY` | yes | `phx_` personal API key with **admin** scope |
| `PH_HOST` | no | Defaults to `https://us.i.posthog.com` |
| `PH_PROJECT_TOKEN` | no | `phc_` project token — informational only |

These are usually defined in the repo's `.env` (loaded automatically by the
script via `dotenv/config`), so a plain `bun run bootstrap:posthog` uses them.
To provision a *different* project (e.g. a developer's own account) you can
override them on the command line instead:

```bash
PH_PERSONAL_API_KEY=phx_... bun run bootstrap:posthog   # project id auto-detected
```

The script:

1. Validates the env vars and reports any missing/undefined config.
2. Preflights the personal API key — verifies it resolves to a user and can
   access the target project. Fails without making changes if access is
   insufficient.
3. Provisions idempotently: each dashboard plus its insights. Existing
   dashboards/insights are found by name and reused (and attached to the right
   dashboards), never duplicated. Re-running is safe.
4. Retries transient 429/5xx responses with backoff instead of aborting.
5. Prints a summary of what was created or already present.

Example for the internal product project:

```bash
PH_PROJECT_ID=581705 \
PH_PERSONAL_API_KEY=phx_... \
PH_HOST=https://us.i.posthog.com \
bun run bootstrap:posthog
```

---

*Last updated: August 2026*
