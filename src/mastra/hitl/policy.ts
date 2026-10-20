import type { RequireToolApprovalContext } from "@mastra/mcp";

/**
 * Approval policy for the Zernio MCP server.
 *
 * Publishing, deleting, scheduling, messaging and ad spend are all
 * consequential: a model should not be able to do them on its own. Read-only
 * tools still run freely, so inspection and planning do not turn into an
 * approval queue.
 *
 * The policy is deliberately conservative when annotations are missing: the MCP
 * spec treats an unannotated tool as potentially destructive, and guessing the
 * other way is how an agent deletes a post by accident.
 */

const WRITE_ACTION_RE =
  /(^|_)(create|update|delete|remove|publish|schedule|unschedule|send|launch|pause|resume|boost|archive|cancel|upload|set|add|edit|move|duplicate|reply|comment|invite|revoke|connect|disconnect|sync|import|export)(_|$)/i;

const SPEND_RE =
  /(^|_)(ads?|adset|campaign|budget|boost|spend|billing|payment|invoice|plan|subscription)(_|$)/i;

const READ_HINT_RE =
  /(^|_)(get|list|search|read|fetch|describe|count|preview|inspect|retrieve|show|view|find|query|report|reports|stats|statistics|metrics|analytics|status|history|overview|me|whoami)(_|$)/i;

export function requiresHumanApproval({
  toolName,
  annotations,
}: Pick<RequireToolApprovalContext, "toolName" | "annotations">): boolean {
  // A tool that says it is destructive is always gated, even if it also claims
  // to be read-only. Conflicting annotations are not a reason to trust them.
  if (annotations?.destructiveHint) return true;

  // Name-based write detection comes next: annotations are hints, and a
  // `delete_post` tool is a write regardless of what it advertises.
  if (WRITE_ACTION_RE.test(toolName)) return true;

  if (annotations?.readOnlyHint) return false;

  // Without annotations, only an explicit read-ish name is allowed through.
  if (READ_HINT_RE.test(toolName)) return false;

  // Spend-related tools are gated even when the name does not contain a verb.
  if (SPEND_RE.test(toolName)) return true;

  // Unknown tool: ask. This is the fail-closed default.
  return true;
}

/**
 * The approval policy expressed as a sentence, for docs and error messages.
 */
export const APPROVAL_POLICY_SUMMARY =
  "Read-only Zernio tools run freely. Publishing, scheduling, deleting, messaging, ad spend and any unannotated tool require explicit user approval.";
