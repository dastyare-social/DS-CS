import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CliError } from "./utils/errors.mjs";
import { exists, isDirectory } from "./utils/fs.mjs";

/**
 * Where each supported agent looks for project-scoped skills.
 *
 * Many agents share `.agents/skills/`, so they are listed as separate names but
 * resolve to the same directory — installing to one installs to all of them.
 * This mirrors `npx skills`; entries not listed here can still be targeted with
 * `--agent-dir <path>`.
 */
export const AGENTS = [
  { name: "opencode", project: ".agents/skills", global: ".config/opencode/skills", detect: ".opencode" },
  { name: "cursor", project: ".agents/skills", global: ".cursor/skills", detect: ".cursor" },
  { name: "codex", project: ".agents/skills", global: ".codex/skills", detect: ".codex" },
  { name: "claude-code", project: ".claude/skills", global: ".claude/skills", detect: ".claude" },
  { name: "windsurf", project: ".windsurf/skills", global: ".codeium/windsurf/skills", detect: ".windsurf" },
  { name: "amp", project: ".agents/skills", global: ".config/agents/skills", detect: ".amp" },
  { name: "gemini-cli", project: ".agents/skills", global: ".gemini/skills", detect: ".gemini" },
  { name: "github-copilot", project: ".agents/skills", global: ".copilot/skills", detect: ".github" },
  { name: "goose", project: ".goose/skills", global: ".config/goose/skills", detect: ".goose" },
  { name: "devin", project: ".devin/skills", global: ".config/devin/skills", detect: ".devin" },
  { name: "kilo-code", project: ".agents/skills", global: ".kilocode/skills", detect: ".kilocode" },
  { name: "cline", project: ".agents/skills", global: ".cline/skills", detect: ".cline" },
  { name: "roo", project: ".roo/skills", global: ".roo/skills", detect: ".roo" },
  { name: "crush", project: ".crush/skills", global: ".config/crush/skills", detect: ".crush" },
  { name: "aider-desk", project: ".aider-desk/skills", global: ".aider-desk/skills", detect: ".aider-desk" },
];

/**
 * The canonical install location. Everything else either is this directory or
 * points at it, which keeps a skill's files in exactly one place per project.
 */
export const CANONICAL_AGENT = "opencode";

export function getAgent(name) {
  const agent = AGENTS.find((candidate) => candidate.name === name);
  if (!agent) {
    throw new CliError(`Unknown agent "${name}"`, {
      hint: `Known agents: ${AGENTS.map((candidate) => candidate.name).join(", ")}. Or use --agent-dir <path>.`,
    });
  }
  return agent;
}

export function skillsDirFor(agentName, { projectRoot, global }) {
  const agent = getAgent(agentName);
  const relative = global ? agent.global : agent.project;
  return global
    ? path.join(os.homedir(), relative)
    : path.join(projectRoot, relative);
}

/**
 * Agents that look installed in this project (or in the user's home directory).
 * `ds-cs add` uses this to pre-select targets in interactive mode; with no
 * detection at all it falls back to the canonical directory.
 */
export async function detectAgents({ projectRoot, global }) {
  const detected = [];
  for (const agent of AGENTS) {
    const marker = agent.detect;
    if (!marker) continue;
    const projectMarker = path.join(projectRoot, marker);
    const globalMarker = path.join(os.homedir(), marker);
    if ((await exists(projectMarker)) || (await exists(globalMarker))) {
      detected.push(agent.name);
    }
  }

  if (detected.length === 0 && !global) {
    return [CANONICAL_AGENT];
  }
  return [...new Set(detected)];
}

export function dedupeDirectories(directories) {
  const seen = new Map();
  for (const directory of directories) {
    if (!seen.has(directory)) seen.set(directory, directory);
  }
  return [...seen.values()];
}

/**
 * Install one skill directory into an agent's skills folder.
 *
 * Symlink by default: every agent points at the canonical copy, so an update
 * lands everywhere at once and there is one source of truth. `--copy` is the
 * escape hatch for filesystems or setups where symlinks do not work.
 */
export async function linkSkill(skillDir, skillsDirectory, { copy }) {
  const target = path.join(skillsDirectory, path.basename(skillDir));

  if (await exists(target)) {
    await fs.rm(target, { recursive: true, force: true });
  }
  await fs.mkdir(skillsDirectory, { recursive: true });

  if (copy) {
    await fs.cp(skillDir, target, { recursive: true });
  } else {
    try {
      await fs.symlink(path.resolve(skillDir), target, "dir");
    } catch (error) {
      // Windows without developer mode, some container mounts, and certain
      // network filesystems reject symlinks. Copying still produces a correct
      // install, so degrade instead of failing the whole command.
      await fs.cp(skillDir, target, { recursive: true });
      return { target, linked: false, fallbackReason: error.code ?? "symlink unsupported" };
    }
  }

  return { target, linked: !copy };
}

export async function unlinkSkill(name, skillsDirectory) {
  const target = path.join(skillsDirectory, name);
  if (!(await exists(target))) return false;
  await fs.rm(target, { recursive: true, force: true });
  return true;
}

export async function skillsDirectoryExists(skillsDirectory) {
  return isDirectory(skillsDirectory);
}
