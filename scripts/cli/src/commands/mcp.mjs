import fs from "node:fs/promises";
import path from "node:path";

import { readAuth, redact } from "../auth.mjs";
import { MCP_TARGETS, buildMcpConfig, mcpEndpoint } from "../mcp-config.mjs";
import { exists } from "../utils/fs.mjs";
import { cyan, log } from "../utils/log.mjs";

/**
 * Print — and optionally write — the MCP server config for a channel.
 *
 * Every format is printed by default and only the named agent's file is
 * written. An existing config is never overwritten: the snippet is shown so the
 * user can merge it, because clobbering a working MCP config to add one server
 * is a bad trade.
 */
export async function mcpCommand(positional, flags, { projectRoot }) {
  const stored = await readAuth();
  const url = (flags.url ?? stored.baseUrl ?? "https://cs.dastyare.social").replace(/\/+$/, "");
  const apiKey = flags.apiKey ?? stored.apiKey ?? null;
  const endpoint = mcpEndpoint(url);

  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

  const snippets = [
    {
      name: "Remote (recommended)",
      note: "Works for every MCP client. No local process.",
      configs: {
        "Claude Desktop / Cursor / generic": buildMcpConfig("claude-code", url, apiKey),
        "Claude Code": {
          mcpServers: {
            "ds-cs": { type: "url", url: endpoint, ...(headers ? { headers } : {}) },
          },
        },
        OpenCode: buildMcpConfig("opencode", url, apiKey),
      },
    },
    {
      name: "Local (stdio, needs a clone)",
      note: "Faster and works offline. Requires DATABASE_URL and the repo.",
      configs: {
        "Claude Code / Cursor": {
          mcpServers: {
            "ds-cs": { command: "bun", args: ["run", "mcp"], cwd: "<path-to-ds-cs-repo>" },
          },
        },
      },
    },
  ];

  for (const section of snippets) {
    log.plain(`\n${section.name} — ${section.note}`);
    for (const [label, config] of Object.entries(section.configs)) {
      log.plain(`\n  ${label}:`);
      log.plain(indent(JSON.stringify(config, null, 2)));
    }
  }

  if (apiKey) {
    log.plain(`\n  Using API key ${cyan(redact(apiKey))} (write access enabled)`);
  } else {
    log.plain("\n  No API key configured — read tools only. Run `ds-cs login` for write access.");
  }

  const writeTarget = positional[0];
  if (writeTarget) {
    await writeConfig(projectRoot, writeTarget, url, apiKey);
  }
}

function indent(text) {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

async function writeConfig(projectRoot, agent, url, apiKey) {
  const target = MCP_TARGETS.find((candidate) => candidate.agent === agent);
  if (!target) {
    log.warn(
      `Unknown agent "${agent}" — nothing written. Valid: ${MCP_TARGETS.map((c) => c.agent).join(", ")}`
    );
    return;
  }

  const file = path.join(projectRoot, target.file);
  if (await exists(file)) {
    log.warn(`${target.file} already exists — not overwritten. Merge the snippet manually.`);
    return;
  }

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify(buildMcpConfig(agent, url, apiKey), null, 2)}\n`,
    "utf8"
  );
  log.success(`\nWrote ${target.file}`);
}
