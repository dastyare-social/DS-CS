export const WORKSPACE_FEED_MAX_WIDTH = 672; // the feed's default width
export const WORKSPACE_GUTTER = 16;

/**
 * The workspace is three columns that fill the window: a left column, the
 * feed, and a right column. The feed is the only one that is resized by
 * dragging its own edges, and each of its edges is free — dragging one moves
 * that edge and nothing else.
 */
export const WORKSPACE_LEFT = {
  min: 200,
  max: 640,
  default: 240,
} as const;

export const WORKSPACE_FEED = {
  min: 480,
  max: 960,
  default: 672,
} as const;

export const WORKSPACE_RIGHT = {
  min: 280,
  max: 640,
  default: 320,
} as const;

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
 * The left column's width, applied only from the breakpoint up.
 */
export const WORKSPACE_DESKTOP_LEFT_CLASS =
  "min-[1024px]:w-[var(--workspace-left-width,240px)]";

/**
 * The width every piece of fixed chrome has to use to sit exactly over the
 * feed: the feed's width on the desktop, the screen's width on mobile, where
 * the feed is full width.
 */
export const WORKSPACE_FEED_WIDTH_CLASS =
  "w-[min(var(--workspace-feed-width,672px),100vw)]";

/**
 * The saved widths live in cookies, not in localStorage, because the server
 * has to be able to read them: the widths are part of the layout, and a width
 * the server cannot see is a width the first paint gets wrong.
 */
export const WORKSPACE_LEFT_COOKIE = "ds.workspace.left-width";
export const WORKSPACE_FEED_COOKIE = "ds.workspace.feed-width";

/**
 * Runs before the first paint and publishes the saved widths, so the feed is
 * never painted at the fallback width and then resized.
 */
export const WORKSPACE_WIDTH_SCRIPT = `(function(){try{var c=document.cookie;var l=c.match(/(?:^|; )ds\\.workspace\\.left-width=([^;]*)/);var f=c.match(/(?:^|; )ds\\.workspace\\.feed-width=([^;]*)/);if(l){var v=parseInt(decodeURIComponent(l[1]),10);if(isFinite(v)&&v>0){document.documentElement.style.setProperty("--workspace-left-width",v+"px")}}if(f){var v2=parseInt(decodeURIComponent(f[1]),10);if(isFinite(v2)&&v2>0){document.documentElement.style.setProperty("--workspace-feed-width",v2+"px")}}}catch(e){}})();`;

export interface WorkspaceWidths {
  /** The left column's width. */
  left: number;
  /** The feed's width. */
  feed: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * The right column takes whatever is left of the window, so the three columns
 * always fill it exactly.
 */
export function rightWidth(
  widths: WorkspaceWidths,
  viewportWidth: number,
): number {
  return Math.max(0, viewportWidth - widths.left - widths.feed);
}

/**
 * Keeps the three columns inside the window: the feed gives up width first,
 * then the left column, and the right column is whatever is left.
 */
export function fitWorkspaceWidths(
  widths: WorkspaceWidths,
  viewportWidth: number,
): WorkspaceWidths {
  let left = clamp(widths.left, WORKSPACE_LEFT.min, WORKSPACE_LEFT.max);
  let feed = clamp(widths.feed, WORKSPACE_FEED.min, WORKSPACE_FEED.max);

  const available = viewportWidth - WORKSPACE_RIGHT.min;

  if (left + feed > available) {
    const feedRoom = feed - WORKSPACE_FEED.min;
    const take = Math.min(feedRoom, left + feed - available);
    feed -= take;

    if (left + feed > available) {
      left = Math.max(WORKSPACE_LEFT.min, available - feed);
    }
  }

  return { left, feed };
}

/**
 * Moves the boundary between the left column and the feed.
 *
 * The boundary follows the pointer; the feed and the left column trade the
 * width. The feed's other edge does not move, so a drag on one side of the
 * feed never resizes the other side too.
 */
export function dragLeftBoundary(
  widths: WorkspaceWidths,
  delta: number,
): WorkspaceWidths {
  // How far the boundary wants to move.
  const targetLeft = clamp(
    widths.left + delta,
    WORKSPACE_LEFT.min,
    WORKSPACE_LEFT.max,
  );
  const moved = targetLeft - widths.left;

  // The feed gives up the width the boundary took, so its other edge stays
  // exactly where it was.
  const feed = clamp(
    widths.feed - moved,
    WORKSPACE_FEED.min,
    WORKSPACE_FEED.max,
  );

  // If the feed could not give up that much, the left column takes the rest.
  const left = clamp(
    widths.left + (widths.feed - feed),
    WORKSPACE_LEFT.min,
    WORKSPACE_LEFT.max,
  );

  return { left, feed };
}

/**
 * Moves the boundary between the feed and the right column. Same rule: the
 * boundary follows the pointer and the two columns trade the width.
 */
export function dragRightBoundary(
  widths: WorkspaceWidths,
  delta: number,
  viewportWidth: number,
): WorkspaceWidths {
  const wanted = clamp(
    widths.feed + delta,
    WORKSPACE_FEED.min,
    WORKSPACE_FEED.max,
  );
  const right = rightWidth(widths, viewportWidth);
  const moved = wanted - widths.feed;

  if (right - moved < WORKSPACE_RIGHT.min) {
    // The right column is as narrow as it may be: the feed grows only as far
    // as the right column can give.
    return {
      left: widths.left,
      feed: clamp(
        widths.feed + (right - WORKSPACE_RIGHT.min),
        WORKSPACE_FEED.min,
        WORKSPACE_FEED.max,
      ),
    };
  }

  return { left: widths.left, feed: wanted };
}
