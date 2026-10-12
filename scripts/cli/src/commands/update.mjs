import { CANONICAL_AGENT, skillsDirFor } from "../agents.mjs";
import { readLockfile } from "../lockfile.mjs";
import { refreshSkill } from "../install.mjs";
import { toArray } from "../args.mjs";
import { hashDirectory, exists } from "../utils/fs.mjs";
import path from "node:path";
import { log } from "../utils/log.mjs";
import { select } from "../utils/prompt.mjs";

/**
 * Re-fetch locked skills and report what actually changed.
 *
 * The comparison is against the recorded `computedHash`, so a skill whose files
 * were edited locally shows up as "modified" rather than being silently
 * overwritten. The default is to leave those alone — an agent's local tweak is
 * usually deliberate, and clobbering it on a routine `update` is the kind of
 * surprise that makes people stop running the tool.
 */
export async function updateCommand(positional, flags, { projectRoot }) {
  const lockfile = await readLockfile(projectRoot);
  const all = Object.keys(lockfile.skills).sort();

  if (all.length === 0) {
    log.info("Nothing to update — no skills in skills-lock.json.");
    return;
  }

  let names = [...positional, ...toArray(flags.skill)];

  if (names.length === 0 || names.includes("*")) {
    if (flags.yes) {
      names = all;
    } else {
      const picked = await select("Which skills should be updated?", all.map((name) => ({
        label: name,
        value: name,
      })));
      names = picked.map((choice) => choice.value);
      if (names.length === 0) return;
    }
  }

  let changed = 0;
  let unchanged = 0;
  let skipped = 0;
  const problems = [];

  for (const name of names) {
    const entry = lockfile.skills[name];
    if (!entry) {
      log.warn(`"${name}" is not in skills-lock.json`);
      continue;
    }

    const localDir = path.join(
      skillsDirFor(CANONICAL_AGENT, { projectRoot, global: Boolean(flags.global) }),
      name
    );
    const locallyModified = (await exists(localDir)) && (await hashDirectory(localDir)) !== entry.computedHash;

    let result;
    try {
      result = await refreshSkill(projectRoot, entry, { global: Boolean(flags.global) });
    } catch (error) {
      problems.push(`${name}: ${error.message}`);
      continue;
    }

    if (result.status === "missing") {
      problems.push(`${name}: no longer present in ${result.source.describe()}`);
      continue;
    }

    if (locallyModified && !flags.force) {
      skipped += 1;
      log.warn(`${name} has local changes — skipped (use --force to overwrite)`);
      continue;
    }

    if (result.hash === entry.computedHash) {
      unchanged += 1;
    } else {
      changed += 1;
      log.success(`${name} updated`);
    }
  }

  log.plain("");
  log.info(`${changed} updated, ${unchanged} already current, ${skipped} skipped`);

  for (const problem of problems) {
    log.warn(problem);
  }
}
