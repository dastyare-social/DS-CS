import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CliError } from "./utils/errors.mjs";
import { exists } from "./utils/fs.mjs";

/**
 * Channel credentials live in one JSON file outside the project, with owner-only
 * permissions.
 *
 * Keeping them out of the repo is the point: `ds-cs login` stores a key that can
 * create and delete content, and a project-local config is one `git add -A` away
 * from being published.
 */
export function configPath() {
  const base =
    process.env.DS_CS_CONFIG_DIR ??
    (process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, "ds-cs")
      : path.join(os.homedir(), ".config", "ds-cs"));
  return path.join(base, "auth.json");
}

export async function readAuth() {
  const file = configPath();
  if (!(await exists(file))) return { baseUrl: null, apiKey: null, loggedInAt: null };
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      baseUrl: parsed.baseUrl ?? null,
      apiKey: parsed.apiKey ?? null,
      loggedInAt: parsed.loggedInAt ?? null,
    };
  } catch (error) {
    throw new CliError(`Auth config at ${file} is not valid JSON`, {
      hint: "Run `ds-cs logout` to clear it.",
      cause: error,
    });
  }
}

export async function writeAuth({ baseUrl, apiKey }) {
  const file = configPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify({ baseUrl, apiKey, loggedInAt: new Date().toISOString() }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
  // Write with the mode, but also force it: an existing file keeps its old bits
  // across a rewrite on some platforms.
  await fs.chmod(file, 0o600).catch(() => {});
  return file;
}

export async function clearAuth() {
  const file = configPath();
  if (!(await exists(file))) return false;
  await fs.rm(file);
  return true;
}

/** Resolve the channel URL for a command: flag, then stored login, then env. */
export async function resolveTarget({ url: urlFlag } = {}) {
  const stored = await readAuth();
  const baseUrl = (urlFlag ?? stored.baseUrl ?? process.env.DS_CS_URL ?? "").trim();
  const apiKey = (stored.apiKey ?? process.env.DS_CS_API_KEY ?? "").trim();

  if (!baseUrl) {
    throw new CliError("No channel URL configured", {
      hint: "Run `ds-cs login --url https://your-channel.com --api-key <key>`, or pass --url.",
    });
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, stored };
}

export function redact(apiKey) {
  if (!apiKey) return "";
  return apiKey.length <= 8 ? "***" : `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}
