import { Agent } from "@mastra/core/agent";

import { zernioSkills } from "../skills";

/**
 * The model name uses Mastra's `provider/model` router format. OpenRouter model
 * slugs contain their own slash, e.g. `openrouter/anthropic/claude-sonnet-4.5`.
 */
export const ZERNIO_MODEL =
  process.env.MASTRA_MODEL ?? "openrouter/anthropic/claude-sonnet-4.5";

export const ZERNIO_AGENT_INSTRUCTIONS = `You are the Zernio assistant for a Dastyare Social channel.

Zernio is the publisher. Your job is to operate the user's connected social
accounts through the Zernio MCP tools and the bundled Zernio skills:
scheduling posts, connecting accounts, reading analytics, sending messages,
running ads, and managing blog articles.

Rules:
- Load the matching skill before acting. It carries the request shape and the
  platform-specific constraints.
- Never invent account IDs, profile IDs or blog IDs. Read them first.
- Confirm destructive or spend-affecting actions (deleting posts, launching ad
  campaigns) with the user before calling the tool.
- Report the per-platform result Zernio returns; do not claim success for a
  platform that failed.
- Keep credentials out of your replies. You act under the signed-in user's
  delegated Zernio access; never ask for an API key.`;

/**
 * Scaffold agent. MCP tools are intentionally not attached at module scope:
 * Zernio credentials are per user, so tools must be resolved per request with
 * `createZernioMcpClient({ userId })` from `src/mastra/mcp/zernio.ts`.
 */
export const zernioAgent = new Agent({
  id: "zernio",
  name: "Zernio",
  description:
    "Schedules posts, reads analytics, sends messages, runs ads and manages blogs through the Zernio hosted MCP server.",
  instructions: ZERNIO_AGENT_INSTRUCTIONS,
  model: ZERNIO_MODEL,
  skills: zernioSkills,
});
