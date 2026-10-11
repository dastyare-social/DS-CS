import path from "node:path";

import { CliError } from "./utils/errors.mjs";
import { exists, readJson, writeJson } from "./utils/fs.mjs";

/**
 * `skills-lock.json` is the same lockfile `npx skills` (vercel-labs) reads and
 * writes. Matching its v1 shape exactly is deliberate: a project can install
 * DS-CS skills with `ds-cs add` and third-party skills with `npx skills add`
 * without the two clobbering each other's state, and `ds-cs list` can report on
 * skills installed by either tool.
 *
 * Shape:
 *   { "version": 1,
 *     "skills": { "<skill name>": {
 *        source, sourceType, skillPath, computedHash } } }
 */
export const LOCKFILE_NAME = "skills-lock.json";
export const LOCKFILE_VERSION = 1;

export function lockfilePath(projectRoot) {
  return path.join(projectRoot, LOCKFILE_NAME);
}

export async function readLockfile(projectRoot) {
  const file = lockfilePath(projectRoot);
  if (!(await exists(file))) return { version: LOCKFILE_VERSION, skills: {} };

  let parsed;
  try {
    parsed = await readJson(file);
  } catch (error) {
    throw new CliError(`${LOCKFILE_NAME} is not valid JSON`, {
      hint: "Fix or delete the file, then re-run.",
      cause: error,
    });
  }

  if (parsed.version !== LOCKFILE_VERSION) {
    throw new CliError(
      `${LOCKFILE_NAME} has unsupported version ${JSON.stringify(parsed.version)} (expected ${LOCKFILE_VERSION})`,
      { hint: "Update the ds-cs CLI, or regenerate the lockfile." }
    );
  }

  return { version: LOCKFILE_VERSION, skills: parsed.skills ?? {} };
}

export async function writeLockfile(projectRoot, lockfile) {
  const sorted = {};
  for (const name of Object.keys(lockfile.skills).sort()) {
    sorted[name] = lockfile.skills[name];
  }
  await writeJson(lockfilePath(projectRoot), { version: LOCKFILE_VERSION, skills: sorted });
}

export async function recordSkill(projectRoot, skill, source) {
  const lockfile = await readLockfile(projectRoot);
  lockfile.skills[skill.name] = {
    source: source.id,
    sourceType: source.type,
    skillPath: skill.skillPath,
    computedHash: skill.hash,
  };
  await writeLockfile(projectRoot, lockfile);
  return lockfile;
}

export async function forgetSkill(projectRoot, name) {
  const lockfile = await readLockfile(projectRoot);
  delete lockfile.skills[name];
  await writeLockfile(projectRoot, lockfile);
  return lockfile;
}
