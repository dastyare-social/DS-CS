import { toArray } from "../args.mjs";

/**
 * Split `owner/repo@skill` into source and skill names.
 *
 * The `@` is only a separator on the *right*, and only one: an SSH URL like
 * `git@github.com:owner/repo` has an `@` in the middle. So the split anchors to
 * the last `@`, and only when something precedes it.
 */
export function parseTarget(spec) {
  const at = spec.lastIndexOf("@");
  if (at > 0) {
    const source = spec.slice(0, at);
    const names = spec
      .slice(at + 1)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length > 0) {
      return { source, names };
    }
  }
  return { source: spec, names: [] };
}

function splitNames(value) {
  return value.includes(",") ? value.split(",").map((name) => name.trim()) : [value];
}

/**
 * Work out what to install from positional arguments plus the repeatable
 * `--skill` flag.
 *
 * A bare name (`ds-cs add brand-config`) means "from the DS-CS registry" — the
 * common case should not require the user to know where a skill lives. A bare
 * `owner/repo` is GitHub shorthand and is treated as a source instead.
 */
export function resolveRequest(positional, flags) {
  const skillFlags = toArray(flags.skill);

  if (positional.length === 0) {
    return { source: "", names: skillFlags };
  }

  const parsed = parseTarget(positional[0]);

  if (parsed.source) {
    return { source: parsed.source, names: [...parsed.names, ...skillFlags] };
  }

  // Every positional was skill names for the DS-CS registry.
  return { source: "", names: [...positional.flatMap(splitNames), ...skillFlags] };
}
