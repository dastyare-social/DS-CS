import { Mastra } from "@mastra/core/mastra";

import { zernioAgent } from "./agents/zernio";
import { specialistAgents } from "./agents/subagents";
import { mastraStorage } from "./storage";

/**
 * Mastra scaffold.
 *
 * Deliberately not mounted behind an HTTP route yet: the first wiring step is
 * the per-user Zernio OAuth callback
 * (`src/app/api/agents/zernio/{authorize,callback}/route.ts`), after which an
 * agent route can pass tools from `createZernioMcpClient({ userId })` and the
 * memory context from `zernioMemoryContext(userId, threadId)`.
 *
 * The Zernio orchestrator ships with the research, channel-data, repurposing
 * and retrieval tools, guardrail processors, Postgres-backed memory, and a
 * roster of specialist subagents (planner, researcher, writers per platform,
 * script, hashtags, first comment, long form, editor).
 */
const storage = mastraStorage();

export const mastra = new Mastra({
  agents: { zernio: zernioAgent, ...specialistAgents },
  storage,
});

export { zernioAgent, specialistAgents };
