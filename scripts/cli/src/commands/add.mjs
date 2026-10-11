import path from "node:path";

import { CANONICAL_AGENT, detectAgents, getAgent, skillsDirFor } from "../agents.mjs";
import { installSkills } from "../install.mjs";
import { lockfilePath } from "../lockfile.mjs";
import { discoverSkills } from "../skills/discover.mjs";
import { toArray } from "../args.mjs";
import { CliError } from "../utils/errors.mjs";
import { ensureDir } from "../utils/fs.mjs";
import { cyan, log, table } from "../utils/log.mjs";
import { resolveRequest } from "./target.mjs";

export async function addCommand(positional, flags, { projectRoot }) {
  const { source, names } = resolveRequest(positional, flags);

  if (flags.list) {
    await listSource(source, projectRoot, flags);
    return;
  }

  const global = Boolean(flags.global);
  const targets = resolveTargets(flags, { projectRoot, global });

  const { installed, resolved } = await installSkills({
    source,
    names,
    projectRoot,
    targets,
    global,
    copy: Boolean(flags.copy),
    yes: Boolean(flags.yes),
  });

  log.success(`Installed ${installed.length} skill${installed.length === 1 ? "" : "s"} from ${resolved.describe()}`);

  for (const entry of installed) {
    log.plain(`  ${cyan(entry.skill.name)}  ${entry.skill.description}`);
    log.plain(`    ${path.relative(process.cwd(), entry.destination) || entry.destination}`);
    for (const link of entry.links) {
      const label = link.linked ? "linked" : "copied (symlinks unavailable)";
      log.plain(`    ${dimPath(link.target)} ${dimLabel(label)}`);
    }
  }

  log.plain(`\n  Recorded in ${path.relative(process.cwd(), lockfilePath(projectRoot))}`);
}

async function listSource(sourceSpec, projectRoot, flags) {
  const { resolveSource } = await import("../registry/sources.mjs");
  const resolved = await resolveSource(sourceSpec, { cwd: projectRoot });
  const skills = (await discoverSkills(resolved.root)).filter(
    (skill) => process.env.INSTALL_INTERNAL_SKILLS === "1" || !skill.internal
  );

  if (skills.length === 0) {
    log.warn(`No skills found in ${resolved.describe()}`);
    return;
  }

  log.info(`Skills in ${resolved.describe()}:\n`);
  table(
    skills.map((skill) => ({ name: skill.name, description: skill.description })),
    [
      { key: "name", title: "NAME" },
      { key: "description", title: "DESCRIPTION" },
    ]
  );
}

function resolveTargets(flags, { projectRoot, global }) {
  const requested = toArray(flags.agent);
  if (requested.includes("*")) return [canonicalDir(projectRoot, global)];

  if (requested.length === 0) {
    return detectAgents({ projectRoot, global }).map((agent) =>
      skillsDirFor(agent, { projectRoot, global })
    );
  }

  return requested.map((name) => {
    try {
      return skillsDirFor(getAgent(name).name, { projectRoot, global });
    } catch {
      // `--agent` accepts a literal directory too, so an agent this CLI does not
      // know about can still be targeted without waiting to be added here.
      if (name.startsWith(".") || path.isAbsolute(name)) {
        return path.isAbsolute(name) ? name : path.join(projectRoot, name);
      }
      throw new CliError(`Unknown agent "${name}"`, {
        hint: "Run `ds-cs init --list-agents`, or pass a directory starting with \".\" or \"/\".",
      });
    }
  });
}

function canonicalDir(projectRoot, global) {
  return skillsDirFor(CANONICAL_AGENT, { projectRoot, global });
}

const dimPath = (value) => `    → ${value}`;
const dimLabel = (value) => (value === "linked" ? `(linked)` : `(${value})`);
