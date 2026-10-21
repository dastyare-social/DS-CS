export const WORKSPACE_FEED_MAX_WIDTH = 672; // the feed's default width
export const WORKSPACE_GUTTER = 16;

/**
 * The feed is the resizable column. The two side columns are what is left of
 * the window once the feed has taken its width, so they are always equal and
 * always against the window edges: the left one is the sidebar, the right one
 * is the assistant panel.
 */
export const WORKSPACE_FEED = {
  min: 480,
  max: 960,
  default: 672,
} as const;

/**
 * The narrowest a side column may get before the feed has to give width
 * back. Below this the columns stop being columns.
 */
export const WORKSPACE_BAND_MIN = 120;

/**
 * The columns exist from 1024px — the narrowest viewport where the feed keeps
 * a readable width and both side columns still have room.
 */
export const WORKSPACE_BREAKPOINT = 1024;

/**
 * The Tailwind class that reveals the columns at the breakpoint. It lives next
 * to the number so the CSS and the JS can never disagree; Tailwind picks the
 * literal up from this file.
 */
export const WORKSPACE_DESKTOP_CLASS = "min-[1024px]:flex";

/**
 * The feed's width, applied only from the breakpoint up. Below it the feed is
 * the full width of the screen, as it always was.
 */
export const WORKSPACE_DESKTOP_WIDTH_CLASS =
  "min-[1024px]:w-[var(--workspace-feed-width,672px)]";

/**
 * The width every piece of fixed chrome has to use to sit exactly over the
 * feed: the feed's width on the desktop, the screen's width on mobile, where
 * the feed is full width.
 */
export const WORKSPACE_FEED_WIDTH_CLASS =
  "w-[min(var(--workspace-feed-width,672px),100vw)]";

export type WorkspaceColumn = "feed" | "sidebar" | "panel";

export const WORKSPACE_DEFAULT_WIDTHS = {
  feed: WORKSPACE_FEED.default,
} as const;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * The width the feed may take on this viewport: its own range, and never so
 * much that one of the side columns is squeezed out of existence.
 */
export function feedWidthLimit(viewportWidth: number): number {
  return Math.max(
    WORKSPACE_FEED.min,
    Math.min(
      WORKSPACE_FEED.max,
      viewportWidth - WORKSPACE_BAND_MIN * 2,
    ),
  );
}

/**
 * Clamps the feed to what the viewport can carry. The side columns take
 * whatever is left, equally, so the feed stays centred in the window.
 */
export function fitFeedWidth(width: number, viewportWidth: number): number {
  return clamp(width, WORKSPACE_FEED.min, feedWidthLimit(viewportWidth));
}
