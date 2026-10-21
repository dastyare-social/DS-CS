import { describe, expect, it } from "bun:test";

import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DEFAULT_WIDTHS,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_DESKTOP_WIDTH_CLASS,
  WORKSPACE_FEED,
  WORKSPACE_GUTTER,
  WORKSPACE_PANEL,
  WORKSPACE_SIDEBAR,
  clamp,
  fitWorkspaceWidths,
  workspaceBudget,
  workspaceShift,
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

describe("workspaceBudget", () => {
  it("takes the outer gutters off the viewport", () => {
    expect(workspaceBudget(1280)).toBe(1280 - WORKSPACE_GUTTER * 2);
  });

  it("never goes negative on narrow viewports", () => {
    expect(workspaceBudget(10)).toBe(0);
  });
});

describe("the desktop classes", () => {
  it("target the same breakpoint the shell measures", () => {
    expect(WORKSPACE_DESKTOP_CLASS).toBe(
      `min-[${WORKSPACE_BREAKPOINT}px]:flex`,
    );
    expect(WORKSPACE_DESKTOP_WIDTH_CLASS).toContain(
      `min-[${WORKSPACE_BREAKPOINT}px]:w-[var(--workspace-feed-width`,
    );
  });
});

describe("fitWorkspaceWidths", () => {
  it("keeps the defaults when they fit", () => {
    expect(
      fitWorkspaceWidths(WORKSPACE_DEFAULT_WIDTHS, 1440),
    ).toEqual(WORKSPACE_DEFAULT_WIDTHS);
  });

  it("bounds every column to its own range", () => {
    const fitted = fitWorkspaceWidths(
      { sidebar: 10, feed: 9999, panel: 1 },
      1920,
    );

    expect(fitted.sidebar).toBe(WORKSPACE_SIDEBAR.min);
    expect(fitted.feed).toBe(WORKSPACE_FEED.max);
    expect(fitted.panel).toBe(WORKSPACE_PANEL.min);
  });

  it("keeps the three columns inside the viewport", () => {
    for (let viewport = WORKSPACE_BREAKPOINT; viewport <= 2560; viewport += 16) {
      const fitted = fitWorkspaceWidths(
        {
          sidebar: WORKSPACE_SIDEBAR.max,
          feed: WORKSPACE_FEED.max,
          panel: WORKSPACE_PANEL.max,
        },
        viewport,
      );
      expect(fitted.sidebar + fitted.feed + fitted.panel).toBeLessThanOrEqual(
        workspaceBudget(viewport),
      );
    }
  });

  it("leaves the feed readable on the narrowest desktop", () => {
    const fitted = fitWorkspaceWidths(
      {
        sidebar: WORKSPACE_SIDEBAR.max,
        feed: WORKSPACE_FEED.max,
        panel: WORKSPACE_PANEL.max,
      },
      WORKSPACE_BREAKPOINT,
    );

    expect(fitted.feed).toBeGreaterThanOrEqual(WORKSPACE_FEED.min);
    expect(fitted.sidebar).toBeGreaterThanOrEqual(WORKSPACE_SIDEBAR.min);
    expect(fitted.panel).toBeGreaterThanOrEqual(WORKSPACE_PANEL.min);
  });

  it("gives the space to the column being dragged", () => {
    // The feed is dragged wider than the defaults: the panel gives way first,
    // the feed keeps the width it was dragged to.
    const fitted = fitWorkspaceWidths(
      { sidebar: 200, feed: 900, panel: 320 },
      1440,
      "feed",
    );

    expect(fitted.feed).toBe(900);
    expect(fitted.panel).toBe(308);
    expect(fitted.sidebar).toBe(200);
  });

  it("still keeps the columns inside the viewport at the breakpoint", () => {
    const fitted = fitWorkspaceWidths(
      { sidebar: 200, feed: 900, panel: 280 },
      WORKSPACE_BREAKPOINT,
      "feed",
    );

    expect(fitted.sidebar + fitted.feed + fitted.panel).toBeLessThanOrEqual(
      workspaceBudget(WORKSPACE_BREAKPOINT),
    );
    expect(fitted.feed).toBeGreaterThanOrEqual(WORKSPACE_FEED.min);
  });

  it("shrinks the feed last when nothing is being dragged", () => {
    const fitted = fitWorkspaceWidths(
      {
        sidebar: WORKSPACE_SIDEBAR.max,
        feed: WORKSPACE_FEED.max,
        panel: WORKSPACE_PANEL.max,
      },
      WORKSPACE_BREAKPOINT,
    );

    // The outer columns give up their slack first; the feed keeps the most.
    expect(fitted.sidebar).toBe(WORKSPACE_SIDEBAR.min);
    expect(fitted.panel).toBe(WORKSPACE_PANEL.min);
    expect(fitted.feed).toBeGreaterThan(WORKSPACE_FEED.min);
  });
});

describe("workspaceShift", () => {
  it("is half the difference between the outer columns", () => {
    expect(
      workspaceShift({ sidebar: 240, feed: 672, panel: 320 }),
    ).toBe(-40);
  });

  it("does not depend on the feed's width", () => {
    expect(
      workspaceShift({ sidebar: 240, feed: 480, panel: 320 }),
    ).toBe(workspaceShift({ sidebar: 240, feed: 960, panel: 320 }));
  });
});
