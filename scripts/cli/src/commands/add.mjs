import path from "node:path";

import {
  CANONICAL_AGENT,
  dedupeDirectories,
  detectAgents,
  getAgent,
  skillsDirFor,
} from "../agents.mjs";
import { installSkills } from "../install.mjs";
import { lockfilePath } from "../lockfile.mjs";
import { discoverSkills } from "../skills/discover.mjs";
import { toArray } from "../args.mjs";
import { CliError } from "../utils/errors.mjs";
import { cyan, log, table } from "../utils/log.mjs";
import { isInteractive } from "../utils/prompt.mjs";
import { resolveRequest } from "./target.mjs";

export async function addCommand(positional, flags, { projectRoot }) {
  const { source, names } = resolveRequest(positional, flags);

  // `ds-cs add` on its own means "show me what there is" — the interactive
  // picker when there is a terminal, the plain listing when there is not (CI, a
  // pipe, an agent shell). Erroring on a missing TTY would make the documented
  // "browse everything" form fail in exactly the places people run it.
  if (flags.list || (names.length === 0 && !isInteractive())) {
    await listSource(source, projectRoot);
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
    log.plain(`    ${display(entry.destination)}`);
    for (const link of entry.links) {
      log.plain(`    → ${display(link.target)} (${link.linked ? "linked" : "copied — symlinks unavailable"})`);
    }
  }

  log.plain(`\n  Recorded in ${display(lockfilePath(projectRoot))}`);
}

/**
 * Show paths relative to the current directory, but fall back to absolute when
 * the relative form would be a chain of `../` — nobody can place that.
 */
function display(target) {
  const relative = path.relative(process.cwd(), target);
  return relative === "" || relative.startsWith("..") ? target : relative;
}

async function listSource(sourceSpec, projectRoot) {
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
    skills.map((skill) => ({
      name: skill.name,
      path: skill.skillPath.replace(/SKILL\.md$/, ""),
      description: skill.description,
    })),
    [
      { key: "name", title: "NAME" },
      { key: "path", title: "PATH" },
      { key: "description", title: "DESCRIPTION", flex: true },
    ]
  );
}

function resolveTargets(flags, { projectRoot, global }) {
  const requested = toArray(flags.agent);
  if (requested.includes("*")) return [canonicalDir(projectRoot, global)];

  if (requested.length === 0) {
    return detectAgents({ projectRoot, global }).then((agents) =>
      dedupeDirectories(
        agents.map((agent) => skillsDirFor(agent, { projectRoot, global }))
      )
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
