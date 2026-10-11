/**
 * Tiny argument parser. Enough for a CLI of this size and nothing more: no
 * dependency, and unknown flags fail loudly instead of being silently dropped
 * (a silently-ignored `--global` is worse than an error).
 */

const ALIASES = {
  g: "global",
  a: "agent",
  s: "skill",
  y: "yes",
  l: "list",
  h: "help",
  v: "version",
  p: "project",
};

/** Flags that take a value. Everything else is treated as boolean. */
const VALUE_FLAGS = new Set([
  "agent",
  "skill",
  "url",
  "api-key",
  "agent-dir",
  "cwd",
  "scope",
]);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }

    if (token.startsWith("--")) {
      let [name, inlineValue] = splitFlag(token.slice(2));
      name = ALIASES[name] ?? name;

      if (inlineValue !== undefined) {
        setFlag(flags, name, inlineValue);
        continue;
      }

      const next = argv[index + 1];
      if (VALUE_FLAGS.has(name)) {
        if (next === undefined || next.startsWith("-")) {
          throw new Error(`--${name} needs a value`);
        }
        setFlag(flags, name, next);
        index += 1;
      } else {
        flags[name] = true;
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      for (const letter of token.slice(1)) {
        const name = ALIASES[letter] ?? letter;
        if (VALUE_FLAGS.has(name)) {
          const next = argv[index + 1];
          if (next === undefined || next.startsWith("-")) {
            throw new Error(`-${letter} needs a value`);
          }
          setFlag(flags, name, next);
          index += 1;
        } else {
          flags[name] = true;
        }
      }
      continue;
    }

    positional.push(token);
  }

  return { flags, positional };
}

function splitFlag(text) {
  const equals = text.indexOf("=");
  if (equals === -1) return [text, undefined];
  return [text.slice(0, equals), text.slice(equals + 1)];
}

function setFlag(flags, name, value) {
  const key = camelCase(name);
  if (flags[key] === undefined) {
    flags[key] = value;
  } else if (Array.isArray(flags[key])) {
    flags[key].push(value);
  } else {
    flags[key] = [flags[key], value];
  }
}

export function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Normalise a repeatable flag into an array; `'*'` means "every agent". */
export function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
