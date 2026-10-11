import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { CliError } from "./errors.mjs";
import { bold, cyan, dim } from "./log.mjs";

/**
 * Non-interactive contexts (CI, piped stdin, --yes) must never hang waiting for
 * a keypress. Every prompt has a documented non-interactive fallback instead.
 */
export function isInteractive() {
  return Boolean(stdin.isTTY && stdout.isTTY) && process.env.CI !== "true";
}

async function question(prompt) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

export async function confirm(message, { defaultYes = true } = {}) {
  if (!isInteractive()) return defaultYes;
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await question(`${message} ${dim(suffix)} `)).toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

export async function promptText(message, fallback = "") {
  if (!isInteractive()) return fallback;
  const suffix = fallback ? dim(` (${fallback})`) : "";
  const answer = await question(`${message}${suffix} `);
  return answer || fallback;
}

/**
 * Numbered single-select. Returning an empty list means "nothing chosen", which
 * callers treat as a clean no-op rather than an error.
 */
export async function select(message, choices) {
  if (choices.length === 0) return [];
  if (!isInteractive()) {
    throw new CliError(`${message} needs an interactive terminal`, {
      hint: "Pass the choice explicitly instead, e.g. --skill <name> or <source>@<name>.",
    });
  }
  console.log(`\n${bold(message)}`);
  choices.forEach((choice, index) => {
    console.log(`  ${cyan(String(index + 1).padStart(2))}  ${choice.label}`);
  });
  const answer = await question(`\nSelect (1-${choices.length}, comma-separated, blank to skip): `);
  if (answer === "") return [];
  const indices = answer
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= choices.length);
  if (indices.length === 0) {
    throw new CliError(`"${answer}" is not one of the listed options`);
  }
  return indices.map((index) => choices[index - 1]);
}

/** Multi-select with a numbered header, used by `ds-cs add`. */
export async function selectAll(message, choices) {
  return select(message, choices);
}
