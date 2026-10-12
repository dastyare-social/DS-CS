import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { exists } from "./utils/fs.mjs";

/**
 * User-level preferences: which scope you normally install into, which agents
 * you normally target, and symlink vs copy.
 *
 * Stored per user rather than per project on purpose. Scope and agent choice
 * are habits, not project configuration — writing them into someone's repo
 * would be litter, and a committed "install globally" would quietly change
 * behaviour on every other machine that cloned it.
 */
function preferencesPath() {
  const base =
    process.env.DS_CS_CONFIG_DIR ??
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, "ds-cs")
      : path.join(os.homedir(), ".config", "ds-cs"));
  return path.join(base, "preferences.json");
}

export const DEFAULTS = {
  scope: "project",
  method: "symlink",
  agents: ["opencode", "claude-code"],
};

export async function readPreferences() {
  const file = preferencesPath();
  if (!(await exists(file))) return { ...DEFAULTS };

  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      scope: parsed.scope === "global" ? "global" : "project",
      method: parsed.method === "copy" ? "copy" : "symlink",
      agents: Array.isArray(parsed.agents) && parsed.agents.length > 0 ? parsed.agents : [...DEFAULTS.agents],
    };
  } catch {
    // A corrupt preferences file must never block an install — fall back to
    // defaults rather than making the user hand-edit JSON.
    return { ...DEFAULTS };
  }
}

export async function writePreferences(patch) {
  const file = preferencesPath();
  const current = await readPreferences();
  const next = { ...current, ...patch };

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  } catch {
    // Preferences are a convenience. Failing to persist them is not worth
    // failing an install over.
  }
  return next;
}

export function preferencesLocation() {
  return preferencesPath();
}
