import { describe, expect, it } from "bun:test";

import type { MastraDBMessage } from "@mastra/core/agent";

import { contentPolicyProcessor, sanitizeAgentText } from "../guardrails/content-policy";

function message(parts: MastraDBMessage["content"]["parts"]): MastraDBMessage {
  return {
    id: "m1",
    role: "assistant",
    createdAt: new Date(),
    content: { format: 2, parts },
  };
}

describe("sanitizeAgentText", () => {
  it("removes HTML tags and script bodies", () => {
    expect(sanitizeAgentText("<b>hi</b>")).toBe("hi");
    expect(sanitizeAgentText('a<script>alert("x")</script>b')).toBe("ab");
  });

  it("applies the channel NSFW map", () => {
    expect(sanitizeAgentText("what the fuck")).toBe("what the f*ck");
  });

  it("leaves clean text untouched", () => {
    const clean = "Ship on Tuesday. Reply with questions.";
    expect(sanitizeAgentText(clean)).toBe(clean);
  });

  it("keeps emoji", () => {
    expect(sanitizeAgentText("nice 🚀")).toBe("nice 🚀");
  });
});

describe("contentPolicyProcessor", () => {
  it("sanitizes text parts and leaves other parts alone", () => {
    const input = message([
      { type: "text", text: "<i>draft</i> with shit" },
      // A non-text part must survive untouched.
      { type: "step-start" },
    ]);

    const result = contentPolicyProcessor.processInput!({
      messages: [input],
    } as never) as MastraDBMessage[];

    expect(result[0]!.content.parts[0]).toEqual({
      type: "text",
      text: "draft with shit",
    });
    expect(result[0]!.content.parts[1]).toEqual({ type: "step-start" });
  });

  it("returns the same message object when nothing changes", () => {
    const input = message([{ type: "text", text: "clean text" }]);

    const result = contentPolicyProcessor.processOutputResult!({
      messages: [input],
    } as never) as MastraDBMessage[];

    expect(result[0]).toBe(input);
  });
});
