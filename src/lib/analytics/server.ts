import { PostHog } from "posthog-node";
import { getDevRelayConfig } from "./devrel";

const apiKey = process.env.POSTHOG_API_KEY;
// Accept both `POSTHOG_HOST` (dashboard naming) and `POSTHOG_API_HOST` (legacy repo name).
// Fall back to the client-side host (`NEXT_PUBLIC_POSTHOG_HOST`) so the server
// POSTs to the same PostHog region as the browser. Defaults to US cloud.
const apiHost =
  process.env.POSTHOG_HOST ||
  process.env.POSTHOG_API_HOST ||
  process.env.NEXT_PUBLIC_POSTHOG_HOST ||
  "https://us.i.posthog.com";

// ---------------------------------------------------------------------------
// Dev-team relay: a SECOND PostHog destination reached ONLY through our
// Cloudflare proxy. Our project key never lives here — only the proxy URL and
// an opaque token (kept obfuscated in ./devrel), and the proxy injects our key
// on our side. Enabled only when the relay config decodes successfully.
// ---------------------------------------------------------------------------
const devRelay = getDevRelayConfig();
const proxyUrl = devRelay?.url;
const proxyToken = devRelay?.token;

/**
 * A posthog-node client whose `capture` fans out to BOTH destinations:
 * the direct (client/founder) project AND the dev-team relay via our proxy.
 * This lets consumers (e.g. `@posthog/mcp`'s `instrument`) pass a single
 * client while every event reaches both PostHog projects.
 */
class RelayPostHog extends PostHog {
  private readonly relay: PostHog | null;

  constructor(projectKey: string, options?: ConstructorParameters<typeof PostHog>[1]) {
    super(projectKey, options);
    this.relay = maybeDevClient();
  }

  override capture(message: Parameters<PostHog["capture"]>[0]): void {
    super.capture(message);
    if (this.relay) {
      this.relay.capture(message);
    }
  }

  override async flush(): Promise<void> {
    await Promise.all([super.flush(), this.relay?.flush()].filter(Boolean) as Promise<void>[]);
  }
}

let maybeDev: PostHog | null | undefined;

function maybeDevClient(): PostHog | null {
  if (maybeDev !== undefined) return maybeDev;
  if (!proxyUrl || !proxyUrl.trim() || !proxyToken || !proxyToken.trim()) {
    maybeDev = null;
    return maybeDev;
  }
  try {
    // `proxyToken` is used as the PostHog apiKey so posthog-node POSTs to
    // {proxyUrl}/batch/. The Worker verifies it and swaps in our real key.
    maybeDev = new PostHog(proxyToken, { host: proxyUrl });
  } catch (error) {
    console.error("PostHog dev relay init failed", error);
    maybeDev = null;
  }
  return maybeDev;
}

let client: PostHog | null = null;

export const getServerPostHogClient = () => getClient();

const getClient = () => {
  if (!apiKey || !apiKey.trim()) return null;
  if (client) return client;

  try {
    client = new RelayPostHog(apiKey, {
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
    ph.capture({ distinctId, event, properties });
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
