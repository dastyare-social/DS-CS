import fs from "node:fs/promises";
import path from "node:path";

import { MCP_TARGETS, buildMcpConfig } from "../mcp-config.mjs";
import { agentDirectories, resolveInstallTarget } from "../setup.mjs";
import { exists, ensureDir } from "../utils/fs.mjs";
import { bold, cyan, dim, log } from "../utils/log.mjs";
import { printAgents } from "./list.mjs";

const GITIGNORE_BLOCK = `# ds-cs
# Skills installed by \`ds-cs add\` are meant to be committed: they are project
# context, shared with the team, the same way source is. Add .agents/ here only
# if you want every agent's skills to stay local to one machine.
`;

/**
 * Prepare a project for DS-CS skills.
 *
 * Interactive: asks where to install, which agents read them, and how files are
 * shared. Non-interactive: flags and detection decide, so CI is unchanged.
 *
 * `init` deliberately installs no skills. A user who has not asked for a
 * specific one should not silently end up with forty in their repository.
 */
export async function initCommand(positional, flags, { projectRoot }) {
  if (flags.listAgents) {
    printAgents();
    return;
  }

  const target = await resolveInstallTarget(flags, { projectRoot });
  const { global, agents, copy } = target;

  const directories = agentDirectories(agents, { projectRoot, global });
  for (const directory of directories) {
    await ensureDir(directory);
  }

  const scopeLabel = global ? "global" : "project";
  log.success(`Skills will install to the ${bold(scopeLabel)} scope.`);
  for (const directory of directories) {
    const relative = display(directory);
    log.plain(`  ${cyan("→")} ${relative}`);
  }
  log.plain(dim(`  ${copy ? "copied into each agent" : "symlinked from one canonical copy"}`));

  if (!global) {
    await explainGitignore(projectRoot);
  }

  if (flags.mcp) {
    await writeMcpConfigs(projectRoot, flags);
  }

  log.plain("");
  log.plain(`Next: ${cyan("ds-cs add")} to install skills.`);
  log.plain(`  ${cyan("ds-cs add")}                    browse the DS-CS registry`);
  log.plain(`  ${cyan("ds-cs add brand-config")}         install one skill by name`);
  log.plain(`  ${cyan("ds-cs add owner/repo@skill")}     install from any GitHub skills repo`);
}

function display(target) {
  const relative = path.relative(process.cwd(), target);
  return relative === "" || relative.startsWith("..") ? target : relative;
}

/**
 * ds-cs skills are meant to be committed, so this writes no ignore rule by
 * default — it only leaves a comment explaining the choice, and warns if the
 * project already excludes them.
 */
async function explainGitignore(projectRoot) {
  const file = path.join(projectRoot, ".gitignore");

  if (!(await exists(file))) {
    await fs.writeFile(file, GITIGNORE_BLOCK, "utf8");
    log.success("Created .gitignore explaining that ds-cs skills are meant to be committed");
    return;
  }

  const existing = await fs.readFile(file, "utf8");
  if (/^\/?\.agents\/?\s*$/m.test(existing)) {
    log.warn(".gitignore excludes .agents — skills will not be shared with your team");
  }
}

async function writeMcpConfigs(projectRoot, flags) {
  const url = flags.url ?? "https://cs.dastyare.social";

  for (const target of MCP_TARGETS) {
    const file = path.join(projectRoot, target.file);
    if (await exists(file)) {
      log.warn(`Skipped ${display(file)} — it already exists`);
      continue;
    }

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      `${JSON.stringify(buildMcpConfig(target.agent, url, flags.apiKey), null, 2)}\n`,
      "utf8"
    );
    log.success(`MCP server "ds-cs" written to ${display(file)}`);
  }
}
