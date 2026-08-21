# PostHog Dashboard Guide — Dastyare Social CS

> Complete setup guide for PostHog analytics dashboards, funnels, and insights
> tailored to Dastyare Social CS.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Event Taxonomy](#event-taxonomy)
3. [Dashboard 1 — Overview](#dashboard-1--overview)
4. [Dashboard 2 — Content Engagement](#dashboard-2--content-engagement)
5. [Dashboard 3 — User Growth](#dashboard-3--user-growth)
6. [Dashboard 4 — Push Notifications](#dashboard-4--push-notifications)
7. [Dashboard 5 — LLM & AI Visibility](#dashboard-5--llm--ai-visibility)
8. [Dashboard 6 — MCP Usage](#dashboard-6--mcp-usage)
9. [Funnels](#funnels)
10. [Cohorts & Retention](#cohorts--retention)
11. [Session Replay](#session-replay)
12. [Alerts](#alerts)
13. [PostHog MCP Integration](#posthog-mcp-integration)

---

## Environment Variables

```bash
# Client-side (browser)
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN="phc_..."

# Server-side (API routes, mutations)
POSTHOG_API_KEY="phx_..."
```

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
| `mcp_tool_called` | `method`, `authenticated` | MCP tool invoked |

---

## Dashboard 1 — Overview

**Purpose:** High-level health check. Open daily.

### Widgets

1. **Unique Visitors (DAU/WAU/MAU)**
   - Insight: Trend — distinct `$pageview` by `distinct_id`
   - Interval: Daily
   - Compare: Week-over-week

2. **Page Views by Type**
   - Insight: Bar chart — `$pageview` grouped by `page_type`
   - Values: `app`, `docs`, `llms`, `openapi`
   - Shows how much traffic comes from LLM crawlers vs humans

3. **Top Pages**
   - Insight: Top list — `$pageview` grouped by `path`
   - Show: Top 20 paths

4. **Active Users Map**
   - Insight: World map — `$pageview` by `$geoip_country`

5. **Post Creation Rate**
   - Insight: Trend — `post_created` count per day

6. **New vs Returning Users**
   - Insight: Pie chart — `$pageview` where `referrer` is `direct` vs external

---

## Dashboard 2 — Content Engagement

**Purpose:** Understand what content performs best.

### Widgets

1. **Posts by Type**
   - Insight: Pie chart — `post_created` grouped by `post_type`
   - Values: `text`, `image`, `video`, `voice`, `file`

2. **Post Views Over Time**
   - Insight: Trend — `post_viewed` count per day

3. **Reactions per Post**
   - Insight: Trend — `post_reacted` count per day
   - Breakdown by: `emoji`

4. **Most Reacted Posts**
   - Insight: Top list — `post_reacted` grouped by `post_id`, sorted by count

5. **Content Length Distribution**
   - Insight: Histogram — `post_created` by `content_length`
   - Buckets: 0-100, 100-500, 500-1000, 1000-2000, 2000-4096

6. **Media Posts vs Text-Only**
   - Insight: Trend — `post_created` where `has_media = true` vs `false`

7. **Story Engagement**
   - Insight: Trend — `story_viewed` and `story_liked` per day

---

## Dashboard 3 — User Growth

**Purpose:** Track acquisition and retention.

### Widgets

1. **New Users per Day**
   - Insight: Trend — first `$pageview` per `distinct_id` per day
   - Use: Retention insight with "First time seen" criteria

2. **User Activation Funnel**
   - See [Funnels](#funnels) section below

3. **Push Opt-in Rate**
   - Insight: Trend — `push_subscription_enabled` / (`push_subscription_enabled` + `push_subscription_disabled`)
   - Group by: Day

4. **Returning Users**
   - Insight: Retention — users who return after first visit
   - Period: Weekly, 8 weeks

5. **Session Duration Distribution**
   - Use PostHog's built-in session duration insight
   - Filter: `page_type = app`

---

## Dashboard 4 — Push Notifications

**Purpose:** Monitor push notification health.

### Widgets

1. **Push Subscriptions Over Time**
   - Insight: Trend — `push_subscription_enabled` and `push_subscription_disabled`
   - Stacked area chart

2. **Push Delivery Rate**
   - Insight: Trend — `push_notifications_sent` / (`push_notifications_sent` + `push_notifications_failed`)
   - Per day

3. **Push Failures**
   - Insight: List — `push_notifications_failed` events
   - Show: `error` property, count

4. **Subscription Errors**
   - Insight: List — `push_subscription_failed` events
   - Show: `error` or `status`, count

5. **Push Send Volume**
   - Insight: Trend — `push_notifications_sent` by `count`
   - Per day

---

## Dashboard 5 — LLM & AI Visibility

**Purpose:** Track how AI agents and LLMs discover and use the platform.

### Widgets

1. **LLM Asset Requests**
   - Insight: Trend — `llm_asset_requested` per day
   - Breakdown by: `asset` (`llms.txt`, `agents.md`)

2. **LLM Traffic Sources**
   - Insight: Top list — `$pageview` where `page_type = "llms"` or `page_type = "docs"`
   - Group by: `referrer`

3. **LLM vs Human Traffic**
   - Insight: Bar chart — `$pageview` grouped by `page_type`
   - Compare: `app` (human) vs `docs` + `llms` + `openapi` (AI)

4. **OpenAPI Spec Downloads**
   - Insight: Trend — `$pageview` where `path = "/openapi.json"`
   - Per day

5. **Agent Activity Heatmap**
   - Insight: Heatmap — `llm_asset_requested` by hour of day and day of week

6. **LLM Crawler User Agents**
   - Insight: Top list — `$pageview` where `page_type = "llms"` grouped by `referrer`
   - Filter: Known LLM crawlers (GPTBot, ClaudeBot, Google-Extended, etc.)

7. **MCP Discovery**
   - Insight: Trend — `mcp_session_created` per day
   - Breakdown by: `authenticated`

---

## Dashboard 6 — MCP Usage

**Purpose:** Track Model Context Protocol tool usage.

### Widgets

1. **MCP Sessions Created**
   - Insight: Trend — `mcp_session_created` per day
   - Breakdown by: `authenticated`

2. **MCP Tool Calls**
   - Insight: Trend — `mcp_tool_called` per day
   - Breakdown by: `method`

3. **Most Used MCP Tools**
   - Insight: Top list — `mcp_tool_called` grouped by `method`
   - Sorted by: Count descending

4. **MCP Auth vs Anonymous**
   - Insight: Pie chart — `mcp_tool_called` where `authenticated = true` vs `false`

5. **MCP Tool Call Success Rate**
   - Insight: Trend — `mcp_tool_called` count vs error responses
   - (Requires additional error tracking — future enhancement)

---

## Funnels

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

---

*Last updated: August 2026*
