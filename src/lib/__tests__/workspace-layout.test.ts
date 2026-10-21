import { describe, expect, it } from "bun:test";

import {
  WORKSPACE_BAND_MIN,
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_DESKTOP_WIDTH_CLASS,
  WORKSPACE_FEED,
  WORKSPACE_FEED_WIDTH_CLASS,
  clamp,
  feedWidthLimit,
  fitFeedWidth,
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
  });

  it("gives fixed chrome the feed's width, capped at the screen", () => {
    expect(WORKSPACE_FEED_WIDTH_CLASS).toBe(
      "w-[min(var(--workspace-feed-width,672px),100vw)]",
    );
  });
});

describe("feedWidthLimit", () => {
  it("is the feed's own maximum on a wide screen", () => {
    expect(feedWidthLimit(1920)).toBe(WORKSPACE_FEED.max);
  });

  it("leaves both side columns room on a narrow one", () => {
    expect(feedWidthLimit(WORKSPACE_BREAKPOINT)).toBe(
      WORKSPACE_BREAKPOINT - WORKSPACE_BAND_MIN * 2,
    );
  });
});

describe("fitFeedWidth", () => {
  it("keeps the default on a wide screen", () => {
    expect(fitFeedWidth(WORKSPACE_FEED.default, 1440)).toBe(
      WORKSPACE_FEED.default,
    );
  });

  it("never goes below the feed's minimum", () => {
    expect(fitFeedWidth(10, 1440)).toBe(WORKSPACE_FEED.min);
  });

  it("never takes the side columns out of existence", () => {
    for (let viewport = WORKSPACE_BREAKPOINT; viewport <= 2560; viewport += 16) {
      const width = fitFeedWidth(WORKSPACE_FEED.max, viewport);

      expect(width).toBeGreaterThanOrEqual(WORKSPACE_FEED.min);
      expect(width).toBeLessThanOrEqual(feedWidthLimit(viewport));
      expect(viewport - width).toBeGreaterThanOrEqual(
        WORKSPACE_BAND_MIN * 2,
      );
    }
  });
});
