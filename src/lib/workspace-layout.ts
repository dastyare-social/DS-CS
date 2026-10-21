export const WORKSPACE_FEED_MAX_WIDTH = 672; // Tailwind max-w-2xl
export const WORKSPACE_GUTTER = 16;

export const WORKSPACE_SIDEBAR = {
  min: 200,
  max: 340,
  default: 240,
} as const;

export const WORKSPACE_PANEL = {
  min: 280,
  max: 460,
  default: 320,
} as const;

/**
 * The panels are sized in CSS, not with a Tailwind breakpoint token, so the
 * breakpoint is a number the shell and the layout math share:
 *
 *   200 (sidebar min) + 672 (feed) + 280 (panel min) + 32 (gutters) = 1184
 *
 * Below that the panels would have to eat into the feed column, so they are
 * hidden and the layout falls back to the single-column mobile view.
 */
export const WORKSPACE_BREAKPOINT = 1184;

/**
 * The Tailwind class that reveals the panels at the breakpoint. It lives next
 * to the number so the CSS and the JS can never disagree; Tailwind picks the
 * literal up from this file.
 */
export const WORKSPACE_DESKTOP_CLASS = "min-[1184px]:flex";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Width available to both panels together once the feed column and the outer
 * gutter are accounted for.
 */
export function panelBudget(viewportWidth: number): number {
  return Math.max(
    0,
    viewportWidth - WORKSPACE_FEED_MAX_WIDTH - WORKSPACE_GUTTER * 2,
  );
}

/**
 * Keeps the pair inside the viewport. When the combined width exceeds the
 * budget, both panels give up space in proportion to how far each sits above
 * its own minimum, so neither collapses to a sliver first.
 */
export function fitWorkspaceWidths(
  sidebar: number,
  panel: number,
  viewportWidth: number,
): { sidebar: number; panel: number } {
  let nextSidebar = clamp(
    sidebar,
    WORKSPACE_SIDEBAR.min,
    WORKSPACE_SIDEBAR.max,
  );
  let nextPanel = clamp(panel, WORKSPACE_PANEL.min, WORKSPACE_PANEL.max);

  const budget = panelBudget(viewportWidth);
  const overflow = nextSidebar + nextPanel - budget;

  if (overflow <= 0) {
    return { sidebar: nextSidebar, panel: nextPanel };
  }

  const sidebarRoom = nextSidebar - WORKSPACE_SIDEBAR.min;
  const panelRoom = nextPanel - WORKSPACE_PANEL.min;
  const totalRoom = sidebarRoom + panelRoom;

  if (totalRoom <= 0) {
    return { sidebar: nextSidebar, panel: nextPanel };
  }

  const sidebarCut = Math.min(
    sidebarRoom,
    Math.round(overflow * (sidebarRoom / totalRoom)),
  );
  nextSidebar -= sidebarCut;
  nextPanel = Math.max(
    WORKSPACE_PANEL.min,
    nextPanel - (overflow - sidebarCut),
  );

  return { sidebar: nextSidebar, panel: nextPanel };
}
