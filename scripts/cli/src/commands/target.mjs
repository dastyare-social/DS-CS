import { toArray } from "../args.mjs";

/**
 * Split `owner/repo@skill` into source and skill names.
 *
 * The `@` is only a separator on the *right*, and only when what follows looks
 * like skill names. That guard matters for SSH remotes: in
 * `git@github.com:owner/repo` the `@` sits in the middle and the remainder is a
 * path, not a name. Requiring `name[,name…]` shaped like identifiers keeps that
 * URL intact.
 *
 * `explicit` distinguishes "the user wrote `source@names`" from "no `@` was
 * present" — without it a bare skill name would be misread as a source.
 */
const SKILL_NAME_LIST = /^[A-Za-z0-9_.-]+(,[A-Za-z0-9_.-]+)*$/;

export function parseTarget(spec) {
  const at = spec.lastIndexOf("@");
  if (at > 0) {
    const source = spec.slice(0, at);
    const raw = spec.slice(at + 1).trim();
    if (source && raw && SKILL_NAME_LIST.test(raw)) {
      return {
        source,
        names: raw.split(",").map((name) => name.trim()),
        explicit: true,
      };
    }
  }
  return { source: spec, names: [], explicit: false };
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

  if (parsed.explicit) {
    // `owner/repo@skill` names both; any further positionals are more skill names.
    return {
      source: parsed.source,
      names: [...parsed.names, ...positional.slice(1).flatMap(splitNames), ...skillFlags],
    };
  }

  // Nothing carried an `@`, so every positional is a skill name. Resolve them
  // against the DS-CS registry — unless the first one is clearly a source.
  const first = positional[0];
  if (looksLikeSource(first)) {
    return { source: first, names: [...positional.slice(1).flatMap(splitNames), ...skillFlags] };
  }

  return { source: "", names: [...positional.flatMap(splitNames), ...skillFlags] };
}

function looksLikeSource(spec) {
  return (
    spec.startsWith(".") ||
    spec.startsWith("/") ||
    spec.startsWith("~") ||
    spec.startsWith("http") ||
    spec.startsWith("git@") ||
    spec.startsWith("git://") ||
    spec.startsWith("ssh://") ||
    /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(spec)
  );
}
