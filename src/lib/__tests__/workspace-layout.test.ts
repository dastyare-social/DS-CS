import { describe, expect, it } from "bun:test";

import {
  WORKSPACE_FEED_MAX_WIDTH,
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
  it("subtracts the feed column and both gutters", () => {
    expect(panelBudget(1280)).toBe(
      1280 - WORKSPACE_FEED_MAX_WIDTH - WORKSPACE_GUTTER * 2,
    );
  });

  it("never goes negative on narrow viewports", () => {
    expect(panelBudget(500)).toBe(0);
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
    for (let viewport = 1280; viewport <= 2560; viewport += 16) {
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
