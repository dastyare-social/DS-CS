import { lstat } from "node:fs/promises";
import path from "node:path";

import { CANONICAL_AGENT, dedupeDirectories, linkSkill, skillsDirFor } from "./agents.mjs";
import { recordSkill } from "./lockfile.mjs";
import { resolveSource } from "./registry/sources.mjs";
import { assertSkillExists, discoverSkills } from "./skills/discover.mjs";
import { CliError } from "./utils/errors.mjs";
import {
  copyDirectory,
  ensureDir,
  hashDirectory,
  removeDirectory,
} from "./utils/fs.mjs";
import { select } from "./utils/prompt.mjs";

/**
 * Install skills from a source into one or more agents.
 *
 * The canonical copy always lands in `.agents/skills/<name>`, and every other
 * target is linked to it. That ordering matters: it keeps one authoritative
 * directory per project, so `ds-cs update` replaces content once instead of
 * drifting per-agent copies.
 */
export async function installSkills({
  source: sourceSpec,
  names = [],
  projectRoot,
  targets,
  global = false,
  copy = false,
  yes = false,
  preferLocal = true,
}) {
  const resolved = await resolveSource(sourceSpec, { cwd: projectRoot, preferLocal });

  const available = (await discoverSkills(resolved.root)).filter(
    (skill) => process.env.INSTALL_INTERNAL_SKILLS === "1" || !skill.internal
  );

  if (available.length === 0) {
    throw new CliError(`No skills found in ${resolved.describe()}`, {
      hint: "A skill is a directory containing a SKILL.md with name and description frontmatter.",
    });
  }

  const chosen = await chooseSkills(available, names, resolved, { yes });
  if (chosen.length === 0) return { installed: [], resolved };

  const canonicalDir = skillsDirFor(CANONICAL_AGENT, { projectRoot, global });
  await ensureDir(canonicalDir);

  const destinations = dedupeDirectories(
    (targets?.length ? targets : [canonicalDir]).map((directory) =>
      global && !path.isAbsolute(directory)
        ? skillsDirFor(directory, { projectRoot, global })
        : directory
    )
  );

  const installed = [];
  for (const skill of chosen) {
    const destination = path.join(canonicalDir, skill.name);

    // Replace rather than merge: a reference file removed upstream must not
    // survive in the installed copy. Skipped when the source *is* the target,
    // which happens if someone points `--source` at an installed skills dir —
    // the delete below would otherwise destroy the source mid-copy.
    if (!isSameDirectory(skill.dir, destination)) {
      await removeDirectory(destination);
      await copyDirectory(skill.dir, destination);
    }

    const hash = await hashDirectory(destination);
    const links = [];
    for (const target of destinations) {
      if (path.resolve(target) === path.resolve(canonicalDir)) continue;
      links.push(await linkSkill(destination, target, { copy }));
    }

    await recordSkill(projectRoot, { ...skill, hash }, resolved);
    installed.push({ skill, destination, links, hash });
  }

  return { installed, resolved };
}

/** True when a copy from `source` to `destination` would clobber its own input. */
function isSameDirectory(source, destination) {
  return path.resolve(source) === path.resolve(destination);
}

async function chooseSkills(available, names, resolved, { yes }) {
  if (names.includes("*")) return available;

  if (names.length > 0) {
    return names.map((name) => assertSkillExists(available, name));
  }

  if (yes) return [available[0]];

  const picked = await select(`Which skills from ${resolved.describe()}?`, available.map((skill) => ({
    label: skill.name,
    value: skill,
    description: skill.description,
  })));

  return picked.map((choice) => choice.value);
}

/**
 * Re-install a locked skill from its recorded source.
 *
 * The lockfile stores the skill's path *within* the source (`skills/foo/SKILL.md`)
 * so the same source can be re-fetched even if the skill moved within its own
 * repository layout.
 */
export async function refreshSkill(projectRoot, entry, options = {}) {
  const resolved = await resolveSource(entry.source, { cwd: projectRoot });
  const available = await discoverSkills(resolved.root);
  const match =
    available.find((skill) => skill.name === entry.name) ??
    available.find((skill) => skill.skillPath === entry.skillPath);

  if (!match) {
    return { name: entry.name, status: "missing", source: resolved };
  }

  const canonicalDir = skillsDirFor(CANONICAL_AGENT, {
    projectRoot,
    global: options.global ?? false,
  });
  const destination = path.join(canonicalDir, match.name);

  if (!isSameDirectory(match.dir, destination)) {
    await removeDirectory(destination);
    await copyDirectory(match.dir, destination);
  }
  const hash = await hashDirectory(destination);

  await recordSkill(projectRoot, { name: match.name, skillPath: match.skillPath, hash }, resolved);

  return { name: match.name, status: "changed", source: resolved, hash, skill: match };
}

/**
 * Uninstall from every target directory.
 *
 * Non-canonical directories are swept **first**. They hold symlinks pointing at
 * the canonical copy, so deleting the target before the links turns them into
 * dangling symlinks that `stat` then reports as absent — leaving the links
 * themselves on disk.
 */
export async function removeSkill(name, targets) {
  const removed = [];
  for (const directory of [...targets].reverse()) {
    const target = path.join(directory, name);
    if (await removePath(target)) {
      removed.push(target);
    }
  }
  return removed;
}

/** `lstat`, not `stat`: a dangling symlink still occupies its path. */
async function removePath(target) {
  try {
    await lstat(target);
  } catch {
    return false;
  }
  await removeDirectory(target);
  return true;
}
