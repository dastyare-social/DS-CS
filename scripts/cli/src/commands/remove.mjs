import path from "node:path";

import { CANONICAL_AGENT, skillsDirFor } from "../agents.mjs";
import { forgetSkill, readLockfile } from "../lockfile.mjs";
import { removeSkill } from "../install.mjs";
import { toArray } from "../args.mjs";
import { ensureDir } from "../utils/fs.mjs";
import { log } from "../utils/log.mjs";
import { select } from "../utils/prompt.mjs";

/**
 * Uninstall skills.
 *
 * Removing from the canonical directory alone would leave the symlinks in other
 * agents' directories dangling, so every configured target is swept.
 */
export async function removeCommand(positional, flags, { projectRoot }) {
  const global = Boolean(flags.global);
  const lockfile = await readLockfile(projectRoot);
  const installed = Object.keys(lockfile.skills).sort();

  let names = [...positional.flatMap(splitCommas), ...toArray(flags.skill)];

  if (names.includes("*") || names.length === 0) {
    if (installed.length === 0) {
      log.info("Nothing to remove.");
      return;
    }
    if (flags.all) {
      names = installed;
    } else {
      const picked = await select("Which skills should be removed?", installed.map((name) => ({
        label: name,
        value: name,
      })));
      names = picked.map((choice) => choice.value);
      if (names.length === 0) return;
    }
  }

  const unknown = names.filter((name) => !lockfile.skills[name]);
  const targets = await agentDirectories(projectRoot, flags, global);

  for (const directory of targets) {
    await ensureDir(directory);
  }

  for (const name of names) {
    const removed = await removeSkill(name, targets);
    await forgetSkill(projectRoot, name);

    if (unknown.includes(name)) {
      log.warn(`"${name}" was not in the lockfile; removed ${removed.length} file(s) from disk`);
      continue;
    }
    log.success(`Removed ${name} from ${removed.length} location(s)`);
  }

  log.plain(`\n  ${path.relative(process.cwd(), path.join(projectRoot, "skills-lock.json"))} updated`);
}

function splitCommas(value) {
  return value.includes(",") ? value.split(",").map((name) => name.trim()) : [value];
}

async function agentDirectories(projectRoot, flags, global) {
  const canonical = skillsDirFor(CANONICAL_AGENT, { projectRoot, global });
  const requested = toArray(flags.agent);
  if (requested.length === 0 || requested.includes("*")) return [canonical];

  const directories = [canonical];
  for (const agent of requested) {
    if (agent.startsWith(".") || path.isAbsolute(agent)) {
      directories.push(path.isAbsolute(agent) ? agent : path.join(projectRoot, agent));
    } else {
      directories.push(skillsDirFor(agent, { projectRoot, global }));
    }
  }
  return [...new Set(directories)];
}
