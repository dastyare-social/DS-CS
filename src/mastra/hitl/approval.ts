import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Human approval for consequential actions.
 *
 * `ask_user` is for clarification. This is for permission: it names the exact
 * action, what it affects and whether it can be undone, then suspends until a
 * human answers. Without a host attached it fails closed — the model is told
 * that nothing was approved rather than being allowed to continue.
 */

const approvalInputSchema = z.object({
  action: z
    .string()
    .min(1)
    .describe(
      "The exact operation, e.g. \"delete post 42\" or \"launch the Retargeting campaign with a $50 daily budget\".",
    ),
  summary: z
    .string()
    .min(1)
    .describe(
      "What will happen if approved, including the account or platform it affects.",
    ),
  risk: z
    .enum(["low", "medium", "high"])
    .describe("How much damage a mistake here could do."),
  irreversible: z
    .boolean()
    .optional()
    .default(false)
    .describe("True when the action cannot be undone."),
  details: z
    .array(z.string())
    .optional()
    .describe("Facts the approver needs: target, budget, audience, count."),
});

const approvalResumeSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

const approvalSuspendSchema = approvalInputSchema.extend({
  question: z.string(),
});

const approvalOutputSchema = z.object({
  approved: z.boolean(),
  decision: z.enum(["approve", "reject", "pending"]),
  action: z.string(),
  note: z.string().nullable(),
});

export type ApprovalDecision = z.infer<typeof approvalResumeSchema>;

export const requestApprovalTool = createTool({
  id: "request_approval",
  description:
    "Ask a human to approve one consequential action before you take it: publish, schedule, delete, send a message, change ad budget or launch a campaign. Use it for actions the tool itself does not already gate, or to confirm a batch before the first call. Include the exact action, what it affects and whether it is reversible. Returns approved: false when no approval host is attached, so never treat silence as consent.",
  inputSchema: approvalInputSchema,
  suspendSchema: approvalSuspendSchema,
  resumeSchema: approvalResumeSchema,
  outputSchema: approvalOutputSchema,
  execute: async (
    input,
    context,
  ): Promise<z.infer<typeof approvalOutputSchema>> => {
    const resumeData = context?.agent?.resumeData ?? context?.resumeData;

    if (resumeData !== undefined) {
      const decision = approvalResumeSchema.parse(resumeData);
      return {
        approved: decision.decision === "approve",
        decision: decision.decision,
        action: input.action,
        note: decision.note ?? null,
      };
    }

    const suspend = context?.agent?.suspend ?? context?.suspend;
    if (!suspend) {
      return {
        approved: false,
        decision: "pending",
        action: input.action,
        note:
          "No approval host is attached. Nothing was approved and nothing should be executed.",
      };
    }

    await suspend({
      question: `Approve this action?\n\n${input.action}\n\n${input.summary}`,
      ...input,
    });

    return {
      approved: false,
      decision: "pending",
      action: input.action,
      note: null,
    };
  },
});

export const approvalTools = {
  request_approval: requestApprovalTool,
};
