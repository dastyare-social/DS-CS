import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
// Accept both `POSTHOG_HOST` (dashboard naming) and `POSTHOG_API_HOST` (legacy repo name).
// Fall back to the client-side host (`NEXT_PUBLIC_POSTHOG_HOST`) so the server
// POSTs to the same PostHog region as the browser. Defaults to US cloud.
const apiHost =
  process.env.POSTHOG_HOST ||
  process.env.POSTHOG_API_HOST ||
  process.env.NEXT_PUBLIC_POSTHOG_HOST ||
  "https://us.i.posthog.com";

let client: PostHog | null = null;

export const getServerPostHogClient = () => getClient();

const getClient = () => {
  if (!apiKey || !apiKey.trim()) return null;
  if (client) return client;

  try {
    client = new PostHog(apiKey, {
      host: apiHost,
    });
  } catch (error) {
    console.error("PostHog server init failed", error);
    return null;
  }

  return client;
};

export function captureServerEvent(
  event: string,
  properties?: Record<string, unknown>,
  distinctId = "anonymous"
) {
  const ph = getClient();
  if (!ph) return;

  try {
    ph.capture({
      distinctId,
      event,
      properties,
    });
  } catch (error) {
    console.error("PostHog server capture failed", error);
  }
}

export async function flushServerEvents() {
  const ph = getClient();
  if (!ph) return;
  try {
    await ph.flush();
  } catch (error) {
    console.error("PostHog server flush failed", error);
  }
}
