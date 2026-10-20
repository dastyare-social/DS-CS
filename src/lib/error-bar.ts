/**
 * Publisher for the global transient error bar
 * (`src/components/error-bar.tsx`).
 *
 * `raiseError()` is the single entry point for failures that are worth telling
 * the user about but are not worth holding the screen for: a rejected write, a
 * failed upload, a dropped request. The bar is mounted once in
 * `src/app/(routes)/layout.tsx`, so nothing has to thread a callback or a
 * context through to reach it — a window event crosses server/client component
 * boundaries and reaches into plain callbacks inside hooks and stores.
 *
 * Not for errors that need to stay. Form validation, the per-attachment upload
 * chips with their retry button, and the persistent load/publish error screens
 * each own their own surface and should keep it. See `docs/design-system.md` §6.3.
 */

/** Window event the bar listens for. Prefix is namespaced to avoid collisions. */
export const ERROR_BAR_EVENT = "dastyare:error-bar";

/** Auto-dismiss delay. Matches the transient notices this bar absorbed. */
export const ERROR_BAR_DURATION_MS = 4000;

/** Default fallback for a thrown value that carries no usable message. */
const DEFAULT_FALLBACK = "Operation failed";

export type ErrorBarDetail = {
  message: string;
  /** Override the auto-dismiss delay for this message, in ms. */
  duration?: number;
};

function toMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();
  // null/undefined are "nothing happened", not a message-less failure — they
  // must not fall through to the fallback. Callers routinely pass a nullable
  // message straight through (`raiseError(result.error)`), and showing
  // "Operation failed" on a success is worse than showing nothing.
  if (error === null || error === undefined) return "";
  return fallback;
}

/**
 * Show `error` in the bar for {@link ERROR_BAR_DURATION_MS}.
 *
 * A new message replaces the current one and restarts the timer. Repeating the
 * message already on screen is a no-op — not a replace, not a timer reset — so a
 * retry loop that throws the same error every couple of seconds cannot hold the
 * bar open forever. The dedupe lives in the bar, which is the only place that
 * knows what is currently displayed.
 *
 * No-ops on `null`, `undefined` and empty/blank messages, so a call site can
 * pass a nullable message straight through without guarding first.
 *
 * @param error    An `Error`, a string, or anything else (see `fallback`).
 * @param fallback Used when `error` is neither a string nor an `Error`. Pass a
 *                 localized string when the caller has translations in scope.
 * @param duration Auto-dismiss delay override, in ms.
 */
export function raiseError(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK,
  duration: number = ERROR_BAR_DURATION_MS,
): void {
  if (typeof window === "undefined") return;

  const message = toMessage(error, fallback);
  if (!message) return;

  // Constructed off `window` so the event is always in the same realm as the
  // window it is dispatched on — `dispatchEvent` rejects a foreign Event.
  window.dispatchEvent(
    new window.CustomEvent<ErrorBarDetail>(ERROR_BAR_EVENT, {
      detail: { message, duration },
    }),
  );
}
