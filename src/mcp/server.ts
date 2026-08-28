import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { instrument } from "@posthog/mcp";
import { getServerPostHogClient } from "@/lib/analytics/server";
import { registerPostTools } from "./tools/posts";
import { registerStoryTools } from "./tools/stories";
import { registerResumeTools } from "./tools/resume";

export interface McpServerOptions {
  canWrite?: () => boolean;
}

export function createMcpServer(options: McpServerOptions = {}): McpServer {
  const canWrite = options.canWrite ?? (() => false);

  const server = new McpServer({
    name: "ds-cs",
    version: "1.0.0",
  });

  registerPostTools(server, { canWrite });
  registerStoryTools(server, { canWrite });
  registerResumeTools(server, { canWrite });

  // Wrap the server with @posthog/mcp so every MCP request emits native
  // $mcp_* analytics events ($mcp_initialize, $mcp_tool_call, $mcp_tools_list,
  // $exception, ...). Reuses the same PostHog client as captureServerEvent so
  // there's a single queued batch flushed per request by the route.
  const posthog = getServerPostHogClient();
  if (posthog) {
    instrument(server, posthog);
  }

  return server;
}
