import { describe, expect, it } from "bun:test";

import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_FEED_MAX_WIDTH,
  WORKSPACE_FEED_MIN_WIDTH,
  WORKSPACE_GUTTER,
  WORKSPACE_PANEL,
  WORKSPACE_SIDEBAR,
  clamp,
  fitWorkspaceWidths,
  panelBudget,
} from "../workspace-layout";

describe("clamp", () => {
  it("rounds and bounds a width", () => {
    expect(clamp(250.6, 200, 340)).toBe(251);
    expect(clamp(10, 200, 340)).toBe(200);
    expect(clamp(999, 200, 340)).toBe(340);
  });

  it("falls back to the minimum for non-finite input", () => {
    expect(clamp(Number.NaN, 200, 340)).toBe(200);
  });
});

describe("panelBudget", () => {
  it("charges the feed its minimum width and both gutters", () => {
    expect(panelBudget(1280)).toBe(
      1280 - WORKSPACE_FEED_MIN_WIDTH - WORKSPACE_GUTTER * 2,
    );
  });

  it("never goes negative on narrow viewports", () => {
    expect(panelBudget(500)).toBe(0);
  });
});

describe("WORKSPACE_DESKTOP_CLASS", () => {
  it("targets the same breakpoint the shell measures", () => {
    expect(WORKSPACE_DESKTOP_CLASS).toBe(
      `min-[${WORKSPACE_BREAKPOINT}px]:flex`,
    );
  });
});

describe("fitWorkspaceWidths", () => {
  it("keeps the defaults at the desktop breakpoint", () => {
    const fitted = fitWorkspaceWidths(
      WORKSPACE_SIDEBAR.default,
      WORKSPACE_PANEL.default,
      1280,
    );
    expect(fitted).toEqual({
      sidebar: WORKSPACE_SIDEBAR.default,
      panel: WORKSPACE_PANEL.default,
    });
  });

  it("still fits both panels at their minimums on the narrowest desktop", () => {
    const budget = panelBudget(WORKSPACE_BREAKPOINT);
    expect(budget).toBeGreaterThanOrEqual(
      WORKSPACE_SIDEBAR.min + WORKSPACE_PANEL.min,
    );

    const fitted = fitWorkspaceWidths(
      WORKSPACE_SIDEBAR.default,
      WORKSPACE_PANEL.default,
      WORKSPACE_BREAKPOINT,
    );
    expect(fitted.sidebar).toBeGreaterThanOrEqual(WORKSPACE_SIDEBAR.min);
    expect(fitted.panel).toBeGreaterThanOrEqual(WORKSPACE_PANEL.min);
    expect(fitted.sidebar + fitted.panel).toBeLessThanOrEqual(budget);
  });

  it("leaves the feed at least its minimum width on the narrowest desktop", () => {
    const fitted = fitWorkspaceWidths(
      WORKSPACE_SIDEBAR.min,
      WORKSPACE_PANEL.min,
      WORKSPACE_BREAKPOINT,
    );
    const feed = WORKSPACE_BREAKPOINT - fitted.sidebar - fitted.panel;

    expect(feed).toBeGreaterThanOrEqual(WORKSPACE_FEED_MIN_WIDTH);
    expect(feed).toBeLessThanOrEqual(WORKSPACE_FEED_MAX_WIDTH);
  });

  it("bounds values to each panel's range", () => {
    const fitted = fitWorkspaceWidths(10, 9999, 1920);
    expect(fitted.sidebar).toBe(WORKSPACE_SIDEBAR.min);
    expect(fitted.panel).toBe(WORKSPACE_PANEL.max);
  });

  it("shrinks both panels proportionally when they would overflow", () => {
    const viewport = 1280;
    const fitted = fitWorkspaceWidths(340, 460, viewport);

    expect(fitted.sidebar + fitted.panel).toBeLessThanOrEqual(
      panelBudget(viewport),
    );
    expect(fitted.sidebar).toBeGreaterThanOrEqual(WORKSPACE_SIDEBAR.min);
    expect(fitted.panel).toBeGreaterThanOrEqual(WORKSPACE_PANEL.min);
  });

  it("leaves room for the feed at every supported desktop width", () => {
    for (
      let viewport = WORKSPACE_BREAKPOINT;
      viewport <= 2560;
      viewport += 16
    ) {
      const fitted = fitWorkspaceWidths(
        WORKSPACE_SIDEBAR.max,
        WORKSPACE_PANEL.max,
        viewport,
      );
      expect(fitted.sidebar + fitted.panel).toBeLessThanOrEqual(
        panelBudget(viewport),
      );
    }
  });
});
