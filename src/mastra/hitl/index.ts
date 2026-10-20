import { askUserTool } from "@mastra/core/tools";

import { approvalTools } from "./approval";

/**
 * Human-in-the-loop tools attached to the orchestrator.
 *
 * - `ask_user` clarifies a missing or ambiguous input. It suspends the run and
 *   resumes with the answer (`agent.resumeStream(answer)`).
 * - `request_approval` gates a consequential action. It suspends with the
 *   action, risk and reversibility, and resumes with
 *   `{ decision: "approve" | "reject", note? }`.
 *
 * Specialists do not get these: they cannot reach the user directly. They
 * report what is missing to the orchestrator, which decides whether to ask.
 */
export const hitlTools = {
  ask_user: askUserTool,
  ...approvalTools,
};

export {
  APPROVAL_POLICY_SUMMARY,
  requiresHumanApproval,
} from "./policy";
export type { ApprovalDecision } from "./approval";
