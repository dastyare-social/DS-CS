#!/usr/bin/env node
/**
 * Copy the repository's `skills/` registry into this package so it ships with
 * the CLI.
 *
 * The registry is the source of truth at the repo root; this is a build artifact
 * of it, regenerated on `prepack`. Baking it in means `ds-cs add` works offline,
 * with no network round-trip, and always matches the CLI version the user has —
 * rather than resolving against whatever `main` happens to be today.
 *
 * Run directly to refresh without publishing: `node scripts/sync-skills.mjs`
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(packageRoot, "..", "..", "skills");
const destination = path.join(packageRoot, "skills");

async function copyTree(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of (await fs.readdir(from, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) continue;
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyTree(fromPath, toPath);
    } else if (entry.isFile()) {
      await fs.copyFile(fromPath, toPath);
    }
  }
}

async function main() {
  if (!(await exists(source))) {
    console.error(`sync-skills: no skills directory at ${source}`);
    process.exitCode = 1;
    return;
  }

  await fs.rm(destination, { recursive: true, force: true });
  await copyTree(source, destination);

  const count = await countSkills(destination);
  console.log(`sync-skills: copied ${count} skills → ${path.relative(packageRoot, destination)}/`);
}

async function countSkills(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      total += await countSkills(path.join(dir, entry.name));
    } else if (entry.name === "SKILL.md") {
      total += 1;
    }
  }
  return total;
}

async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

await main();
