/**
 * MCP server config, in the shape each client actually reads.
 *
 * OpenCode uses `mcp` rather than `mcpServers` and requires an explicit
 * `type`, while Claude Code, Cursor, Codex and Windsurf use `mcpServers`. The
 * difference is not cosmetic — a config with the wrong root key is silently
 * ignored by the client, which looks exactly like a server that never connects.
 */
export const MCP_TARGETS = [
  { agent: "opencode", file: "opencode.json" },
  { agent: "claude-code", file: ".mcp.json" },
  { agent: "cursor", file: ".cursor/mcp.json" },
  { agent: "codex", file: ".codex/config.json" },
  { agent: "windsurf", file: ".windsurf/mcp.json" },
];

export function mcpEndpoint(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/api/mcp`;
}

export function buildMcpConfig(agent, url, apiKey) {
  const endpoint = mcpEndpoint(url);
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

  if (agent === "opencode") {
    return {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        "ds-cs": { type: "remote", url: endpoint, enabled: true, ...(headers ? { headers } : {}) },
      },
    };
  }

  return {
    mcpServers: {
      "ds-cs": { url: endpoint, ...(headers ? { headers } : {}) },
    },
  };
}
