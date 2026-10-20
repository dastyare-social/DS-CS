import { describe, expect, it } from "bun:test";

import { checkCopy } from "../tools/quality";

describe("checkCopy", () => {
  it("scores an empty draft as a rewrite", () => {
    const result = checkCopy({ kind: "post", text: "   " });

    expect(result.score).toBe(0);
    expect(result.verdict).toBe("rewrite");
    expect(result.issues[0]?.code).toBe("empty");
  });

  it("passes clean, specific copy with a full score", () => {
    const result = checkCopy({
      kind: "post",
      platform: "linkedin",
      text: "Shipped the new onboarding flow today. Activation went from 41% to 58% in two weeks. The fix was one screen: we removed a form field nobody used and moved the workspace name to the end.\n\nWhat is the smallest change that moved a number for you?",
    });

    expect(result.score).toBe(100);
    expect(result.verdict).toBe("ship");
    expect(result.issues).toEqual([]);
  });

  it("blocks a post over the platform limit", () => {
    const result = checkCopy({
      kind: "post",
      platform: "x",
      text: "a".repeat(281),
    });

    expect(result.verdict).toBe("revise");
    expect(result.metrics.limit).toBe(280);
    expect(result.issues.some((issue) => issue.code === "over-limit")).toBe(true);
  });

  it("blocks an oversized thread part", () => {
    const result = checkCopy({
      kind: "thread",
      text: `${"a".repeat(281)}\n\nSecond part.`,
    });

    expect(
      result.issues.some((issue) => issue.code === "thread-part-over-limit"),
    ).toBe(true);
  });

  it("flags AI slop, bait and stock openings", () => {
    const result = checkCopy({
      kind: "post",
      platform: "linkedin",
      text: "Excited to announce our seamless new platform. In today's fast-paced world, comment YES to unlock the game-changer.",
    });

    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("formulaic-opening");
    expect(codes).toContain("ai-slop");
    expect(codes).toContain("engagement-bait");
  });

  it("finds duplicate and generic hashtags", () => {
    const result = checkCopy({
      kind: "hashtags",
      text: "#AI #ai #buildinpublic #love",
    });

    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("duplicate-hashtags");
    expect(codes).toContain("generic-hashtags");
  });

  it("warns when a platform has too many tags", () => {
    const result = checkCopy({
      kind: "caption",
      platform: "instagram",
      text: "A caption. #one #two #three #four #five #six #seven #eight #nine #ten #eleven",
    });

    expect(
      result.issues.some((issue) => issue.code === "platform-hashtag-count"),
    ).toBe(true);
  });

  it("warns about a link in an Instagram caption", () => {
    const result = checkCopy({
      kind: "caption",
      platform: "instagram",
      text: "Read the full story: https://example.com/post",
    });

    expect(result.issues.some((issue) => issue.code === "instagram-link")).toBe(
      true,
    );
  });

  it("enforces the email subject length", () => {
    const result = checkCopy({
      kind: "email",
      text: "Hello there. This is the issue.",
      subject: "a".repeat(100),
    });

    const subjectIssue = result.issues.find(
      (issue) => issue.code === "long-subject",
    );
    expect(subjectIssue?.severity).toBe("error");
  });

  it("flags self-promotion in a Reddit post and checks the title", () => {
    const result = checkCopy({
      kind: "reddit",
      platform: "reddit",
      subject: "A".repeat(301),
      text: "Check out my course. It is free this week.",
    });

    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("reddit-self-promo");
    expect(codes).toContain("long-title");
  });

  it("includes script analysis for scripts", () => {
    const result = checkCopy({
      kind: "script",
      text: "Hey guys, welcome back to the channel. Today we test the new flow. Subscribe for the full breakdown.",
    });

    expect(
      result.issues.some((issue) => issue.code.startsWith("script-")),
    ).toBe(true);
  });

  it("flags repeated sentences", () => {
    const result = checkCopy({
      kind: "post",
      text: "This is a repeated sentence for the test. This is a repeated sentence for the test.",
    });

    expect(
      result.issues.some((issue) => issue.code === "repeated-sentences"),
    ).toBe(true);
  });
});
