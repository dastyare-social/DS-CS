import path from "node:path";

import { AGENTS, CANONICAL_AGENT, skillsDirFor } from "../agents.mjs";
import { readLockfile } from "../lockfile.mjs";
import { readSkillManifest } from "../skills/frontmatter.mjs";
import { isFile } from "../utils/fs.mjs";
import { dim, log, table } from "../utils/log.mjs";

/**
 * Report what is installed.
 *
 * The lockfile is the source of truth for *what was asked for*; the filesystem is
 * checked to show what actually survived. Those two can disagree — someone can
 * delete a skill directory by hand — and an inventory that hides that is worse
 * than useless.
 */
export async function listCommand(positional, flags, { projectRoot }) {
  const global = Boolean(flags.global);
  const lockfile = await readLockfile(projectRoot);
  const names = Object.keys(lockfile.skills).sort();

  const filter = positional[0];

  if (names.length === 0) {
    log.info(
      global
        ? "No skills installed globally."
        : `No skills installed in this project. Try \`ds-cs add\` or run \`ds-cs init\`.`
    );
    return;
  }

  const rows = [];
  for (const name of names) {
    if (filter && !name.includes(filter)) continue;
    const entry = lockfile.skills[name];
    const installed = await readInstalledSkill(projectRoot, name, global);

    rows.push({
      name,
      source: entry.source,
      path: entry.skillPath,
      status: installed ? "installed" : "MISSING",
      description: installed?.description ?? "",
    });
  }

  if (rows.length === 0) {
    log.info(`No installed skill matches "${filter}".`);
    return;
  }

  table(rows, [
    { key: "name", title: "NAME" },
    { key: "status", title: "STATUS" },
    { key: "source", title: "SOURCE" },
    { key: "description", title: "DESCRIPTION" },
  ]);

  const missing = rows.filter((row) => row.status === "MISSING");
  if (missing.length > 0) {
    log.plain("");
    log.warn(
      `${missing.length} skill${missing.length === 1 ? "" : "s"} recorded in ${path.basename("skills-lock.json")} but not on disk: ${missing.map((row) => row.name).join(", ")}`
    );
    log.plain(dim("Run `ds-cs add <name>` to reinstall."));
  }
}

async function readInstalledSkill(projectRoot, name, global) {
  const skillFile = path.join(
    skillsDirFor(CANONICAL_AGENT, { projectRoot, global }),
    name,
    "SKILL.md"
  );
  if (!(await isFile(skillFile))) return null;
  return readSkillManifest(skillFile);
}

export function printAgents() {
  table(
    AGENTS.map((agent) => ({ name: agent.name, project: agent.project, global: agent.global })),
    [
      { key: "name", title: "AGENT" },
      { key: "project", title: "PROJECT PATH" },
      { key: "global", title: "GLOBAL PATH" },
    ]
  );
}
