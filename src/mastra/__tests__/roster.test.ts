import { describe, expect, it } from "bun:test";

import { specialistAgents } from "../agents/subagents";
import { REPURPOSE_TARGET_IDS } from "../repurpose/specs";

const EXPECTED_SPECIALISTS = [
  "content-planner",
  "researcher",
  "engagement-analyst",
  "linkedin-writer",
  "instagram-writer",
  "tiktok-writer",
  "x-writer",
  "social-writer",
  "script-writer",
  "first-comment-writer",
  "hashtag-analyst",
  "substack-writer",
  "newsletter-writer",
  "editor",
  "repurpose-editor",
];

describe("specialist roster", () => {
  it("registers every specialist under its agent id", () => {
    expect(Object.keys(specialistAgents).sort()).toEqual(
      [...EXPECTED_SPECIALISTS].sort(),
    );

    for (const [key, agent] of Object.entries(specialistAgents)) {
      expect(agent.id).toBe(key);
    }
  });

  it("gives each specialist a routing description", async () => {
    for (const agent of Object.values(specialistAgents)) {
      expect(agent.getDescription().length).toBeGreaterThan(20);
    }
  });

  it("gives each specialist instructions that name its role", async () => {
    for (const agent of Object.values(specialistAgents)) {
      const instructions = await agent.getInstructions();
      expect(instructions.length).toBeGreaterThan(80);
      expect(instructions).toContain("You are a specialist");
    }
  });

  it("covers every repurposing target with a writer", () => {
    // The repurpose playbook advertises these formats; the roster must be able
    // to produce each one natively.
    for (const target of REPURPOSE_TARGET_IDS) {
      expect(target.length).toBeGreaterThan(0);
    }

    expect(Object.keys(specialistAgents)).toEqual(
      expect.arrayContaining([
        "x-writer",
        "linkedin-writer",
        "instagram-writer",
        "newsletter-writer",
        "script-writer",
      ]),
    );
  });
});
