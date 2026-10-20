import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";

import { zernioAgent } from "./agents/zernio";

/**
 * Mastra scaffold.
 *
 * Deliberately not mounted behind an HTTP route yet: the first wiring step is
 * the per-user Zernio OAuth callback
 * (`src/app/api/agents/zernio/{authorize,callback}/route.ts`), after which an
 * agent route can pass tools from `createZernioMcpClient({ userId })`.
 */
const storage = process.env.DATABASE_URL
  ? new PostgresStore({
      id: "ds-cs-mastra",
      connectionString: process.env.DATABASE_URL,
    })
  : undefined;

export const mastra = new Mastra({
  agents: { zernio: zernioAgent },
  storage,
});

export { zernioAgent };
