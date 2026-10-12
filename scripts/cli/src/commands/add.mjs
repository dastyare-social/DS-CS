import path from "node:path";

import { dedupeDirectories } from "../agents.mjs";
import { installSkills } from "../install.mjs";
import { lockfilePath } from "../lockfile.mjs";
import { agentDirectories, resolveInstallTarget } from "../setup.mjs";
import { discoverSkills } from "../skills/discover.mjs";
import { resolveSource } from "../registry/sources.mjs";
import { cyan, dim, log, table } from "../utils/log.mjs";
import { isInteractive } from "../utils/prompt.mjs";
import { resolveRequest } from "./target.mjs";

export async function addCommand(positional, flags, { projectRoot }) {
  const { source, names } = resolveRequest(positional, flags);

  // `ds-cs add` on its own means "show me what there is": the searchable picker
  // on a terminal, a plain listing without one. Erroring on a missing TTY would
  // make the documented "browse everything" form fail in exactly the places
  // people run it — CI, a pipe, an agent shell.
  const browsing = flags.list || (names.length === 0 && !isInteractive());
  if (browsing) {
    await listSource(source, projectRoot);
    return;
  }

  const target = await resolveInstallTarget(flags, { projectRoot });
  const directories = dedupeDirectories(
    agentDirectories(target.agents, { projectRoot, global: target.global })
  );

  const { installed, resolved } = await installSkills({
    source,
    names,
    projectRoot,
    targets: directories,
    global: target.global,
    copy: target.copy,
    interactive: target.interactive,
  });

  log.success(
    `Installed ${installed.length} skill${installed.length === 1 ? "" : "s"} from ${resolved.describe()}`
  );

  for (const entry of installed) {
    log.plain(`  ${cyan(entry.skill.name)}  ${entry.skill.description}`);
    log.plain(`    ${display(entry.destination)}`);
    for (const link of entry.links) {
      log.plain(
        `    → ${display(link.target)} (${link.linked ? "linked" : "copied — symlinks unavailable"})`
      );
    }
  }

  log.plain("");
  log.plain(
    dim(
      `  Recorded in ${display(lockfilePath(projectRoot))}${target.global ? dim("  (global install)") : ""}`
    )
  );
}

function display(target) {
  const relative = path.relative(process.cwd(), target);
  return relative === "" || relative.startsWith("..") ? target : relative;
}

async function listSource(sourceSpec, projectRoot) {
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
  log.plain("");
  log.plain(dim("  Install one or more:  ds-cs add <name> [name…]  ·  browse interactively:  ds-cs add"));
}
