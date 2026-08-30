/**
 * PostHog analytics bootstrap.
 *
 * Provisions the dashboards and insights this app ships with on a PostHog
 * project via the public REST API. The suite mirrors what the app actually
 * captures — only events the codebase emits are referenced, so no dashboard
 * or insight is created for features this project does not have.
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
 *   - PH_DASHBOARD_LABEL       (optional) name of the project/repo this run
 *                              provisions for, e.g. "Workshop". When set, every
 *                              dashboard and insight name is suffixed with
 *                              " — {label}" so per-project suites can coexist in
 *                              one PostHog account (e.g. "Overview — Workshop").
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
  dashboardLabel: string | undefined;
}

function loadEnv(): Env {
  const projectId = (process.env.PH_PROJECT_ID ?? "").trim();
  const personalApiKey = (process.env.PH_PERSONAL_API_KEY ?? "").trim();
  const host = (process.env.PH_HOST ?? "").trim() || DEFAULT_HOST;
  const projectToken = (process.env.PH_PROJECT_TOKEN ?? "").trim() || undefined;
  const dashboardLabel = (process.env.PH_DASHBOARD_LABEL ?? "").trim() || undefined;

  return { projectId, personalApiKey, host, projectToken, dashboardLabel };
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
    console.log(
      env.dashboardLabel
        ? "  dashboard label : " + env.dashboardLabel + "  (names suffixed with \" — " + env.dashboardLabel + "\")"
        : "  dashboard label : (unset — neutral dashboard names)"
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

const MAX_API_ATTEMPTS = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api<T = unknown>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  const url = env.host.replace(/\/$/, "") + path;
  let backoffMs = 2000;

  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt++) {
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

    if ((res.status === 429 || res.status >= 500) && attempt < MAX_API_ATTEMPTS) {
      let wait = backoffMs;
      const retryAfter = res.headers.get("retry-after");
      if (retryAfter) {
        const secs = Number(retryAfter);
        if (!Number.isNaN(secs)) wait = secs * 1000;
      } else if (json && typeof json === "object" && typeof (json as { detail?: unknown }).detail === "string") {
        const m = /Expected available in (\d+) seconds?/.exec((json as { detail: string }).detail);
        if (m) wait = (Number(m[1]) + 1) * 1000;
      }
      console.log(
        `  ⏳ rate limited (HTTP ${res.status}) — retrying in ${Math.round(wait / 1000)}s (attempt ${attempt}/${MAX_API_ATTEMPTS})`
      );
      await sleep(wait);
      backoffMs = Math.min(backoffMs * 1.5, 30000);
      continue;
    }

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

  throw new Error(`HTTP request gave up after ${MAX_API_ATTEMPTS} attempts: ${method} ${path}`);
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
    filters: {},
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

// ---------------------------------------------------------------------------
// Structure definition
// ---------------------------------------------------------------------------

interface DashboardSpec {
  name: string;
  description: string;
  insights: InsightSpec[];
}

const DASHBOARDS: DashboardSpec[] = [
  {
    name: "Overview",
    description: "Site health: visitors, pageviews and content creation in the social app.",
    insights: [
      { name: "Unique Visitors (DAU)", query: trends([ev("$pageview", { math: "dau" })]) },
      { name: "Weekly Active Users (WAU)", query: trends([ev("$pageview", { math: "weekly_active" })]) },
      { name: "Monthly Active Users (MAU)", query: trends([ev("$pageview", { math: "monthly_active" })]) },
      { name: "Pageviews", query: trends([ev("$pageview", { math: "total" })]) },
      { name: "Top Pages", query: trends([ev("$pageview")], { breakdown: "pathname", breakdownLimit: 20 }) },
      { name: "Post Creation Rate", query: trends([ev("post_created", { math: "total" })]) },
      { name: "Story Creation Rate", query: trends([ev("story_created", { math: "total" })]) },
    ],
  },
  {
    name: "Content Engagement",
    description: "What content performs best — posts, stories, reactions and formats.",
    insights: [
      { name: "Posts by Type", query: trends([ev("post_created")], { breakdown: "post_type" }) },
      { name: "Media vs Text-Only Posts", query: trends([ev("post_created")], { breakdown: "has_media" }) },
      { name: "Post Views Over Time", query: trends([ev("post_viewed", { math: "total" })]) },
      { name: "Reactions Per Post", query: trends([ev("post_reacted")], { breakdown: "emoji" }) },
      { name: "Most Reacted Posts", query: trends([ev("post_reacted")], { breakdown: "post_id", breakdownLimit: 20 }) },
      {
        name: "Story Views & Likes",
        query: trends([ev("story_viewed", { math: "total" }), ev("story_liked", { math: "total" })]),
      },
    ],
  },
  {
    name: "Push Notifications",
    description: "Push subscription and delivery health.",
    insights: [
      { name: "Push Send Volume", query: trends([ev("push_notifications_sent", { math: "total" })]) },
      {
        name: "Push Sends vs Skipped",
        query: trends([ev("push_notifications_sent", { math: "total" }), ev("push_notifications_skipped", { math: "total" })]),
      },
      { name: "Push Notification Failures", query: trends([ev("push_notifications_failed", { math: "total" })]) },
      {
        name: "Push Subscriptions Opt-Ins vs Opt-Outs",
        query: trends([ev("push_subscription_saved", { math: "total" }), ev("push_subscription_disabled", { math: "total" })]),
      },
      { name: "Push Subscription Failures", query: trends([ev("push_subscription_failed", { math: "total" })]) },
    ],
  },
  {
    name: "LLM & AI Visibility",
    description: "How AI agents and LLM crawlers discover and use the platform.",
    insights: [
      { name: "LLM Asset Requests", query: trends([ev("llm_asset_requested")], { breakdown: "asset" }) },
      { name: "MCP Sessions by Auth", query: trends([ev("mcp_session_created")], { breakdown: "authenticated" }) },
      { name: "MCP Auth vs Anonymous", query: trends([ev("mcp_tool_called")], { breakdown: "authenticated" }) },
    ],
  },
  {
    name: "MCP Usage",
    description: "Model Context Protocol server and tool usage.",
    insights: [
      { name: "MCP Tool Calls Over Time", query: trends([ev("mcp_tool_called", { math: "total" })]) },
      { name: "Most Used MCP Tools", query: trends([ev("mcp_tool_called")], { breakdown: "tool", breakdownLimit: 20 }) },
      { name: "MCP Tool Errors", query: trends([ev("mcp_tool_called")], { breakdown: "isError" }) },
    ],
  },
  {
    name: "User Growth & Retention",
    description: "New visitors, weekly retention and opt-in dynamics.",
    insights: [
      { name: "New Visitors (First Time)", query: trends([ev("$pageview", { math: "first_time_for_user" })]) },
      { name: "Weekly Retention", query: retention("$pageview", { period: "Week", intervals: 8 }) },
    ],
  },
  {
    name: "Reliability",
    description: "Web performance and client-side errors.",
    insights: [
      { name: "Web Vitals", query: trends([ev("$web_vitals", { math: "total" })]) },
      { name: "Client Errors", query: trends([ev("client_error", { math: "total" })]) },
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

  const label = env.dashboardLabel;
  const nameFor = (base: string) => (label ? base + " — " + label : base);

  for (const spec of DASHBOARDS) {
    const dashboard = await ensureDashboard(env, nameFor(spec.name), spec.description);

    for (const insight of spec.insights) {
      await ensureInsight(env, { name: nameFor(insight.name), query: insight.query }, dashboard.id);
    }
  }

  console.log("\n✓ Bootstrap complete.");
  console.log("  Project: " + env.projectId + "  Host: " + env.host);
  if (label) console.log("  Label  : " + label + "  (dashboards/insights suffixed \" — " + label + "\")");
  if (env.projectToken) {
    console.log("  Note: PH_PROJECT_TOKEN is informational only — ingestion uses your app env, not this script.");
  }
}

main().catch((err) => {
  console.error("\n✗ Bootstrap failed:");
  console.error(err && typeof err.message === "string" ? err.message : String(err));
  process.exit(1);
});
