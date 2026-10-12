import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFrontmatter } from "../src/skills/frontmatter.mjs";
import { parseGithubShorthand, parseGithubUrl, isLocalPath } from "../src/registry/sources.mjs";
import { parseArgs, toArray } from "../src/args.mjs";
import { parseTarget, resolveRequest } from "../src/commands/target.mjs";
import { stripLeadingDirectory } from "../src/registry/archive.mjs";

test("parseFrontmatter reads name and description", () => {
  const source = `---
name: brand-config
description: Configure a channel's identity — username, name, bio.
---

# Body text
`;
  const parsed = parseFrontmatter(source);
  assert.equal(parsed.name, "brand-config");
  assert.equal(parsed.description, "Configure a channel's identity — username, name, bio.");
});

test("parseFrontmatter reads nested metadata.internal", () => {
  const source = `---
name: secret
description: Hidden until opted into.
metadata:
  internal: true
---
`;
  assert.equal(parseFrontmatter(source).internal, true);
});

test("parseFrontmatter strips quotes and coerces booleans", () => {
  const parsed = parseFrontmatter(`---\nname: "quoted"\ninternal: false\n---\n`);
  assert.equal(parsed.name, "quoted");
  assert.equal(parsed.internal, false);
});

test("parseFrontmatter returns an empty object when there is no header", () => {
  assert.deepEqual(parseFrontmatter("# Just markdown\n"), {});
});

test("parseGithubShorthand recognises owner/repo", () => {
  assert.deepEqual(parseGithubShorthand("emilkowalski/skill"), {
    owner: "emilkowalski",
    repo: "skill",
    subpath: null,
    ref: null,
  });
  assert.equal(parseGithubShorthand("not-a-repo"), null);
});

test("parseGithubUrl extracts ref and subpath from a tree URL", () => {
  const parsed = parseGithubUrl(
    "https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design"
  );
  assert.equal(parsed.owner, "vercel-labs");
  assert.equal(parsed.repo, "agent-skills");
  assert.equal(parsed.ref, "main");
  assert.equal(parsed.subpath, "skills/web-design");
});

test("parseGithubUrl ignores non-GitHub hosts", () => {
  assert.equal(parseGithubUrl("https://gitlab.com/org/repo"), null);
});

test("isLocalPath recognises paths that are not sources", () => {
  assert.equal(isLocalPath("./skills"), true);
  assert.equal(isLocalPath("/abs/path"), true);
  assert.equal(isLocalPath("owner/repo"), false);
});

test("parseTarget splits source@skill but not an ssh url's leading @", () => {
  assert.deepEqual(parseTarget("owner/repo@my-skill"), {
    source: "owner/repo",
    names: ["my-skill"],
    explicit: true,
  });

  // `git@github.com:owner/repo` has an @ but no skill names after it.
  const ssh = parseTarget("git@github.com:owner/repo");
  assert.equal(ssh.explicit, false);
});

test("parseTarget supports a comma-separated name list", () => {
  assert.deepEqual(parseTarget("owner/repo@a,b").names, ["a", "b"]);
});

test("resolveRequest treats bare names as DS-CS registry skills", () => {
  assert.deepEqual(resolveRequest(["brand-config", "webhooks"], {}), {
    source: "",
    names: ["brand-config", "webhooks"],
  });
});

test("resolveRequest treats owner/repo as a source", () => {
  assert.deepEqual(resolveRequest(["owner/repo", "my-skill"], {}), {
    source: "owner/repo",
    names: ["my-skill"],
  });
});

test("resolveRequest merges positional names with repeated --skill flags", () => {
  assert.deepEqual(resolveRequest(["a"], { skill: ["b", "c"] }), {
    source: "",
    names: ["a", "b", "c"],
  });
});

test("resolveRequest with no arguments defers to the interactive picker", () => {
  assert.deepEqual(resolveRequest([], { skill: "x" }), { source: "", names: ["x"] });
});

test("parseArgs handles long flags, inline values and aliases", () => {
  const { flags, positional } = parseArgs(["add", "--skill=a", "--agent", "cursor", "-y"]);
  assert.deepEqual(positional, ["add"]);
  assert.equal(flags.skill, "a");
  assert.equal(flags.agent, "cursor");
  assert.equal(flags.yes, true);
});

test("parseArgs collects repeatable flags into an array", () => {
  const { flags } = parseArgs(["-a", "cursor", "-a", "claude-code"]);
  assert.deepEqual(flags.agent, ["cursor", "claude-code"]);
});

test("parseArgs rejects a value flag with no value", () => {
  assert.throws(() => parseArgs(["--agent"]), /needs a value/);
});

test("toArray normalises a missing value to an empty list", () => {
  assert.deepEqual(toArray(undefined), []);
  assert.deepEqual(toArray("one"), ["one"]);
  assert.deepEqual(toArray(["one", "two"]), ["one", "two"]);
});

test("stripLeadingDirectory unwraps the GitHub tarball prefix", () => {
  const stripped = stripLeadingDirectory([
    { type: "file", name: "DS-CS-main/skills/a/SKILL.md" },
    { type: "file", name: "DS-CS-main/README.md" },
  ]);
  assert.deepEqual(
    stripped.map((entry) => entry.name),
    ["skills/a/SKILL.md", "README.md"]
  );
});

test("stripLeadingDirectory leaves a multi-root tree untouched", () => {
  // Ambiguous single-entry archives are not GitHub-shaped; the caller decides
  // to strip explicitly rather than the helper guessing from one entry.
  const entries = [
    { type: "file", name: "skills/a/SKILL.md" },
    { type: "file", name: "other/b.md" },
  ];
  assert.deepEqual(stripLeadingDirectory(entries), entries);
});

test("parseTarget keeps an ssh remote intact", () => {
  const parsed = parseTarget("git@github.com:owner/repo");
  assert.equal(parsed.explicit, false);
  assert.equal(parsed.source, "git@github.com:owner/repo");
});
