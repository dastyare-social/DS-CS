import { describe, expect, it } from "bun:test";

import {
  REPURPOSE_INSTRUCTIONS,
  REPURPOSE_TARGETS,
  buildRepurposeBrief,
  resolveRepurposeTargets,
} from "../repurpose/specs";

describe("resolveRepurposeTargets", () => {
  it("returns every target when none is requested", () => {
    expect(resolveRepurposeTargets()).toHaveLength(REPURPOSE_TARGETS.length);
    expect(resolveRepurposeTargets([])).toHaveLength(
      REPURPOSE_TARGETS.length,
    );
  });

  it("preserves the requested order", () => {
    const targets = resolveRepurposeTargets([
      "linkedin-post",
      "x-post",
    ]).map((target) => target.id);

    expect(targets).toEqual(["linkedin-post", "x-post"]);
  });

  it("ignores unknown ids and duplicates", () => {
    const targets = resolveRepurposeTargets([
      "x-post",
      "x-post",
      "carrier-pigeon",
    ]).map((target) => target.id);

    expect(targets).toEqual(["x-post"]);
  });

  it("returns an empty list when every id is unknown", () => {
    expect(resolveRepurposeTargets(["nope"])).toEqual([]);
  });
});

describe("buildRepurposeBrief", () => {
  const source = {
    id: "post_1",
    type: "text",
    content: "A source post",
    media: [],
  };

  it("carries the source, the selected targets and the shared rules", () => {
    const brief = buildRepurposeBrief(source, ["x-post"]);

    expect(brief.source).toEqual(source);
    expect(brief.targets.map((target) => target.id)).toEqual(["x-post"]);
    expect(brief.instructions).toEqual(REPURPOSE_INSTRUCTIONS);
  });

  it("gives every target a limit and at least one rule", () => {
    for (const target of REPURPOSE_TARGETS) {
      expect(target.maxChars).toBeGreaterThan(0);
      expect(target.guidance.length).toBeGreaterThan(0);
    }
  });

  it("keeps thread parts shorter than the whole thread", () => {
    const thread = REPURPOSE_TARGETS.find(
      (target) => target.id === "x-thread",
    );

    expect(thread?.partChars).toBe(280);
    expect(thread!.partChars!).toBeLessThan(thread!.maxChars);
  });

  it("does not let X exceed the platform limit", () => {
    const xPost = REPURPOSE_TARGETS.find((target) => target.id === "x-post");
    expect(xPost?.maxChars).toBe(280);
  });

  it("gives Reddit a title ceiling and a body ceiling", () => {
    const reddit = REPURPOSE_TARGETS.find(
      (target) => target.id === "reddit-post",
    );

    expect(reddit?.titleChars).toBe(300);
    expect(reddit?.maxChars).toBe(40_000);
  });
});
