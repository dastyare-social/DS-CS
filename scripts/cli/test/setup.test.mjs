import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { AGENTS, CANONICAL_AGENT } from "../src/agents.mjs";
import { agentDirectories } from "../src/setup.mjs";
import { DEFAULTS, readPreferences, writePreferences } from "../src/preferences.mjs";

const projectRoot = "/tmp/ds-cs-test-project";

async function useTempPreferences() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ds-cs-prefs-"));
  process.env.DS_CS_CONFIG_DIR = dir;
  return dir;
}

test("agent directories resolve to absolute paths", () => {
  const directories = agentDirectories(["opencode", "claude-code"], {
    projectRoot,
    global: false,
  });

  assert.equal(directories.length, 2);
  assert.ok(directories.every((directory) => path.isAbsolute(directory)));
  assert.ok(directories.includes(path.join(projectRoot, ".agents/skills")));
  assert.ok(directories.includes(path.join(projectRoot, ".claude/skills")));
});

test("agents sharing a directory collapse to one entry", () => {
  // OpenCode, Cursor, Codex, Gemini CLI and Copilot all read .agents/skills, so
  // selecting three of them must not create or link the directory three times.
  const directories = agentDirectories(
    ["opencode", "cursor", "codex", "gemini-cli", "github-copilot"],
    { projectRoot, global: false }
  );

  assert.equal(directories.length, 1);
  assert.equal(directories[0], path.join(projectRoot, ".agents/skills"));
});

test("a custom directory can be passed as an agent", () => {
  const directories = agentDirectories(["./custom/skills", "claude-code"], {
    projectRoot,
    global: false,
  });

  assert.ok(directories.includes(path.join(projectRoot, "custom/skills")));
  assert.ok(directories.includes(path.join(projectRoot, ".claude/skills")));
});

test("global scope resolves under the home directory", () => {
  const directories = agentDirectories(["opencode"], { projectRoot, global: true });
  assert.ok(directories[0].startsWith(os.homedir()));
});

test("every agent has a label for the picker", () => {
  for (const agent of AGENTS) {
    assert.equal(typeof agent.label, "string", `${agent.name} has no label`);
    assert.ok(agent.label.length > 0, `${agent.name} has an empty label`);
  }
});

test("the canonical agent is a real, pickable agent", () => {
  // It was once filtered out of the preselected set, which silently deselected
  // OpenCode for everyone whose remembered choices included it.
  const opencode = AGENTS.find((agent) => agent.name === CANONICAL_AGENT);
  assert.ok(opencode);
  assert.equal(opencode.name, "opencode");
});

test("preferences round-trip and survive a missing file", async () => {
  const dir = await useTempPreferences();

  const initial = await readPreferences();
  assert.deepEqual(initial, DEFAULTS);

  await writePreferences({ agents: ["opencode", "cursor"], method: "copy" });

  const stored = await readPreferences();
  assert.deepEqual(stored.agents, ["opencode", "cursor"]);
  assert.equal(stored.method, "copy");
  assert.equal(stored.scope, "project", "unrelated keys are preserved");

  await fs.writeFile(path.join(dir, "preferences.json"), "{ not json");
  const recovered = await readPreferences();
  assert.deepEqual(recovered, DEFAULTS, "a corrupt file falls back rather than throwing");
});

test("preferences reject nonsense values", async () => {
  await useTempPreferences();
  await writePreferences({ scope: "sideways", method: "teleport", agents: [] });

  const stored = await readPreferences();
  assert.equal(stored.scope, "project");
  assert.equal(stored.method, "symlink");
  assert.deepEqual(stored.agents, DEFAULTS.agents);
});
