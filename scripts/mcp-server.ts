import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "@/mcp/server";

const canWrite = () => {
  const key = (process.env.MCP_API_KEY || process.env.API_KEY || "").trim();
  return key.length > 0;
};

async function main() {
  const server = createMcpServer({ canWrite });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `dastyare-mcp: stdio server ready (writes ${canWrite() ? "enabled" : "disabled"})`
  );
}

main().catch((err) => {
  console.error("dastyare-mcp: fatal error", err);
  process.exit(1);
});
