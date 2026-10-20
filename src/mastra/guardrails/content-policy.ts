import type { MastraDBMessage } from "@mastra/core/agent";
import type {
  ProcessInputArgs,
  ProcessOutputResultArgs,
  Processor,
} from "@mastra/core/processors";

import { filterString } from "@/lib/filters";

/**
 * Applies the channel's own content rules (NSFW word list + HTML
 * sanitization) to agent input and output.
 *
 * This is deliberately the same code path as publishing: a draft the agent
 * proposes should be filtered exactly like a post the composer submits, or the
 * two would disagree about what the channel allows.
 */
export function sanitizeAgentText(text: string): string {
  return filterString(text, {
    removeEmojis: false,
    filterNsfw: true,
    sanitizeHtml: true,
  });
}

function sanitizeMessage(message: MastraDBMessage): MastraDBMessage {
  const parts = message.content?.parts;
  if (!Array.isArray(parts)) return message;

  let changed = false;
  const nextParts = parts.map((part) => {
    if (part.type !== "text" || typeof part.text !== "string") return part;

    const text = sanitizeAgentText(part.text);
    if (text === part.text) return part;

    changed = true;
    return { ...part, text };
  });

  if (!changed) return message;

  return {
    ...message,
    content: { ...message.content, parts: nextParts },
  };
}

export const contentPolicyProcessor = {
  id: "ds-content-policy",
  name: "Channel content policy",
  description:
    "Runs agent input and output through the same NSFW and HTML sanitization used when publishing.",
  processInput: ({ messages }: ProcessInputArgs) =>
    messages.map(sanitizeMessage),
  processOutputResult: ({ messages }: ProcessOutputResultArgs) =>
    messages.map(sanitizeMessage),
} satisfies Processor<"ds-content-policy">;
