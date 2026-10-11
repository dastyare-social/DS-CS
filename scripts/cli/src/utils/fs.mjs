import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(target) {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function isFile(target) {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

export async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/** Write JSON with a trailing newline, creating parent directories as needed. */
export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const IGNORED_ENTRIES = new Set([".DS_Store", "node_modules", ".git"]);

/**
 * Recursively list files under `dir`, returning paths relative to `dir` and
 * sorted so hashes and diffs are stable across machines.
 */
export async function listFiles(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED_ENTRIES.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, base)));
    } else if (entry.isFile()) {
      files.push(path.relative(base, absolute));
    }
  }
  return files.sort();
}

/**
 * Content hash of a skill directory. Covers relative paths and file contents,
 * so a rename or an added reference file changes the hash — which is what makes
 * `ds-cs update` able to detect an upstream change.
 */
export async function hashDirectory(dir) {
  const hash = crypto.createHash("sha256");
  for (const file of await listFiles(dir)) {
    hash.update(file);
    hash.update("\0");
    hash.update(await fs.readFile(path.join(dir, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function copyDirectory(from, to) {
  await ensureDir(to);
  for (const file of await listFiles(from)) {
    const target = path.join(to, file);
    await ensureDir(path.dirname(target));
    await fs.copyFile(path.join(from, file), target);
  }
}

export async function removeDirectory(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Resolve `maybeRelative` against `base` only if it is not already absolute. */
export function resolveFrom(base, maybeRelative) {
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(base, maybeRelative);
}
