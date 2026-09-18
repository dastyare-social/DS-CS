import type { PostHog } from "posthog-js";

const apiKey =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_API_HOST;

let posthog: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

const canInit = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) return false;
  if (typeof apiHost !== "string" || apiHost.trim().length === 0) return false;
  return true;
};

async function getPosthog() {
  if (!canInit()) return null;
  if (posthog) return posthog;
  const phModule = await import("posthog-js");
  posthog = phModule.default as PostHog;
  return posthog;
}

function forEachClient(fn: (client: PostHog) => void) {
  if (typeof window === "undefined") return;
  if (posthog) fn(posthog);
}

// Resolve once the document has finished loading. PostHog injects <script> tags
// into the document when it initializes; doing that while React still hydrates
// collides with the server-rendered JSON-LD <script> tags and breaks hydration
// (React error #418). The `load` event fires after hydration, so waiting for it
// keeps the injected scripts out of the hydration window.
export function whenDocumentReady(): Promise<void> {
  if (typeof document === "undefined" || document.readyState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

export function initPostHog(): Promise<PostHog | null> {
  if (!canInit()) return Promise.resolve(null);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await whenDocumentReady();

    const ph = await getPosthog();
    if (!ph) {
      initPromise = null;
      return null;
    }

    try {
      const startRecording = () => ph.startSessionRecording();
      ph.init(apiKey!, {
        api_host: apiHost,
        autocapture: false,
        capture_pageview: false,
        capture_heatmaps: true,
        loaded: startRecording,
      });
      return ph;
    } catch (error) {
      console.error("PostHog init failed", error);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

export async function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  const ph = await initPostHog();
  if (!ph) return;
  try {
    forEachClient((client) => client.capture(event, properties));
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
    forEachClient((client) => {
      client.identify(distinctId);
      if (properties && Object.keys(properties).length > 0) {
        client.people.set(properties);
      }
    });
  } catch (error) {
    console.error("PostHog identify failed", error);
  }
}

/**
 * Capture a client-side error (uncaught exception or unhandled promise
 * rejection) to PostHog as a `client_error` event. Deliberately uses a custom
 * event (not PostHog's `$exception` autocapture) to stay consistent with the
 * rest of the app's manual event taxonomy and the `autocapture: false` config.
 */
let errorTrackingInstalled = false;

export async function captureClientError(
  error: unknown,
  context?: { source?: string; info?: unknown }
) {
  const ph = await initPostHog();
  if (!ph) return;

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown client error";
  const stack = error instanceof Error ? error.stack : undefined;
  const name = error instanceof Error ? error.name : undefined;

  try {
    const base = {
      message,
      stack,
      error_name: name,
      source: context?.source ?? "throw",
      url: typeof window !== "undefined" ? window.location.href : undefined,
      ...(context?.info ? { info: context.info } : {}),
    };
    forEachClient((client) => client.capture("client_error", base));
  } catch (e) {
    console.error("PostHog client error capture failed", e);
  }
}

/**
 * Install global listeners for uncaught exceptions (`window.onerror`) and
 * unhandled promise rejections (`unhandledrejection`) and report them to
 * PostHog. Idempotent — safe to call from a client component.
 */
export function setupClientErrorTracking() {
  if (typeof window === "undefined" || errorTrackingInstalled) return;
  errorTrackingInstalled = true;

  window.addEventListener("error", (event) => {
    void captureClientError(event.error ?? event.message, {
      source: "window.onerror",
      info: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void captureClientError(reason, {
      source: "unhandledrejection",
    });
  });
}
