import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

  return server;
}
