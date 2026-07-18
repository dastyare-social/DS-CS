// Accept both the PostHog dashboard names and the repo's previous names for
// backward compatibility. Prefer the dashboard-style names:
// - NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
// - NEXT_PUBLIC_POSTHOG_HOST
import type { PostHog } from "posthog-js";
const apiKey =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_API_HOST;
let posthog: PostHog | null = null;
let initialized = false;

const canInit = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof apiKey === "string" && apiKey.trim().length > 0 && typeof apiHost === "string" && apiHost.trim().length > 0;

async function getPosthog() {
  if (!canInit()) return null;
  if (posthog) return posthog;
  const phModule = await import("posthog-js");
  posthog = phModule.default as PostHog;
  return posthog;
}

export async function initPostHog() {
  if (!canInit()) return null;
  if (initialized) return posthog;

  const ph = await getPosthog();
  if (!ph) return null;

  try {
    ph.init(apiKey!, {
      api_host: apiHost,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      loaded: () => {
        // no-op
      },
    });
    initialized = true;
    return ph;
  } catch (error) {
    console.error("PostHog init failed", error);
    return null;
  }
}

export async function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  const ph = await initPostHog();
  if (!ph) return;
  try {
    ph.capture(event, properties);
  } catch (error) {
    console.error("PostHog capture failed", error);
  }
}

export async function identifyClient(
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const ph = await initPostHog();
  if (!ph) return;
  try {
    ph.identify(distinctId);
    if (properties && Object.keys(properties).length > 0) {
      ph.people.set(properties);
    }
  } catch (error) {
    console.error("PostHog identify failed", error);
  }
}
