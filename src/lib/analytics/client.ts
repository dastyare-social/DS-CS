import type { PostHog } from "posthog-js";
import { POSTHOG_INGEST_PATH, posthogUiHost } from "./proxy";

const apiKey =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_API_KEY;
// Only gates init on the host being configured. The browser captures to the
// same-origin `POSTHOG_INGEST_PATH`, which `next.config.ts` rewrites to this
// host, so ad blockers cannot drop the third-party request.
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_API_HOST;

let posthog: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

const isLocalhost = () => {
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
};

const canInit = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  // Stay quiet outside a production build and on local dev hosts. `next dev`
  // runs with NODE_ENV="development" and serves from localhost, so this keeps
  // local sessions from writing exceptions and recordings into the production
  // project.
  if (process.env.NODE_ENV !== "production") return false;
  if (isLocalhost()) return false;
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

// Resolve once the document has finished loading. PostHog injects <script>
// tags into the document when it initializes; doing that while React still
// hydrates collides with the server-rendered JSON-LD <script> tags and breaks
// hydration (React error #418). The `load` event fires after hydration, so
// waiting for it keeps the injected scripts out of the hydration window.
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
        api_host: POSTHOG_INGEST_PATH,
        ui_host: posthogUiHost(),
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
 * rejection) to PostHog as a `client_error` event. This is a manual event that
 * fits the app's own event taxonomy. It does not replace PostHog's `$exception`
 * autocapture: that capture runs from a project-level setting, and the client
 * `autocapture: false` option turns off click and pageview autocapture only,
 * not exception capture.
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
