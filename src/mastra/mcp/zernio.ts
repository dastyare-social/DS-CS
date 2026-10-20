import { MCPClient } from "@mastra/mcp";

import { requiresHumanApproval } from "../hitl/policy";
import {
  ZERNIO_ALLOWED_HOSTS,
  ZERNIO_MCP_SERVER_NAME,
  ZERNIO_MCP_URL,
  createZernioAuthProvider,
} from "../oauth/zernio-provider";

interface CreateZernioMcpClientOptions {
  userId: string;
  onRedirectToAuthorization?: (url: URL) => void | Promise<void>;
}

/**
 * Zernio is a hosted, OAuth-protected MCP server. Credentials are per user, so
 * the client is created per request rather than at module scope — a shared
 * module-level client would leak one user's tokens into another's session.
 *
 * Usage:
 *
 *   const { client } = createZernioMcpClient({ userId });
 *   const tools = await client.listTools();
 *   // ... use the tools with an Agent ...
 *   await client.disconnect();
 */
export function createZernioMcpClient({
  userId,
  onRedirectToAuthorization,
}: CreateZernioMcpClientOptions) {
  const authProvider = createZernioAuthProvider({
    userId,
    onRedirectToAuthorization,
  });

  const client = new MCPClient({
    id: `zernio-${userId}`,
    servers: {
      [ZERNIO_MCP_SERVER_NAME]: {
        url: new URL(ZERNIO_MCP_URL),
        authProvider,
        allowedHosts: ZERNIO_ALLOWED_HOSTS,
        // Publishing, deleting, scheduling, messaging and ad spend pause for a
        // human. Read-only tools run freely. The host approves with
        // `agent.approveToolCall({ runId })` or declines with
        // `agent.declineToolCall({ runId })`.
        requireToolApproval: requiresHumanApproval,
        // Server instructions are model-visible system guidance. Keep the
        // opt-in off until the Zernio instructions have been reviewed.
        forwardInstructions: false,
      },
    },
  });

  return { client, authProvider };
}
