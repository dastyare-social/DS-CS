import path from "node:path";

import { AGENTS, CANONICAL_AGENT, getAgent, skillsDirFor } from "./agents.mjs";
import { readPreferences, writePreferences } from "./preferences.mjs";
import { isInteractive, multiselect, select } from "./utils/prompt.mjs";

/**
 * The interactive setup flow, shared by `init` and `add`.
 *
 * Order matters and mirrors what an installer is actually asking: scope first
 * (it decides which directories exist), then which agents to write into (it
 * decides what gets created), then how the files are shared between them.
 */

function agentLabel(agent) {
  return AGENTS.find((candidate) => candidate.name === agent)?.label ?? agent;
}

export async function detectInstalledAgents({ projectRoot, global }) {
  const found = [];
  for (const agent of AGENTS) {
    const marker = global
      ? agent.globalRoot
      : path.join(projectRoot, agent.detect);
    if (marker && (await hasPath(marker))) found.push(agent.name);
  }
  return found;
}

async function hasPath(target) {
  const fs = await import("node:fs/promises");
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

/** Choice list for the agent picker, detected agents marked. */
function agentChoices(detected) {
  return AGENTS.map((agent) => ({
    value: agent.name,
    label: agent.label,
    description: `${detected.includes(agent.name) ? "detected" : ""} ${agent.project}`.trim(),
  }));
}

/**
 * Ask where to install, which agents, and how to share files — unless the
 * caller already decided via flags or there is no terminal.
 *
 * Returns `{ global, agents, copy, interactive }`. When nothing was prompted
 * the flags and detection decide, so CI behaviour is unchanged.
 */
export async function resolveInstallTarget(flags, { projectRoot }) {
  const preferences = await readPreferences();
  const detected = await detectInstalledAgents({ projectRoot, global: false });
  const interactive = isInteractive();

  // ---- scope -------------------------------------------------------------
  let global = Boolean(flags.global);
  let scopeAsked = false;

  if (interactive && !flags.project && flags.global === undefined) {
    scopeAsked = true;
    const [choice] = await select({
      message: "Where should ds-cs install skills?",
      choices: [
        {
          value: "project",
          label: "This project",
          description: "committed, shared with your team",
        },
        {
          value: "global",
          label: "Global (every project)",
          description: `your user directory — ${preferences.agents.map(agentLabel).join(", ") || "all agents"}`,
        },
      ],
      initialIndex: preferences.scope === "global" ? 1 : 0,
    });
    global = choice.value === "global";
  }

  // ---- agents ------------------------------------------------------------
  let agents;
  const requestedAgents = toArray(flags.agent);

  if (requestedAgents.length > 0) {
    agents = requestedAgents.includes("*") ? [CANONICAL_AGENT] : requestedAgents;
  } else if (interactive && !flags.yes) {
    // Pre-select whatever we last chose, falling back to what is detected,
    // falling back to the canonical agent. Remembering the last choice is the
    // single biggest time-saver in a prompt you answer on every new project.
    // The canonical agent is not special-cased here: it is a real agent with a
    // real directory, and dropping it would silently deselect it for everyone.
    const seed =
      preferences.agents.length > 0
        ? preferences.agents
        : detected.length > 0
          ? detected
          : [CANONICAL_AGENT];

    const picked = await multiselect({
      message: "Which agents should read these skills?",
      choices: agentChoices(detected),
      initialSelected: seed,
      hint: "type to filter · space to toggle · enter to confirm",
      required: true,
    });
    agents = picked.map((choice) => choice.value);
  } else {
    agents = detected.length > 0 ? detected : [CANONICAL_AGENT];
  }

  agents = [...new Set(agents.map((agent) => (agent === "*" ? CANONICAL_AGENT : agent)))];

  // ---- install method ----------------------------------------------------
  let copy = Boolean(flags.copy);

  if (interactive && !flags.yes && flags.copy === undefined) {
    const [choice] = await select({
      message: "How should the files be shared between agents?",
      choices: [
        {
          value: "symlink",
          label: "Symlink",
          description: "one copy, updates land everywhere",
        },
        {
          value: "copy",
          label: "Copy",
          description: "independent files per agent",
        },
      ],
      initialIndex: preferences.method === "copy" ? 1 : 0,
    });
    copy = choice.value === "copy";
  }

  // Remember the choices only when the user actually made them.
  if (interactive) {
    await writePreferences({
      scope: global ? "global" : "project",
      agents,
      method: copy ? "copy" : "symlink",
    });
  }

  return { global, agents, copy, interactive, scopeAsked, detected };
}

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Searchable skill picker.
 *
 * A numbered single-select is the wrong shape for an installer: you should be
 * able to take three skills at once and filter a long registry by typing.
 *
 * The list stays compact (name + path), but filtering also runs against the
 * full description — which is where the words a user would actually search for
 * live ("webhook", "migrate", "release"), not in a directory name.
 */
export async function pickSkills(skills) {
  const picked = await multiselect({
    message: "Which skills would you like to install?",
    choices: skills.map((skill) => ({
      value: skill.name,
      label: skill.name,
      description: skill.skillPath.replace(/SKILL\.md$/, ""),
      keywords: `${skill.name} ${skill.skillPath} ${skill.description ?? ""}`,
    })),
    hint: "type to filter · space to toggle · enter to install",
    required: true,
  });
  return picked.map((choice) => choice.value);
}

/**
 * Turn agent names into concrete skills directories, resolving custom
 * directories the same way the flag parser does.
 */
export function agentDirectories(agentNames, { projectRoot, global }) {
  const directories = [];
  for (const agent of agentNames) {
    if (agent.startsWith(".") || path.isAbsolute(agent)) {
      directories.push(path.isAbsolute(agent) ? agent : path.join(projectRoot, agent));
      continue;
    }
    try {
      directories.push(skillsDirFor(getAgent(agent).name, { projectRoot, global }));
    } catch (error) {
      throw error;
    }
  }
  return [...new Set(directories)];
}
