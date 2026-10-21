export const WORKSPACE_FEED_MAX_WIDTH = 672; // the feed's default width
export const WORKSPACE_GUTTER = 16;

export const WORKSPACE_SIDEBAR = {
  min: 200,
  max: 340,
  default: 240,
} as const;

export const WORKSPACE_FEED = {
  min: 480,
  max: 960,
  default: 672,
} as const;

export const WORKSPACE_PANEL = {
  min: 280,
  max: 460,
  default: 320,
} as const;

/**
 * The panels appear from 1024px — the narrowest viewport where both panels
 * fit at their minimum widths (200 + 280) with a readable feed between them
 * (1024 − 32 gutters − 480 = 512).
 */
export const WORKSPACE_BREAKPOINT = 1024;

/**
 * The Tailwind class that reveals the panels at the breakpoint. It lives next
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

export type WorkspaceColumn = "sidebar" | "feed" | "panel";

export interface WorkspaceWidths {
  sidebar: number;
  feed: number;
  panel: number;
}

export const WORKSPACE_RANGES = {
  sidebar: WORKSPACE_SIDEBAR,
  feed: WORKSPACE_FEED,
  panel: WORKSPACE_PANEL,
} as const;

export const WORKSPACE_DEFAULT_WIDTHS: WorkspaceWidths = {
  sidebar: WORKSPACE_SIDEBAR.default,
  feed: WORKSPACE_FEED.default,
  panel: WORKSPACE_PANEL.default,
};

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * The width the three columns share, once the outer gutters are accounted
 * for.
 */
export function workspaceBudget(viewportWidth: number): number {
  return Math.max(0, viewportWidth - WORKSPACE_GUTTER * 2);
}

/**
 * Clamps every column to its own range and keeps the three inside the
 * viewport.
 *
 * When the columns do not fit, the space comes from the ones that are *not*
 * being dragged, outermost first (panel, then sidebar) and only then from the
 * dragged column. The feed is the last resort: it is the content.
 */
export function fitWorkspaceWidths(
  widths: WorkspaceWidths,
  viewportWidth: number,
  pinned: WorkspaceColumn | null = null,
): WorkspaceWidths {
  const next: WorkspaceWidths = {
    sidebar: clamp(
      widths.sidebar,
      WORKSPACE_SIDEBAR.min,
      WORKSPACE_SIDEBAR.max,
    ),
    feed: clamp(widths.feed, WORKSPACE_FEED.min, WORKSPACE_FEED.max),
    panel: clamp(widths.panel, WORKSPACE_PANEL.min, WORKSPACE_PANEL.max),
  };

  const budget = workspaceBudget(viewportWidth);
  let overflow =
    next.sidebar + next.feed + next.panel - budget;

  if (overflow <= 0) return next;

  const order: WorkspaceColumn[] = ["panel", "sidebar", "feed"];
  for (const column of order) {
    if (overflow <= 0) break;
    if (pinned && column === pinned) continue;

    const range = WORKSPACE_RANGES[column];
    const room = next[column] - range.min;
    if (room <= 0) continue;

    const take = Math.min(room, overflow);
    next[column] -= take;
    overflow -= take;
  }

  if (overflow > 0 && pinned) {
    const range = WORKSPACE_RANGES[pinned];
    next[pinned] = Math.max(range.min, next[pinned] - overflow);
  }

  return next;
}

/**
 * How far the feed's centre sits from the viewport's centre.
 *
 * The row is centred, so the feed's centre is the viewport's centre plus half
 * the difference between the two outer columns. The feed's own width cancels
 * out — widening the feed does not move it.
 */
export function workspaceShift(widths: WorkspaceWidths): number {
  return (widths.sidebar - widths.panel) / 2;
}
