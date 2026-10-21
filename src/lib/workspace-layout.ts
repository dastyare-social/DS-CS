export const WORKSPACE_FEED_MAX_WIDTH = 672; // Tailwind max-w-2xl
export const WORKSPACE_FEED_MIN_WIDTH = 512; // the feed yields width to the panels down to this
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
 * The panels appear from 1024px — the narrowest viewport where both panels
 * fit at their minimum widths (200 + 280) with a readable feed between them
 * (1024 − 480 = 544). The feed's 672px is a ceiling, not a guarantee: between
 * 1024px and 1184px it gives up width to the panels, never below
 * WORKSPACE_FEED_MIN_WIDTH.
 */
export const WORKSPACE_BREAKPOINT = 1024;

/**
 * The Tailwind class that reveals the panels at the breakpoint. It lives next
 * to the number so the CSS and the JS can never disagree; Tailwind picks the
 * literal up from this file.
 */
export const WORKSPACE_DESKTOP_CLASS = "min-[1024px]:flex";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Width available to both panels together once the feed column and the outer
 * gutter are accounted for. The feed is charged its *minimum* here, so the
 * panels can be widened even on a screen where the feed has to shrink.
 */
export function panelBudget(viewportWidth: number): number {
  return Math.max(
    0,
    viewportWidth - WORKSPACE_FEED_MIN_WIDTH - WORKSPACE_GUTTER * 2,
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
