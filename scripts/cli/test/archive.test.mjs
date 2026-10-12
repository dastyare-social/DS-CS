import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

import { extractTarGz, MAX_ARCHIVE_BYTES } from "../src/registry/archive.mjs";
import { hashDirectory, listFiles } from "../src/utils/fs.mjs";
import { discoverSkills, listInstalledSkills } from "../src/skills/discover.mjs";

const execFileAsync = promisify(execFile);

async function scratch() {
  return fs.mkdtemp(path.join(os.tmpdir(), "ds-cs-test-"));
}

test("extractTarGz round-trips a real gzipped tarball", async () => {
  const work = await scratch();
  const source = path.join(work, "repo");
  const skillDir = path.join(source, "skills", "demo");

  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    "---\nname: demo\ndescription: A demo skill.\n---\n\nBody\n"
  );
  await fs.writeFile(path.join(skillDir, "REFERENCE.md"), "reference\n");
  await fs.mkdir(path.join(skillDir, "nested", "deep"), { recursive: true });
  await fs.writeFile(path.join(skillDir, "nested", "deep", "file.txt"), "deep\n");

  const archive = path.join(work, "repo.tar.gz");
  await execFileAsync("tar", ["czf", archive, "-C", source, "."]);

  const buffer = await fs.readFile(archive);
  const dest = path.join(work, "out");
  await extractTarGz(buffer, dest);

  assert.equal(
    await fs.readFile(path.join(dest, "skills/demo/SKILL.md"), "utf8"),
    "---\nname: demo\ndescription: A demo skill.\n---\n\nBody\n"
  );
  assert.equal(
    await fs.readFile(path.join(dest, "skills/demo/nested/deep/file.txt"), "utf8"),
    "deep\n"
  );

  // listFiles must skip .DS_Store so a stray file does not change a skill hash,
  // and it sorts by locale so ordering is stable across machines.
  assert.deepEqual(await listFiles(dest), [
    "skills/demo/REFERENCE.md",
    "skills/demo/SKILL.md",
    "skills/demo/nested/deep/file.txt",
  ]);
});

test("extractTarGz refuses an oversized archive", async () => {
  const dest = await scratch();
  const oversized = Buffer.alloc(MAX_ARCHIVE_BYTES + 1);
  await assert.rejects(() => extractTarGz(oversized, dest), /larger than/);
});

test("extractTarGz rejects parent traversal instead of writing outside dest", async () => {
  // Hand-build a tar whose entry name escapes the extraction directory. This is
  // the zip-slip shape; a registry is untrusted input.
  const header = Buffer.alloc(512);
  header.write("../escaped.txt", 0, "utf8");
  header.write("0000644\0", 100, "utf8");
  header.write("0000000\0", 108, "utf8");
  header.write("0000000\0", 116, "utf8");
  header.write("0000010\0", 124, "utf8"); // size 8 octal
  header.write("00000000000\0", 136, "utf8");
  header.write("0", 156, "utf8"); // regular file
  header.write("ustar\0", 257, "utf8");

  const payload = Buffer.from("escaped\n");
  const archive = Buffer.concat([header, payload, Buffer.alloc(512)]);

  const dest = await scratch();
  await assert.rejects(
    () => extractTarGz(zlib.gzipSync(archive), dest),
    /parent traversal|outside of the extraction directory/
  );
});

test("discoverSkills finds skills under a skills/ container", async () => {
  const root = await scratch();
  for (const name of ["alpha", "beta"]) {
    const dir = path.join(root, "skills", name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: Skill ${name}.\n---\n`
    );
  }

  const skills = await discoverSkills(root);
  assert.deepEqual(
    skills.map((skill) => skill.name),
    ["alpha", "beta"]
  );
  assert.equal(skills[0].skillPath, "skills/alpha/SKILL.md");
});

test("discoverSkills does not descend into a skill's own reference files", async () => {
  const root = await scratch();
  const dir = path.join(root, "skills", "parent");
  await fs.mkdir(path.join(dir, "examples", "inner"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "SKILL.md"),
    "---\nname: parent\ndescription: A skill with examples.\n---\n"
  );
  await fs.writeFile(
    path.join(dir, "examples", "inner", "SKILL.md"),
    "---\nname: inner\ndescription: Should not be discovered.\n---\n"
  );

  const skills = await discoverSkills(root);
  assert.deepEqual(
    skills.map((skill) => skill.name),
    ["parent"]
  );
});

test("hashDirectory changes when content, path or file count changes", async () => {
  const build = async (dir, mutate) => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "SKILL.md"), "---\nname: a\ndescription: b\n---\n");
    await mutate(dir);
    return hashDirectory(dir);
  };

  const base = await scratch();
  const first = await build(base, async () => {});
  const same = await build(base, async () => {});
  assert.equal(first, same, "identical content hashes identically");

  const changed = await build(base, async (dir) => {
    await fs.writeFile(path.join(dir, "SKILL.md"), "---\nname: a\ndescription: c\n---\n");
  });
  assert.notEqual(first, changed, "edited content changes the hash");

  const added = await build(base, async (dir) => {
    await fs.writeFile(path.join(dir, "EXTRA.md"), "new reference\n");
  });
  assert.notEqual(first, added, "an added reference file changes the hash");

  const ignored = await build(base, async (dir) => {
    await fs.writeFile(path.join(dir, ".DS_Store"), "noise\n");
  });
  assert.equal(first, ignored, ".DS_Store does not change the hash");
});

test("listInstalledSkills reads skills one level down", async () => {
  // The installed directory *is* the skills container, so source-tree discovery
  // would look for containers inside itself and find nothing.
  const dir = await scratch();
  const skill = path.join(dir, "installed");
  await fs.mkdir(skill, { recursive: true });
  await fs.writeFile(
    path.join(skill, "SKILL.md"),
    "---\nname: installed\ndescription: Already on disk.\n---\n"
  );

  const skills = await listInstalledSkills(dir);
  assert.deepEqual(
    skills.map((entry) => entry.name),
    ["installed"]
  );
  assert.equal(skills[0].skillPath, "installed/SKILL.md");
});

test("listInstalledSkills skips a directory that is not a skill", async () => {
  const dir = await scratch();
  await fs.mkdir(path.join(dir, "not-a-skill"), { recursive: true });
  await fs.writeFile(path.join(dir, "not-a-skill", "README.md"), "hello\n");
  await fs.mkdir(path.join(dir, "broken"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "broken", "SKILL.md"),
    "# no frontmatter here\n"
  );

  // A directory whose SKILL.md has no frontmatter is unaddressable, so it must
  // be skipped rather than crash the inventory.
  assert.deepEqual(await listInstalledSkills(dir), []);
});
