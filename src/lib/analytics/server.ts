import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
// Accept both `POSTHOG_HOST` (dashboard naming) and `POSTHOG_API_HOST` (legacy repo name).
const apiHost = process.env.POSTHOG_HOST || process.env.POSTHOG_API_HOST || "https://app.posthog.com";

let client: PostHog | null = null;

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
