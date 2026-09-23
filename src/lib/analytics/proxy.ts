/**
 * First-party PostHog capture proxy.
 *
 * The browser captures to this same-origin path instead of the PostHog cloud
 * host. `next.config.ts` rewrites the path to the real PostHog hosts on the
 * server, so ad blockers that block `*.posthog.com` cannot drop pageviews,
 * heatmaps, or session recordings before they arrive.
 *
 * Shared by `client.ts` (browser `api_host`/`ui_host`) and `next.config.ts`
 * (the rewrite targets) so the path and upstream hosts never drift apart.
 */

// Same-origin path the browser captures to. `next.config.ts` rewrites it.
export const POSTHOG_INGEST_PATH = "/ingest";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

// Ingestion host the rewrite forwards capture traffic to.
export function posthogIngestionHost(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  return host ? host.replace(/\/+$/, "") : DEFAULT_POSTHOG_HOST;
}

// Assets host that serves the posthog-js extensions (recorder, surveys, ...).
// `https://us.i.posthog.com` -> `https://us-assets.i.posthog.com`.
export function posthogAssetsHost(): string {
  return regionHost((region) => `${region}-assets.i.posthog.com`);
}

// PostHog app host for the toolbar and links (posthog-js `ui_host`).
// `https://us.i.posthog.com` -> `https://us.posthog.com`.
export function posthogUiHost(): string {
  return regionHost((region) => `${region}.posthog.com`);
}

// Rewrite the cloud region host with `toHostname`. Returns the ingestion host
// unchanged for self-hosted setups that do not match the cloud pattern.
function regionHost(toHostname: (region: string) => string): string {
  const ingestion = posthogIngestionHost();
  try {
    const url = new URL(ingestion);
    const region = url.hostname.match(/^([^.]+)\.i\.posthog\.com$/)?.[1];
    if (region) url.hostname = toHostname(region);
    return url.origin;
  } catch {
    return ingestion;
  }
}
