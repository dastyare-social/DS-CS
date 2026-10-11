import path from "node:path";

import { CliError } from "../utils/errors.mjs";
import { hashDirectory, isDirectory, isFile } from "../utils/fs.mjs";
import { readSkillManifest } from "./frontmatter.mjs";

/**
 * Directories that hold skills in a source tree. A `skills/` at the repo root is
 * the canonical first-party layout for DS-CS; the rest are recognised so a
 * third-party repo can be consumed by the same command.
 */
export const CONTAINER_DIRECTORIES = [
  "skills",
  "skills/.curated",
  "skills/.experimental",
  "skills/.system",
  ".agents/skills",
  ".claude/skills",
  "agent/skills",
  "data/skills",
];

/** How deep to walk inside a container. 3 covers skills/<name>/SKILL.md plus two category levels. */
const MAX_DEPTH = 3;

async function collectSkillFiles(dir, depth, out) {
  if (depth > MAX_DEPTH) return out;

  let entries;
  try {
    entries = await import("node:fs/promises").then((fs) =>
      fs.readdir(dir, { withFileTypes: true })
    );
  } catch {
    return out;
  }

  const hasSkillFile = entries.some(
    (entry) => entry.isFile() && entry.name === "SKILL.md"
  );

  if (hasSkillFile) {
    out.push(path.join(dir, "SKILL.md"));
    // A skill directory is a unit; never descend into it looking for nested
    // skills (reference docs and scripts live there).
    return out;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") && entry.name !== ".curated" && entry.name !== ".system") {
      continue;
    }
    await collectSkillFiles(path.join(dir, entry.name), depth + 1, out);
  }

  return out;
}

/**
 * Find every skill in a directory tree.
 *
 * Returns descriptors carrying the skill's directory *and* the container-relative
 * path (`skillPath` in the lockfile), because `ds-cs update` needs the latter to
 * re-fetch a single skill from a source it has never fully cloned.
 */
export async function discoverSkills(root) {
  const skills = [];
  const seen = new Set();

  // A repository whose root *is* the skill is valid — register it before the
  // containers so a root skill is never missed.
  const rootSkillFile = path.join(root, "SKILL.md");
  if (await isFile(rootSkillFile)) {
    seen.add(rootSkillFile);
    const manifest = await readSkillManifest(rootSkillFile);
    skills.push({
      name: manifest.name,
      description: manifest.description,
      internal: manifest.internal,
      dir: root,
      skillFile: rootSkillFile,
      skillPath: "SKILL.md",
      hash: await hashDirectory(root),
    });
  }

  for (const container of CONTAINER_DIRECTORIES) {
    const containerDir = path.join(root, container);
    if (!(await isDirectory(containerDir))) continue;

    const files = await collectSkillFiles(containerDir, 1, []);
    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);

      const dir = path.dirname(file);
      const manifest = await readSkillManifest(file);
      skills.push({
        name: manifest.name,
        description: manifest.description,
        internal: manifest.internal,
        dir,
        skillFile: file,
        skillPath: path.relative(root, file).split(path.sep).join("/"),
        hash: await hashDirectory(dir),
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function assertSkillExists(skills, name) {
  const found = skills.find((skill) => skill.name === name);
  if (found) return found;

  const available = skills.filter((skill) => !skill.internal).map((skill) => skill.name);
  throw new CliError(`No skill named "${name}" in that source`, {
    hint:
      available.length > 0
        ? `Available: ${available.join(", ")}`
        : "That source contains no skills.",
  });
}
