import { describe, expect, it } from "bun:test";

import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_DESKTOP_LEFT_CLASS,
  WORKSPACE_DESKTOP_WIDTH_CLASS,
  WORKSPACE_FEED,
  WORKSPACE_FEED_COOKIE,
  WORKSPACE_FEED_WIDTH_CLASS,
  WORKSPACE_LEFT,
  WORKSPACE_LEFT_COOKIE,
  WORKSPACE_RIGHT,
  WORKSPACE_WIDTH_SCRIPT,
  clamp,
  dragLeftBoundary,
  dragRightBoundary,
  fitWorkspaceWidths,
  rightWidth,
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

describe("the desktop classes", () => {
  it("target the same breakpoint the shell measures", () => {
    expect(WORKSPACE_DESKTOP_CLASS).toBe(
      `min-[${WORKSPACE_BREAKPOINT}px]:flex`,
    );
    expect(WORKSPACE_DESKTOP_WIDTH_CLASS).toContain(
      `min-[${WORKSPACE_BREAKPOINT}px]:w-[var(--workspace-feed-width`,
    );
    expect(WORKSPACE_DESKTOP_LEFT_CLASS).toContain(
      `min-[${WORKSPACE_BREAKPOINT}px]:w-[var(--workspace-left-width`,
    );
  });

  it("gives fixed chrome the feed's width, capped at the screen", () => {
    expect(WORKSPACE_FEED_WIDTH_CLASS).toBe(
      "w-[min(var(--workspace-feed-width,672px),100vw)]",
    );
  });
});

describe("the saved widths", () => {
  it("live in cookies the server can read", () => {
    expect(WORKSPACE_LEFT_COOKIE).toBe("ds.workspace.left-width");
    expect(WORKSPACE_FEED_COOKIE).toBe("ds.workspace.feed-width");
  });

  it("are published before the first paint", () => {
    expect(WORKSPACE_WIDTH_SCRIPT).toContain("--workspace-feed-width");
    expect(WORKSPACE_WIDTH_SCRIPT).toContain("--workspace-left-width");
  });
});

describe("rightWidth", () => {
  it("is whatever is left of the window", () => {
    expect(rightWidth({ left: 300, feed: 700 }, 1440)).toBe(440);
  });
});

describe("fitWorkspaceWidths", () => {
  it("keeps widths that fit", () => {
    expect(fitWorkspaceWidths({ left: 240, feed: 672 }, 1440)).toEqual({
      left: 240,
      feed: 672,
    });
  });

  it("bounds both columns to their own range", () => {
    const fitted = fitWorkspaceWidths({ left: 10, feed: 9999 }, 1920);

    expect(fitted.left).toBe(WORKSPACE_LEFT.min);
    expect(fitted.feed).toBe(WORKSPACE_FEED.max);
  });

  it("never squeezes the right column out of existence", () => {
    for (let viewport = WORKSPACE_BREAKPOINT; viewport <= 2560; viewport += 16) {
      const fitted = fitWorkspaceWidths(
        { left: WORKSPACE_LEFT.max, feed: WORKSPACE_FEED.max },
        viewport,
      );

      expect(fitted.feed).toBeGreaterThanOrEqual(WORKSPACE_FEED.min);
      expect(rightWidth(fitted, viewport)).toBeGreaterThanOrEqual(
        WORKSPACE_RIGHT.min,
      );
    }
  });
});

describe("dragLeftBoundary", () => {
  it("moves the boundary with the pointer", () => {
    const next = dragLeftBoundary({ left: 300, feed: 700 }, 50);

    expect(next.left).toBe(350);
    expect(next.feed).toBe(650);
  });

  it("leaves the feed's other edge where it was", () => {
    const before = { left: 300, feed: 700 };
    const after = dragLeftBoundary(before, 50);

    // The feed's right edge is left + feed, and it must not move.
    expect(after.left + after.feed).toBe(before.left + before.feed);
  });

  it("grows the feed when its left edge is dragged left", () => {
    const before = { left: 300, feed: 700 };
    const after = dragLeftBoundary(before, -100);

    expect(after.feed).toBe(800);
    expect(after.left).toBe(200);
    expect(after.left + after.feed).toBe(before.left + before.feed);
  });

  it("stops at the columns' limits", () => {
    const grown = dragLeftBoundary({ left: 300, feed: 700 }, -10_000);
    expect(grown.left).toBe(WORKSPACE_LEFT.min);
    expect(grown.feed).toBeLessThanOrEqual(WORKSPACE_FEED.max);
  });
});

describe("dragRightBoundary", () => {
  it("moves the boundary with the pointer", () => {
    const before = { left: 300, feed: 700 };
    const after = dragRightBoundary(before, 50, 1440);

    expect(after.feed).toBe(750);
    expect(after.left).toBe(300);
    expect(rightWidth(after, 1440)).toBe(390);
  });

  it("leaves the feed's other edge where it was", () => {
    const before = { left: 300, feed: 700 };
    const after = dragRightBoundary(before, 50, 1440);

    expect(after.left).toBe(before.left);
  });

  it("grows the feed when its right edge is dragged right", () => {
    const before = { left: 300, feed: 700 };
    const after = dragRightBoundary(before, 100, 1440);

    expect(after.feed).toBe(800);
    expect(after.left).toBe(300);
  });

  it("gives the width back when the right column is at its minimum", () => {
    const viewport = 1024;
    const before = { left: 200, feed: 480 };
    const after = dragRightBoundary(before, 500, viewport);

    expect(rightWidth(after, viewport)).toBeGreaterThanOrEqual(
      WORKSPACE_RIGHT.min,
    );
  });
});
