import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { CliError } from "../utils/errors.mjs";
import { isDirectory } from "../utils/fs.mjs";
import { extractBuffer, extractTarGz } from "./archive.mjs";
import { cachedBuffer, fetchBuffer, fetchJson, fetchText } from "./fetch.mjs";

const execFileAsync = promisify(execFile);

/** The first-party registry. Skills ship from the DS-CS repo's `skills/` dir. */
export const DS_CS_REPO = "dastyare-social/DS-CS";
export const DS_CS_REF = "main";
export const DS_CS_SKILLS_DIR = "skills";

export const SOURCE_TYPES = {
  DS_CS: "ds-cs",
  GITHUB: "github",
  GIT: "git",
  URL: "url",
  LOCAL: "local",
};

function hashKey(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/** Relative when that is readable, absolute when it would be a chain of `../`. */
function readable(target) {
  const relative = path.relative(process.cwd(), target);
  return relative === "" || relative.startsWith("..") ? target : relative;
}

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "ds-cs-src-"));
}

/* -------------------------------------------------------------------------- */
/* First-party registry                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Where the registry can be found inside this package.
 *
 * Two layouts have to work. In a DS-CS checkout the CLI lives at
 * `scripts/cli/src/registry/`, so the registry is the repo root's `skills/`.
 * Published to npm, `sync-skills` copies the registry to `scripts/cli/skills/`
 * so it travels inside the package. Both are checked against the package root,
 * cheapest first.
 */
function bundledRegistryRoots() {
  // `../..` from src/registry/ is the package root in both layouts.
  const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
  return [
    path.join(packageRoot, "skills"), // published layout: <pkg>/skills
    path.resolve(packageRoot, "..", "..", "skills"), // checkout: <repo>/skills
  ];
}

/** Walk up from `cwd` looking for a DS-CS checkout that ships a `skills/` dir. */
async function findLocalCheckout(cwd) {
  let directory = path.resolve(cwd);
  for (let depth = 0; depth < 6; depth += 1) {
    const skills = path.join(directory, DS_CS_SKILLS_DIR);
    if (await isDirectory(skills)) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

/**
 * Fetch only the `skills/` subtree of the DS-CS repository.
 *
 * The full repo tarball is ~28MB — almost all of it `public/` and generated
 * assets — to read a handful of markdown files. Listing the tree once and
 * pulling just the registry's files keeps the fallback under a megabyte, and
 * keeps it working under the archive size limit.
 */
async function fetchRegistrySubtree(ref) {
  const listing = await fetchJson(
    `https://api.github.com/repos/${DS_CS_REPO}/git/trees/${ref}?recursive=1`
  );

  if (!Array.isArray(listing.tree)) {
    throw new CliError(`GitHub returned no tree for ${DS_CS_REPO}@${ref}`, {
      hint: "The branch may not exist, or the API rate limit may be reached.",
    });
  }

  const wanted = listing.tree.filter(
    (node) =>
      node.type === "blob" &&
      node.path.startsWith(`${DS_CS_SKILLS_DIR}/`) &&
      // Skip build artefacts that would otherwise ride along in the registry.
      !node.path.endsWith("/.DS_Store") &&
      !path.posix.basename(node.path).startsWith("._")
  );

  if (wanted.length === 0) {
    throw new CliError(`No ${DS_CS_SKILLS_DIR}/ directory at ${DS_CS_REPO}@${ref}`);
  }

  const extraction = await makeTempDir();
  for (const node of wanted) {
    const target = path.join(extraction, node.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const body = await fetchText(
      `https://raw.githubusercontent.com/${DS_CS_REPO}/${ref}/${node.path}`
    );
    await fs.writeFile(target, body);
  }

  return { root: extraction, fileCount: wanted.length };
}

/**
 * Resolve the DS-CS registry to a directory of skills.
 *
 * Order matters, and each step exists for a reason:
 *
 *  1. A local checkout — so editing a skill in the repo and reinstalling it
 *     works, instead of resolving against whatever `main` says.
 *  2. The copy bundled in this package — works offline, matches the CLI
 *     version the user actually has, and needs no network at all.
 *  3. GitHub — a last resort for a CLI older than the skills it wants.
 */
export async function resolveDsCs({ cwd, preferLocal = true }) {
  if (preferLocal) {
    const localRoot = await findLocalCheckout(cwd);
    if (localRoot) {
      return {
        id: DS_CS_REPO,
        type: SOURCE_TYPES.DS_CS,
        root: localRoot,
        origin: "local",
        describe: () => `${DS_CS_REPO} (local checkout at ${readable(localRoot)})`,
      };
    }
  }

  for (const bundled of bundledRegistryRoots()) {
    if (await isDirectory(bundled)) {
      return {
        id: DS_CS_REPO,
        type: SOURCE_TYPES.DS_CS,
        root: path.resolve(bundled, ".."),
        origin: "bundled",
        describe: () => `${DS_CS_REPO} (bundled with this CLI)`,
      };
    }
  }

  const { root, fileCount } = await fetchRegistrySubtree(DS_CS_REF);
  return {
    id: DS_CS_REPO,
    type: SOURCE_TYPES.DS_CS,
    root,
    origin: "remote",
    describe: () => `${DS_CS_REPO}@${DS_CS_REF} (${fileCount} files)`,
  };
}

/* -------------------------------------------------------------------------- */
/* GitHub                                                                     */
/* -------------------------------------------------------------------------- */

export function parseGithubShorthand(spec) {
  const match = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/.exec(spec);
  return match ? { owner: match[1], repo: match[2], subpath: null, ref: null } : null;
}

export function parseGithubUrl(spec) {
  let url;
  try {
    url = new URL(spec);
  } catch {
    return null;
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;

  const segments = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [owner, repo] = segments;
  let ref = null;
  let subpath = null;

  if (segments[2] === "tree" && segments[3]) {
    ref = segments[3];
    subpath = segments.slice(4).join("/") || null;
  }

  return { owner, repo, subpath, ref };
}

/**
 * Fetch a GitHub repository as a tarball.
 *
 * Deliberately not `git clone`: a tarball is one HTTP request, needs no git
 * binary, and cannot run a repository's hooks. Branches and tags both resolve
 * through `refs/heads` / `refs/tags`.
 */
export async function resolveGithub({ owner, repo, ref, subpath }, spec) {
  const resolvedRef = ref ?? "main";
  const headRef = resolvedRef.includes("/") ? `heads/${resolvedRef}` : `heads/${resolvedRef}`;
  const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/${headRef}`;

  let buffer;
  try {
    buffer = await cachedBuffer(url, hashKey(url));
  } catch (error) {
    throw new CliError(`Could not fetch ${owner}/${repo}@${resolvedRef} from GitHub`, {
      hint: "Check the branch exists, or set GITHUB_TOKEN for a private repository.",
      cause: error,
    });
  }

  const extraction = await makeTempDir();
  await extractTarGz(buffer, extraction, { strip: 1 });

  const root = subpath ? path.join(extraction, subpath) : extraction;
  if (!(await isDirectory(root))) {
    throw new CliError(`${owner}/${repo} has no "${subpath}" directory`, {
      hint: "Check the path in the /tree/<ref>/<path> URL.",
    });
  }

  return {
    id: spec ?? `${owner}/${repo}`,
    type: SOURCE_TYPES.GITHUB,
    root,
    origin: "remote",
    describe: () => `${owner}/${repo}@${resolvedRef}${subpath ? `/${subpath}` : ""}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Git                                                                        */
/* -------------------------------------------------------------------------- */

export function isGitUrl(spec) {
  return /^(git@|git:\/\/|ssh:\/\/|git\+)/.test(spec) || /^https?:\/\//.test(spec);
}

/** Clone is only reached for non-GitHub git hosts, where no tarball API exists. */
export async function resolveGit(spec) {
  const staging = await makeTempDir();
  try {
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      "--quiet",
      spec,
      path.join(staging, "repo"),
    ]);
  } catch (error) {
    throw new CliError(`git clone failed for ${spec}`, {
      hint: "Git must be installed, and credentials configured for private remotes.",
      cause: error,
    });
  }
  return {
    id: spec,
    type: SOURCE_TYPES.GIT,
    root: path.join(staging, "repo"),
    origin: "remote",
    describe: () => spec,
  };
}

/* -------------------------------------------------------------------------- */
/* Direct URLs                                                                */
/* -------------------------------------------------------------------------- */

const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz"];

function looksLikeArchive(url) {
  const pathName = new URL(url).pathname.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((extension) => pathName.endsWith(extension));
}

/**
 * A URL is either a single SKILL.md or an archive of a skill tree. The body is
 * sniffed rather than trusted: a `.md` URL that returns HTML is an error page,
 * and treating it as a skill would install a file with no frontmatter.
 */
export async function resolveUrl(spec) {
  const buffer = await fetchBuffer(spec);
  const isArchive = looksLikeArchive(spec);
  const isBinary =
    buffer.includes(0x50) && buffer.includes(0x4b) && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (isArchive || isBinary) {
    const staging = await makeTempDir();
    const filename = new URL(spec).pathname.split("/").pop() || "archive.zip";
    await extractBuffer(buffer, filename, staging, { strip: 1 });
    return {
      id: spec,
      type: SOURCE_TYPES.URL,
      root: staging,
      origin: "remote",
      describe: () => spec,
    };
  }

  const body = buffer.toString("utf8");
  if (!/^---\r?\n/.test(body)) {
    throw new CliError(`${spec} does not look like a SKILL.md or a skills archive`, {
      hint: "The URL must serve a SKILL.md, or a .zip / .tar.gz archive of one.",
    });
  }

  const skillDir = await makeTempDir();
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), body);
  return {
    id: spec,
    type: SOURCE_TYPES.URL,
    root: skillDir,
    origin: "remote",
    describe: () => spec,
  };
}

/* -------------------------------------------------------------------------- */
/* Local                                                                      */
/* -------------------------------------------------------------------------- */

export async function resolveLocal(spec) {
  const expanded = spec.startsWith("~") ? path.join(os.homedir(), spec.slice(1)) : spec;
  const root = path.resolve(process.cwd(), expanded);
  if (!(await isDirectory(root))) {
    throw new CliError(`Local skill path does not exist: ${root}`);
  }
  return {
    id: spec,
    type: SOURCE_TYPES.LOCAL,
    root,
    origin: "local",
    describe: () => readable(root),
  };
}

/* -------------------------------------------------------------------------- */
/* Dispatch                                                                   */
/* -------------------------------------------------------------------------- */

export function isLocalPath(spec) {
  return (
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.startsWith("~") ||
    spec.startsWith("file://")
  );
}

/**
 * Turn a source spec into a materialised directory of skills.
 *
 * An empty spec means the DS-CS registry, which is what makes the common case
 * (`ds-cs add brand-config`) work with no ceremony.
 */
export async function resolveSource(spec, { cwd = process.cwd(), preferLocal = true } = {}) {
  const trimmed = (spec ?? "").trim();

  if (trimmed === "" || trimmed === "ds-cs" || trimmed === "@ds-cs") {
    return resolveDsCs({ cwd, preferLocal });
  }

  if (isLocalPath(trimmed)) {
    return resolveLocal(trimmed.replace(/^file:\/\//, ""));
  }

  const github = trimmed.startsWith("http")
    ? parseGithubUrl(trimmed)
    : parseGithubShorthand(trimmed);

  if (github) {
    return resolveGithub(github, trimmed.startsWith("http") ? trimmed : trimmed);
  }

  if (isGitUrl(trimmed)) {
    return resolveGit(trimmed);
  }

  return resolveUrl(trimmed);
}
