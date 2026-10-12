import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

const execFileAsync = promisify(execFile);

/**
 * Extraction limits. A skills repo is a folder of markdown; anything hitting
 * these is a supply-chain problem, not a legitimate source.
 */
export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 1000;

/**
 * Resolve `entryPath` inside `destDir`, refusing anything that escapes it.
 *
 * Without this, a crafted archive containing `../../../.ssh/authorized_keys`
 * would write outside the cache during `ds-cs add`. Absolute paths and parent
 * traversal are rejected outright rather than normalised, so a suspicious
 * archive fails loudly instead of silently landing somewhere unexpected.
 */
function safeJoin(destDir, entryPath) {
  if (entryPath.startsWith("/") || entryPath.startsWith("\\") || /^[a-zA-Z]:/.test(entryPath)) {
    throw new Error(`Refusing absolute path in archive: ${entryPath}`);
  }
  if (entryPath.split(/[\\/]/).includes("..")) {
    throw new Error(`Refusing parent traversal in archive: ${entryPath}`);
  }
  const resolved = path.resolve(destDir, entryPath);
  const root = path.resolve(destDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing path outside of the extraction directory: ${entryPath}`);
  }
  return resolved;
}

/**
 * Strip the single top-level directory that GitHub wraps tarballs in
 * (`DS-CS-main/…`), so the extraction root looks like a normal checkout.
 *
 * Only correct for GitHub-shaped archives — ones where every entry shares one
 * root. It is used exclusively via `extractTarGz`'s explicit `strip` option,
 * where the caller already knows it downloaded that shape, rather than as a
 * general guess applied to arbitrary archives.
 */
export function stripLeadingDirectory(entries) {
  const roots = new Set(entries.map((entry) => entry.name.split("/")[0]).filter(Boolean));
  if (roots.size !== 1) return entries;

  const [prefix] = [...roots];
  return entries
    .filter((entry) => entry.name !== prefix)
    .map((entry) => ({ ...entry, name: entry.name.slice(prefix.length + 1) }))
    .filter((entry) => entry.name.length > 0);
}

/**
 * Entries that are archive noise rather than content.
 *
 * macOS `tar` writes AppleDouble sidecars (`._SKILL.md`) next to every real
 * file to carry extended attributes. They are harmless in isolation and actively
 * harmful here: they would land in installed skills and change a skill's hash
 * when a user re-archives the same source, making `ds-cs update` claim a change
 * that never happened upstream.
 */
function isArchiveNoise(name) {
  const base = name.split("/").pop() ?? name;
  return base === ".DS_Store" || base.startsWith("._");
}

async function writeEntries(destDir, entries) {
  let directories = 0;
  let files = 0;
  for (const entry of entries) {
    if (isArchiveNoise(entry.name)) continue;

    if (entry.type === "directory") {
      await fs.mkdir(safeJoin(destDir, entry.name), { recursive: true });
      directories += 1;
    } else if (entry.type === "file") {
      const target = safeJoin(destDir, entry.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.data);
      files += 1;
    } else if (entry.type === "symlink") {
      // Symlinks in an archive are a classic escape vector and skills never
      // need them; link targets are dropped rather than written.
      continue;
    }
    if (files > MAX_FILES || directories > MAX_FILES) {
      throw new Error(`Archive contains more than ${MAX_FILES} entries`);
    }
  }
}

/**
 * Minimal ustar reader. GitHub tarballs are plain ustar, so this avoids both a
 * dependency and the `tar` binary — which keeps `ds-cs` working identically on
 * platforms that do not ship one.
 */
function parseTar(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    // Two consecutive zero blocks terminate the archive.
    if (header.every((byte) => byte === 0)) break;

    const readString = (start, length) =>
      header.subarray(start, start + length).toString("utf8").replace(/\0.*$/, "").trim();
    const readOctal = (start, length) => {
      const raw = readString(start, length);
      return raw ? parseInt(raw, 8) : 0;
    };

    const mode = readString(100, 8);
    const size = readOctal(124, 12);
    const typeFlag = String.fromCharCode(header[156]) || "0";
    const prefix = readString(345, 155);
    const longName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");

    const fullName = prefix ? `${prefix}/${longName}` : longName;
    offset += 512;

    const data = buffer.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    const normalized = fullName.replace(/^\.\//, "").replace(/\/+$/, "");
    if (!normalized || normalized === ".") continue;

    if (typeFlag === "5") {
      entries.push({ type: "directory", name: normalized, mode });
    } else if (typeFlag === "0" || typeFlag === "\0" || typeFlag === "7") {
      entries.push({ type: "file", name: normalized, data, mode });
    } else if (typeFlag === "2") {
      entries.push({ type: "symlink", name: normalized, target: data.toString("utf8").replace(/\0.*$/, "") });
    }
  }

  return entries;
}

async function hasSystemTar() {
  try {
    await execFileAsync("tar", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function extractTarGz(buffer, destDir, { strip = 0 } = {}) {
  if (buffer.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`Archive is larger than the ${MAX_ARCHIVE_BYTES / 1024 / 1024}MB limit`);
  }

  let entries;
  try {
    entries = parseTar(zlib.gunzipSync(buffer));
  } catch {
    // Some registries serve a tarball with a non-gzip content type.
    entries = parseTar(buffer);
  }

  for (let index = 0; index < strip; index += 1) {
    entries = stripLeadingDirectory(entries);
  }

  await fs.mkdir(destDir, { recursive: true });
  await writeEntries(destDir, entries);
  return entries.length;
}

export async function extractZip(buffer, destDir) {
  if (buffer.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`Archive is larger than the ${MAX_ARCHIVE_BYTES / 1024 / 1024}MB limit`);
  }
  if (!(await hasSystemTar())) {
    throw new Error("Extracting .zip archives requires the `tar` binary to be available");
  }

  await fs.mkdir(destDir, { recursive: true });
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), "ds-cs-zip-"));
  try {
    const archive = path.join(staging, "archive.zip");
    await fs.writeFile(archive, buffer);
    await execFileAsync("tar", ["-xf", archive, "-C", staging]);
    await fs.rm(archive);
    // bsdtar extracts a single top-level directory when the zip has one.
    await fs.cp(staging, destDir, { recursive: true });
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export async function extractBuffer(buffer, filename, destDir, options) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return extractZip(buffer, destDir, options);
  if (lower.endsWith(".tar") || lower.endsWith(".tgz") || lower.endsWith(".tar.gz")) {
    return extractTarGz(buffer, destDir, options);
  }
  throw new Error(
    `Unsupported archive type for "${filename}" (expected .zip, .tar, .tar.gz or .tgz)`
  );
}
