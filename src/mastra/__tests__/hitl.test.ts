import { describe, expect, it } from "bun:test";

import { hitlTools, requiresHumanApproval } from "../hitl";
import { requestApprovalTool } from "../hitl/approval";

type ApprovalInput = {
  action: string;
  summary: string;
  risk: "low" | "medium" | "high";
  irreversible: boolean;
  details?: string[];
};

type ApprovalOutput = {
  approved: boolean;
  decision: "approve" | "reject" | "pending";
  action: string;
  note: string | null;
};

const executeApproval = requestApprovalTool.execute as unknown as (
  input: ApprovalInput,
  context: unknown,
) => Promise<ApprovalOutput>;

const input: ApprovalInput = {
  action: "delete post 42",
  summary: "Removes the post from the channel and Zernio.",
  risk: "high",
  irreversible: true,
};

describe("requiresHumanApproval", () => {
  it("lets annotated read-only tools run", () => {
    expect(
      requiresHumanApproval({
        toolName: "list_posts",
        annotations: { readOnlyHint: true },
      }),
    ).toBe(false);
  });

  it("gates annotated destructive tools", () => {
    expect(
      requiresHumanApproval({
        toolName: "delete_post",
        annotations: { destructiveHint: true },
      }),
    ).toBe(true);
  });

  it("gates a write even when it claims to be read-only", () => {
    expect(
      requiresHumanApproval({
        toolName: "publish_post",
        annotations: { readOnlyHint: true },
      }),
    ).toBe(true);
  });

  it("gates scheduling, messaging and spend", () => {
    for (const toolName of [
      "schedule_post",
      "send_message",
      "ads_update_campaign",
      "boost_post",
      "delete_comment",
    ]) {
      expect(requiresHumanApproval({ toolName })).toBe(true);
    }
  });

  it("allows read-shaped tools without annotations", () => {
    for (const toolName of [
      "get_post",
      "list_accounts",
      "search_posts",
      "analytics_overview",
      "zernio_list_profiles",
    ]) {
      expect(requiresHumanApproval({ toolName })).toBe(false);
    }
  });

  it("fails closed for an unknown unannotated tool", () => {
    expect(requiresHumanApproval({ toolName: "zernio_do_the_thing" })).toBe(
      true,
    );
  });
});

describe("request_approval", () => {
  it("is attached alongside ask_user", () => {
    expect(Object.keys(hitlTools).sort()).toEqual([
      "ask_user",
      "request_approval",
    ]);
  });

  it("fails closed when no approval host is attached", async () => {
    const result = await executeApproval(input, {});

    expect(result.approved).toBe(false);
    expect(result.decision).toBe("pending");
    expect(result.note).toContain("Nothing was approved");
  });

  it("suspends with the action, risk and reversibility", async () => {
    let payload: Record<string, unknown> | undefined;

    const result = await executeApproval(input, {
      agent: {
        suspend: async (value: Record<string, unknown>) => {
          payload = value;
        },
      },
    });

    expect(result.decision).toBe("pending");
    expect(payload?.action).toBe("delete post 42");
    expect(payload?.risk).toBe("high");
    expect(payload?.irreversible).toBe(true);
    expect(String(payload?.question)).toContain("delete post 42");
  });

  it("returns an approval when the host resumes", async () => {
    const result = await executeApproval(input, {
      agent: { resumeData: { decision: "approve", note: "Go ahead." } },
    });

    expect(result.approved).toBe(true);
    expect(result.decision).toBe("approve");
    expect(result.note).toBe("Go ahead.");
  });

  it("returns a rejection when the host resumes", async () => {
    const result = await executeApproval(input, {
      agent: { resumeData: { decision: "reject" } },
    });

    expect(result.approved).toBe(false);
    expect(result.decision).toBe("reject");
  });
});
