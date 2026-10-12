import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMcpConfig, MCP_TARGETS, mcpEndpoint } from "../src/mcp-config.mjs";

test("OpenCode config uses the mcp root key and an explicit type", () => {
  const config = buildMcpConfig("opencode", "https://cs.example.com", null);
  // A config with the wrong root key is silently ignored by the client, which
  // looks identical to a server that never connects.
  assert.ok(config.mcp, "opencode reads `mcp`, not `mcpServers`");
  assert.equal(config.mcp["ds-cs"].type, "remote");
  assert.equal(config.mcp["ds-cs"].url, "https://cs.example.com/api/mcp");
  assert.equal(config.mcp["ds-cs"].headers, undefined);
});

test("other clients use the mcpServers root key", () => {
  for (const agent of ["claude-code", "cursor", "codex", "windsurf"]) {
    const config = buildMcpConfig(agent, "https://cs.example.com", null);
    assert.equal(config.mcpServers["ds-cs"].url, "https://cs.example.com/api/mcp", agent);
    assert.equal(config.mcp, undefined, agent);
  }
});

test("an API key becomes an Authorization header on both formats", () => {
  const opencode = buildMcpConfig("opencode", "https://x.test", "KEY");
  assert.equal(opencode.mcp["ds-cs"].headers.Authorization, "Bearer KEY");

  const cursor = buildMcpConfig("cursor", "https://x.test", "KEY");
  assert.equal(cursor.mcpServers["ds-cs"].headers.Authorization, "Bearer KEY");
});

test("mcpEndpoint tolerates a trailing slash", () => {
  assert.equal(mcpEndpoint("https://x.test/"), "https://x.test/api/mcp");
  assert.equal(mcpEndpoint("https://x.test///"), "https://x.test/api/mcp");
});

test("every target maps to a distinct config path", () => {
  const files = MCP_TARGETS.map((target) => target.file);
  assert.equal(new Set(files).size, files.length);
});
