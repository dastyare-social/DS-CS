import fs from "node:fs/promises";
import path from "node:path";

import { parseArgs } from "./args.mjs";
import { addCommand } from "./commands/add.mjs";
import { loginCommand, logoutCommand, whoamiCommand } from "./commands/auth.mjs";
import { initCommand } from "./commands/init.mjs";
import { listCommand } from "./commands/list.mjs";
import { mcpCommand } from "./commands/mcp.mjs";
import { removeCommand } from "./commands/remove.mjs";
import { searchCommand } from "./commands/search.mjs";
import { updateCommand } from "./commands/update.mjs";
import { CliError } from "./utils/errors.mjs";
import { bold, log } from "./utils/log.mjs";

const COMMANDS = [
  "init",
  "add",
  "list",
  "update",
  "remove",
  "search",
  "mcp",
  "login",
  "whoami",
  "logout",
];

const VERSION = await readVersion();

const USAGE = `${bold("ds-cs")} — skills and tooling for Dastyare Social — CS

${bold("Usage")}
  ds-cs <command> [options]

${bold("Commands")}
  init [dir]              Prepare a project for DS-CS skills
  add <skill|source>      Install skills from DS-CS or any skills repo
  list                    Show installed skills and their sources
  update [skill…]         Re-fetch installed skills that changed
  remove <skill…>         Uninstall skills
  search [query]          Search installed skills
  mcp [agent]             Print (or write) MCP server config for a channel
  login                   Store a channel URL + API key
  whoami                  Show the stored channel
  logout                  Remove stored credentials

${bold("Sources")}
  ds-cs add brand-config               from the DS-CS registry (default)
  ds-cs add owner/repo                 from a GitHub repo
  ds-cs add owner/repo@skill           pick one skill from that repo
  ds-cs add ./my-skills                from a local directory
  ds-cs add https://…/SKILL.md         from a direct URL

${bold("Options")}
  -s, --skill <name>    Install/remove this skill (repeatable, '*' for all)
  -a, --agent <name>    Target agent, or a directory path starting with . or /
  -g, --global          Install into the user directory instead of the project
      --copy            Copy files instead of symlinking between agents
  -y, --yes             Non-interactive; accept defaults
      --list            List what a source offers instead of installing
      --url <url>       Channel URL (login, mcp, init)
      --api-key <key>   Channel API key (login, mcp, init)
  -h, --help            Show this help
  -v, --version         Print the CLI version

${bold("Examples")}
  ds-cs init --mcp
  ds-cs add post-with-media
  ds-cs add emilkowalski/skill@animate -a opencode
  ds-cs login --url https://cs.example.com --api-key $KEY
  ds-cs mcp claude-code > claude-mcp.json

${bold("Environment")}
  DS_CS_URL, DS_CS_API_KEY      used instead of a stored login
  DS_CS_CONFIG_DIR              where credentials are stored
  GITHUB_TOKEN / GH_TOKEN       for private skill repos
`;

async function readVersion() {
  try {
    const file = new URL("../package.json", import.meta.url);
    return JSON.parse(await fs.readFile(file, "utf8")).version;
  } catch {
    return "0.0.0";
  }
}

/**
 * Find the project root by walking up for a VCS or package marker.
 *
 * Skills and the lockfile are project-scoped, so a `ds-cs add` run from a nested
 * directory must land in the same place as one run from the root — otherwise the
 * lockfile and the installed skills drift apart.
 */
async function findProjectRoot(startDir) {
  let directory = path.resolve(startDir);
  for (let depth = 0; depth < 20; depth += 1) {
    const markers = [".git", "skills-lock.json", "package.json"];
    for (const marker of markers) {
      try {
        await fs.stat(path.join(directory, marker));
        return directory;
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return path.resolve(startDir);
}

export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    throw new CliError(error.message, { hint: "Run `ds-cs --help`." });
  }

  const { flags, positional } = parsed;

  if (flags.version) {
    log.plain(VERSION);
    return;
  }

  const command = positional.shift();

  if (!command || flags.help) {
    log.plain(USAGE);
    return;
  }

  if (command === "help") {
    log.plain(USAGE);
    return;
  }

  const projectRoot = await findProjectRoot(flags.cwd ?? process.cwd());
  const context = { projectRoot, version: VERSION };

  switch (command) {
    case "init":
      return initCommand(positional, flags, context);
    case "add":
      return addCommand(positional, flags, context);
    case "list":
    case "ls":
      return listCommand(positional, flags, context);
    case "update":
    case "upgrade":
      return updateCommand(positional, flags, context);
    case "remove":
    case "rm":
    case "uninstall":
      return removeCommand(positional, flags, context);
    case "search":
    case "find":
      return searchCommand(positional, flags, context);
    case "mcp":
      return mcpCommand(positional, flags, context);
    case "login":
      return loginCommand(positional, flags, context);
    case "whoami":
      return whoamiCommand(positional, flags, context);
    case "logout":
      return logoutCommand(positional, flags, context);
    default:
      throw new CliError(`Unknown command "${command}"`, {
        hint: `Did you mean one of: ${COMMANDS.join(", ")}?`,
      });
  }
}
