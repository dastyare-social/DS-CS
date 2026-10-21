import { describe, expect, it } from "bun:test";

import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_FEED,
  WORKSPACE_FEED_WIDTH_CLASS,
  WORKSPACE_LEFT,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_RIGHT,
  WORKSPACE_WIDTHS_COOKIE,
  WORKSPACE_WIDTH_SCRIPT,
  layoutFromWidths,
  widthsFromLayout,
} from "../workspace-layout";

describe("the desktop classes", () => {
  it("target the same breakpoint the shell measures", () => {
    expect(WORKSPACE_DESKTOP_CLASS).toBe(
      `min-[${WORKSPACE_BREAKPOINT}px]:flex`,
    );
  });

  it("gives fixed chrome the feed's width, capped at the screen", () => {
    expect(WORKSPACE_FEED_WIDTH_CLASS).toBe(
      "w-[min(var(--workspace-feed-width,672px),100vw)]",
    );
  });
});

describe("the saved widths", () => {
  it("live in a cookie the server can read", () => {
    expect(WORKSPACE_WIDTHS_COOKIE).toBe("ds.workspace.widths");
  });

  it("are published before the first paint", () => {
    expect(WORKSPACE_WIDTH_SCRIPT).toContain("--workspace-feed-width");
    expect(WORKSPACE_WIDTH_SCRIPT).toContain("flexGrow");
  });
});

describe("layoutFromWidths", () => {
  it("turns pixel widths into the library's ratios", () => {
    // 300 + 700 leaves 400 for the right column, so the ratios are of the
    // whole window, not of the two saved columns.
    const layout = layoutFromWidths({ left: 300, feed: 700 }, 1400);

    expect(layout[WORKSPACE_PANEL_IDS.left]).toBe(214);
    expect(layout[WORKSPACE_PANEL_IDS.feed]).toBe(500);
    expect(layout[WORKSPACE_PANEL_IDS.right]).toBe(286);
  });

  it("falls back to equal columns when there is nothing saved", () => {
    const layout = layoutFromWidths({ left: 0, feed: 0 }, 1440);

    expect(layout[WORKSPACE_PANEL_IDS.left]).toBe(1);
    expect(layout[WORKSPACE_PANEL_IDS.feed]).toBe(1);
    expect(layout[WORKSPACE_PANEL_IDS.right]).toBe(1);
  });
});

describe("widthsFromLayout", () => {
  it("turns the library's ratios back into pixel widths", () => {
    const widths = widthsFromLayout(
      {
        [WORKSPACE_PANEL_IDS.left]: 300,
        [WORKSPACE_PANEL_IDS.feed]: 700,
        [WORKSPACE_PANEL_IDS.right]: 400,
      },
      1400,
    );

    expect(widths.left).toBe(300);
    expect(widths.feed).toBe(700);
    expect(widths.right).toBe(400);
  });

  it("falls back to the defaults for an empty layout", () => {
    const widths = widthsFromLayout({}, 1440);

    expect(widths.left).toBe(WORKSPACE_LEFT.default);
    expect(widths.feed).toBe(WORKSPACE_FEED.default);
    expect(widths.right).toBe(WORKSPACE_RIGHT.default);
  });
});

describe("a layout round trip", () => {
  it("keeps the widths it was given", () => {
    const saved = { left: 260, feed: 820 };
    const widths = widthsFromLayout(layoutFromWidths(saved, 1440), 1440);

    expect(widths.left).toBeCloseTo(saved.left, -1);
    expect(widths.feed).toBeCloseTo(saved.feed, -1);
  });
});
