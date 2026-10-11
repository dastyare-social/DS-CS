/**
 * Parse the YAML frontmatter of a SKILL.md.
 *
 * Deliberately not a general YAML parser: the Agent Skills spec only needs
 * `name`, `description` and `metadata.internal` out of the header, and pulling a
 * YAML dependency into a zero-dependency CLI for three scalar keys is not a
 * trade worth making. Anything more complex is ignored rather than misread.
 */

function parseScalar(raw) {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return {};

  const result = {};
  let currentKey = null;

  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    // A nested key (`metadata:` block) only records the key; its indented
    // children are read on the following iterations.
    const indented = /^\s+/.test(line);
    const separator = line.indexOf(":");

    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rest = line.slice(separator + 1);

    if (indented && currentKey === "metadata") {
      if (key === "internal") result.internal = parseScalar(rest);
      continue;
    }

    if (rest.trim() === "") {
      currentKey = key;
      continue;
    }

    currentKey = null;
    result[key] = parseScalar(rest);
  }

  return result;
}

export function hasFrontmatter(source) {
  return /^---\r?\n/.test(source);
}

/**
 * Read a skill's identity. Throws with an actionable message when the header is
 * missing, because a nameless skill is unaddressable — `ds-cs remove <name>`
 * could never find it again.
 */
export async function readSkillManifest(skillFile) {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(skillFile, "utf8");
  const frontmatter = parseFrontmatter(source);

  if (!frontmatter.name || !frontmatter.description) {
    throw new Error(
      `${skillFile} is missing required frontmatter ("name" and "description" are both required by the Agent Skills spec)`
    );
  }

  return {
    name: String(frontmatter.name).trim(),
    description: String(frontmatter.description).trim(),
    internal: frontmatter.internal === true || frontmatter.internal === "true",
    body: source,
  };
}
