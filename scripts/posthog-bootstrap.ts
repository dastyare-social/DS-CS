/**
 * PostHog analytics bootstrap.
 *
 * Provisions a standard set of dashboards and insights on a PostHog project
 * via the public REST API. The same suite is meant for every PostHog account
 * (a self-hosted instance, a customer's cloud project, or our own internal
 * instances) — nothing here is audience-specific, so this script is the single
 * source of truth for "the dashboards this product ships with".
 *
 * Target project is read from the environment:
 *
 *   - PH_PROJECT_ID            (optional) numeric id of the target project.
 *                              Discovered from the personal API key's @current
 *                              project when unset.
 *   - PH_PERSONAL_API_KEY      (required) phx_ key with admin scope
 *   - PH_HOST                  (optional) defaults to https://us.i.posthog.com
 *   - PH_PROJECT_TOKEN         (optional) phc_ project token — used only to
 *                              sanity-check/report; NOT required to provision.
 *
 * The script validates the env vars and the personal API key (user identity +
 * project access), then provisions idempotently. Re-running is safe: existing
 * dashboards/insights are found by name and reused, not duplicated.
 *
 * Usage:  bun run bootstrap:posthog
 */

import "dotenv/config";

const DEFAULT_HOST = "https://us.i.posthog.com";

// ---------------------------------------------------------------------------
// Config / env validation
// ---------------------------------------------------------------------------

interface Env {
  projectId: string;
  personalApiKey: string;
  host: string;
  projectToken: string | undefined;
}

function loadEnv(): Env {
  const projectId = (process.env.PH_PROJECT_ID ?? "").trim();
  const personalApiKey = (process.env.PH_PERSONAL_API_KEY ?? "").trim();
  const host = (process.env.PH_HOST ?? "").trim() || DEFAULT_HOST;
  const projectToken = (process.env.PH_PROJECT_TOKEN ?? "").trim() || undefined;

  return { projectId, personalApiKey, host, projectToken };
}

const MISSING_LABELS: Array<[keyof Env, string, string]> = [
  ["personalApiKey", "PH_PERSONAL_API_KEY", "phx_ personal API key with admin scope"],
];

function validateEnv(env: Env): boolean {
  let ok = true;

  if (env.projectId && !/^\d+$/.test(env.projectId)) {
    console.error("✗ PH_PROJECT_ID must be a numeric project id (got: " + env.projectId + ").");
    ok = false;
  }

  if (!env.personalApiKey) {
    console.error("✗ PH_PERSONAL_API_KEY is missing — a phx_ personal API key with admin scope.");
    ok = false;
  } else if (!env.personalApiKey.startsWith("phx_")) {
    console.error("✗ PH_PERSONAL_API_KEY should start with phx_ (got: " + env.personalApiKey.slice(0, 8) + "...).");
  }

  if (!env.host) {
    console.error("✗ PH_HOST is missing/empty (defaults to " + DEFAULT_HOST + ").");
    ok = false;
  }

  if (env.projectToken && !env.projectToken.startsWith("phc_")) {
    console.warn("⚠ PH_PROJECT_TOKEN looks wrong (expected phc_…) — it is informational only, will continue.");
  }

  if (ok) {
    console.log("✓ Env validated:");
    console.log(
      env.projectId
        ? "  project id      : " + env.projectId
        : "  project id      : (unset — will discover from the personal API key)"
    );
    console.log("  personal API key: " + env.personalApiKey.slice(0, 8) + "… (len " + env.personalApiKey.length + ")");
    console.log("  host            : " + env.host);
    console.log(
      env.projectToken
        ? "  project token   : " + env.projectToken.slice(0, 8) + "… (informational)"
        : "  project token   : (unset — fine, not required to provision)"
    );
  } else {
    console.error(
      "\nMissing/undefined config detected. Fix the variables above and re-run.\n" +
        MISSING_LABELS.map(([, name, hint]) => `  ${name} — ${hint}`).join("\n")
    );
  }

  return ok;
}

/**
 * When PH_PROJECT_ID is not set, discover it from the personal API key via the
 * `@current` project endpoint. PostHog keys are scoped to a project, and the
 * `@current` alias resolves to the key's project.
 */
async function resolveProjectId(env: Env): Promise<void> {
  if (env.projectId) return;

  console.log("\nDiscovering project id from the personal API key (@current) …");
  const res = await api<{ id?: number }>(env, "GET", "/api/projects/@current/");
  if (!res.id) {
    throw new Error("Could not determine the target project id — set PH_PROJECT_ID explicitly.");
  }
  env.projectId = String(res.id);
  console.log("  → project id " + env.projectId);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

async function api<T = unknown>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  const url = env.host.replace(/\/$/, "") + path;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + env.personalApiKey,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const json = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${method} ${path} — ${res.statusText} ${json ? JSON.stringify(json) : ""}`
    ) as ApiError;
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Preflight: validate the personal API key's access rights
// ---------------------------------------------------------------------------

async function preflight(env: Env): Promise<boolean> {
  console.log("\nPreflight — checking personal API key access …");

  let ok = true;

  // 1. The key itself resolves to a user.
  try {
    await api(env, "GET", "/api/users/@me/");
    console.log("✓ Personal API key is valid (resolves to a user).");
  } catch {
    console.error("✗ Personal API key rejected — it is invalid or revoked.");
    ok = false;
  }

  // 2. The key can access the target project.
  try {
    await api(env, "GET", "/api/projects/" + env.projectId + "/");
    console.log("✓ Personal API key can access project " + env.projectId + ".");
  } catch {
    console.error("✗ Personal API key has NO access to project " + env.projectId + ".");
    ok = false;
  }

  return ok;
}

// ---------------------------------------------------------------------------
// Provisioning: dashboards
// ---------------------------------------------------------------------------

interface Dashboard {
  id: number;
  name?: string;
  [k: string]: unknown;
}

async function findDashboard(env: Env, name: string): Promise<Dashboard | null> {
  const res = await api<{ results?: Dashboard[]; next?: string | null }>(
    env,
    "GET",
    "/api/projects/" + env.projectId + "/dashboards/?limit=100"
  );
  for (const d of res.results ?? []) {
    if (d.name === name) return d;
  }
  return null;
}

async function ensureDashboard(env: Env, name: string, description: string): Promise<Dashboard> {
  const existing = await findDashboard(env, name);
  if (existing) {
    console.log("✓ dashboard exists: " + name + "  (" + existing.id + ")");
    return existing;
  }
  const created = await api<Dashboard>(env, "POST", "/api/projects/" + env.projectId + "/dashboards/", {
    name,
    description,
    filters: { events: [] },
  });
  console.log("+ created dashboard: " + name + "  (" + created.id + ")");
  return created;
}

// ---------------------------------------------------------------------------
// Provisioning: insights (query format — legacy `filters` is rejected)
// ---------------------------------------------------------------------------

interface Insight {
  id: number;
  short_id: string;
  name?: string;
  [k: string]: unknown;
}

interface InsightSpec {
  name: string;
  query: unknown;
}

async function findInsight(env: Env, name: string): Promise<Insight | null> {
  let url = "/api/projects/" + env.projectId + "/insights/?limit=200";
  while (url) {
    const res = await api<{ results?: Insight[]; next?: string | null }>(env, "GET", url);
    for (const i of res.results ?? []) {
      if (i.name === name) return i;
    }
    url = (res.next ?? "").replace(/^.*\/api/, "/api");
  }
  return null;
}

async function createInsight(env: Env, spec: InsightSpec): Promise<Insight> {
  return api<Insight>(env, "POST", "/api/projects/" + env.projectId + "/insights/", {
    name: spec.name,
    query: spec.query,
  });
}

async function attachInsight(env: Env, insightId: number, dashboardId: number): Promise<void> {
  // PATCH replaces the full dashboards array — read existing first.
  const cur = await api<{ dashboards?: number[] }>(
    env,
    "GET",
    `/api/projects/${env.projectId}/insights/${insightId}/`
  );
  const dashboards = Array.from(new Set([...(cur.dashboards ?? []), dashboardId]));
  await api(env, "PATCH", `/api/projects/${env.projectId}/insights/${insightId}/`, { dashboards });
}

async function ensureInsight(env: Env, spec: InsightSpec, dashboardId: number): Promise<void> {
  const existing = await findInsight(env, spec.name);
  if (existing) {
    console.log("✓ insight exists: " + spec.name + "  (" + existing.short_id + ")");
    await attachInsight(env, existing.id, dashboardId);
    console.log("  ensured attached to dashboard " + dashboardId);
    return;
  }
  const created = await createInsight(env, spec);
  console.log("+ created insight: " + spec.name + "  (" + created.short_id + ")");
  await attachInsight(env, created.id, dashboardId);
  console.log("  attached to dashboard " + dashboardId);
}

// ---------------------------------------------------------------------------
// Insight query builders (query format — the supported InsightVizNode shapes)
// ---------------------------------------------------------------------------

/** TrendsQuery — a line/bar/table of one or more event series. */
function trends(series: unknown[], opts: { interval?: string; breakdown?: string; breakdownLimit?: number } = {}): unknown {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      series,
      interval: opts.interval ?? "day",
      dateRange: { date_to: null },
      ...(opts.breakdown
        ? { breakdownFilter: { breakdown_type: "event", breakdown: opts.breakdown, breakdown_limit: opts.breakdownLimit ?? 20 } }
        : {}),
    },
  };
}

/** FunnelsQuery — an ordered sequence of conversion steps (default 14-day window). */
function funnel(
  steps: Array<string | { event: string; properties?: unknown[] }>,
  opts: { window?: number; windowUnit?: string; order?: string; breakdown?: string; breakdownLimit?: number } = {}
): unknown {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: steps.map((s) =>
        typeof s === "string"
          ? { kind: "EventsNode", event: s }
          : { kind: "EventsNode", event: s.event, ...(s.properties ? { properties: s.properties } : {}) }
      ),
      dateRange: { date_to: null },
      funnelsFilter: {
        funnelOrderType: opts.order ?? "ordered",
        funnelVizType: "steps",
        funnelWindowInterval: opts.window ?? 14,
        funnelWindowIntervalUnit: opts.windowUnit ?? "day",
      },
      ...(opts.breakdown
        ? { breakdownFilter: { breakdown_type: "event", breakdown: opts.breakdown, breakdown_limit: opts.breakdownLimit ?? 20 } }
        : {}),
    },
  };
}

/** RetentionQuery — how often users come back after their first qualifying event. */
function retention(
  event: string,
  opts: { returning?: string; period?: string; intervals?: number; type?: string; reference?: string } = {}
): unknown {
  const entity = (name: string) => ({ id: name, name, type: "events" });
  const returning = opts.returning ?? event;
  return {
    kind: "InsightVizNode",
    source: {
      kind: "RetentionQuery",
      retentionFilter: {
        period: opts.period ?? "Week",
        totalIntervals: opts.intervals ?? 8,
        targetEntity: entity(event),
        returningEntity: entity(returning),
        retentionType: opts.type ?? "retention_first_time",
        retentionReference: opts.reference ?? "total",
        cumulative: false,
      },
      dateRange: { date_from: "-60d" },
    },
  };
}

const ev = (event: string, extra: Record<string, unknown> = {}): unknown => ({
  kind: "EventsNode",
  event,
  ...extra,
});

const prop = (key: string, value: unknown, operator = "exact") => ({
  key,
  operator,
  type: "event" as const,
  value: Array.isArray(value) ? value : [value],
});

// ---------------------------------------------------------------------------
// Structure definition
// ---------------------------------------------------------------------------

interface DashboardSpec {
  name: string;
  description: string;
  insights: InsightSpec[];
}

const REGISTRATION_FUNNEL: Array<string | { event: string; properties?: unknown[] }> = [
  "landing_page_viewed",
  "registration_cta_clicked",
  "registration_form_continue",
  "registration_form_submit_success",
  "confirmation_page_viewed",
];

const DASHBOARDS: DashboardSpec[] = [
  {
    name: "Overview",
    description: "High-level site and product health: visitors, pageviews, performance and content creation.",
    insights: [
      { name: "Unique visitors (DAU)", query: trends([ev("$pageview", { math: "dau" })]) },
      { name: "Weekly active users (WAU)", query: trends([ev("$pageview", { math: "weekly_active" })]) },
      { name: "Monthly active users (MAU)", query: trends([ev("$pageview", { math: "monthly_active" })]) },
      { name: "Pageviews", query: trends([ev("$pageview", { math: "total" })]) },
      { name: "Web vitals", query: trends([ev("$web_vitals", { math: "total" })]) },
      { name: "Pageviews by page type", query: trends([ev("$pageview")], { breakdown: "page_type" }) },
      { name: "Top pages", query: trends([ev("$pageview")], { breakdown: "path", breakdownLimit: 20 }) },
      { name: "Post creation rate", query: trends([ev("post_created", { math: "total" })]) },
      { name: "New visitors (first time)", query: trends([ev("$pageview", { math: "first_time_for_user" })]) },
    ],
  },
  {
    name: "Onboarding & Conversion",
    description: "Funnels across the visitor → registration journey and content activation.",
    insights: [
      { name: "Registration funnel", query: funnel(REGISTRATION_FUNNEL) },
      { name: "Landing engagement", query: funnel(["$pageview", "scroll_depth_50", "registration_cta_clicked"]) },
      {
        name: "CTA performance by section",
        query: funnel(["registration_cta_clicked", "registration_form_submit_success"], { breakdown: "cta_location" }),
      },
      {
        name: "Quiz & registration journey",
        query: funnel(["landing_page_viewed", "questions_page_viewed", "score_result_viewed", "registration_form_submit_success"]),
      },
      { name: "Visitor to subscriber", query: funnel(["$pageview", "push_subscription_enabled"], { window: 30 }) },
      { name: "Visitor to creator", query: funnel(["$pageview", "post_created"], { window: 30 }) },
      { name: "Post to engagement", query: funnel(["post_created", "post_viewed", "post_reacted"], { window: 7 }) },
    ],
  },
  {
    name: "Content Engagement",
    description: "What content performs best — posts, stories, reactions and formats.",
    insights: [
      { name: "Posts by type", query: trends([ev("post_created")], { breakdown: "post_type" }) },
      { name: "Post views over time", query: trends([ev("post_viewed", { math: "total" })]) },
      { name: "Reactions per post", query: trends([ev("post_reacted")], { breakdown: "emoji" }) },
      { name: "Most reacted posts", query: trends([ev("post_reacted")], { breakdown: "post_id", breakdownLimit: 20 }) },
      { name: "Media vs text-only posts", query: trends([ev("post_created")], { breakdown: "has_media" }) },
      {
        name: "Story engagement",
        query: trends([ev("story_viewed", { math: "total" }), ev("story_liked", { math: "total" })]),
      },
    ],
  },
  {
    name: "User Growth",
    description: "New and returning users, weekly retention and push opt-in.",
    insights: [
      { name: "New visitors (first time)", query: trends([ev("$pageview", { math: "first_time_for_user" })]) },
      { name: "Weekly retention", query: retention("$pageview", { period: "Week", intervals: 8 }) },
      {
        name: "Push opt-ins vs opt-outs",
        query: trends([ev("push_subscription_enabled", { math: "total" }), ev("push_subscription_disabled", { math: "total" })]),
      },
    ],
  },
  {
    name: "Push Notifications",
    description: "Push subscription and delivery health.",
    insights: [
      {
        name: "Push subscriptions over time",
        query: trends([ev("push_subscription_enabled", { math: "total" }), ev("push_subscription_disabled", { math: "total" })]),
      },
      { name: "Push send volume", query: trends([ev("push_notifications_sent", { math: "total" })]) },
      {
        name: "Push sends vs skipped",
        query: trends([ev("push_notifications_sent", { math: "total" }), ev("push_notifications_skipped", { math: "total" })]),
      },
      { name: "Push subscription failures", query: trends([ev("push_subscription_failed", { math: "total" })]) },
    ],
  },
  {
    name: "LLM & AI Visibility",
    description: "How AI agents and LLM crawlers discover and use the platform.",
    insights: [
      { name: "LLM asset requests", query: trends([ev("llm_asset_requested")], { breakdown: "asset" }) },
      { name: "LLM vs human traffic", query: trends([ev("$pageview")], { breakdown: "page_type" }) },
      {
        name: "OpenAPI spec downloads",
        query: trends([ev("$pageview", { properties: [prop("path", "/openapi.json")] })]),
      },
      { name: "MCP discovery (sessions by auth)", query: trends([ev("mcp_session_created")], { breakdown: "authenticated" }) },
    ],
  },
  {
    name: "MCP Usage",
    description: "Model Context Protocol server and tool usage.",
    insights: [
      { name: "MCP sessions created", query: trends([ev("mcp_session_created", { math: "total" })]) },
      { name: "MCP tool calls", query: trends([ev("mcp_tool_called", { math: "total" })]) },
      { name: "Most used MCP tools", query: trends([ev("mcp_tool_called")], { breakdown: "tool", breakdownLimit: 20 }) },
      { name: "MCP auth vs anonymous", query: trends([ev("mcp_tool_called")], { breakdown: "authenticated" }) },
      { name: "MCP tool errors", query: trends([ev("mcp_tool_called")], { breakdown: "isError" }) },
      { name: "Server key probes", query: trends([ev("server_key_probe", { math: "total" })]) },
    ],
  },
  {
    name: "Reliability",
    description: "Web vitals and client / server errors.",
    insights: [
      { name: "Web vitals", query: trends([ev("$web_vitals", { math: "total" })]) },
      { name: "Uncaught exceptions", query: trends([ev("$exception", { math: "total" })]) },
      { name: "Client errors", query: trends([ev("client_error", { math: "total" })]) },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const env = loadEnv();

  console.log("PostHog analytics bootstrap");
  console.log("---------------------------");

  if (!validateEnv(env)) {
    process.exit(1);
  }

  await resolveProjectId(env);

  const passed = await preflight(env);
  if (!passed) {
    console.error("\nPreflight failed — no changes were made. Fix the access issues and re-run.\n");
    process.exit(1);
  }

  console.log("\nProvisioning …\n");
  console.log("Dashboards & insights\n");

  for (const spec of DASHBOARDS) {
    const dashboard = await ensureDashboard(env, spec.name, spec.description);

    for (const insight of spec.insights) {
      await ensureInsight(env, insight, dashboard.id);
    }
  }

  console.log("\n✓ Bootstrap complete.");
  console.log("  Project: " + env.projectId + "  Host: " + env.host);
  if (env.projectToken) {
    console.log("  Note: PH_PROJECT_TOKEN is informational only — ingestion uses your app env, not this script.");
  }
}

main().catch((err) => {
  console.error("\n✗ Bootstrap failed:");
  console.error(err && typeof err.message === "string" ? err.message : String(err));
  process.exit(1);
});
