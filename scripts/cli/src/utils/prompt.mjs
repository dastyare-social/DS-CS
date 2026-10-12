import readline from "node:readline";
import { stdin, stdout } from "node:process";

import { CliError } from "./errors.mjs";
import { bold, cyan, dim, yellow } from "./log.mjs";

/**
 * Interactive prompts.
 *
 * Hand-rolled rather than pulled from a prompt library, because the CLI ships
 * with zero runtime dependencies. That means implementing the parts that matter
 * for an installer: search/filter over a list, multi-select with pre-selection,
 * and keyboard navigation — plus the guarantee that a non-interactive shell
 * never blocks on a keypress.
 */

const KEY = {
  up: "up",
  down: "down",
  space: "space",
  enter: "return",
  escape: "escape",
  ctrlC: "c",
  backspace: "backspace",
};

function readKeys() {
  readline.emitKeypressEvents(stdin);
  if (stdin.isTTY) stdin.setRawMode(true);
  return () => {
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
  };
}

function keyOf(key) {
  if (!key) return null;
  switch (key.name) {
    case "up":
    case "k":
      return KEY.up;
    case "down":
    case "j":
      return KEY.down;
    case "space":
      return KEY.space;
    case "return":
    case "enter":
      return KEY.enter;
    case "escape":
      return KEY.escape;
    case "backspace":
      return KEY.backspace;
    default:
      break;
  }
  if (key.ctrl && key.name === KEY.ctrlC) return KEY.ctrlC;
  return null;
}

/**
 * True when we can actually prompt.
 *
 * CI, a pipe, and an agent's shell are all non-interactive. Every prompt below
 * has a documented non-interactive fallback instead of hanging.
 */
export function isInteractive() {
  return Boolean(stdin.isTTY && stdout.isTTY) && process.env.CI !== "true";
}

function visibleWidth(text) {
  return stripAnsi(text).length;
}

function stripAnsi(text) {
  return text.replace(/\u001B\[[0-9;]*m/g, "");
}

function pad(text, width) {
  const gap = width - visibleWidth(text);
  return gap > 0 ? text + " ".repeat(gap) : text;
}

/**
 * Search-and-multi-select over a list of choices.
 *
 * This is the prompt an installer lives or dies by: typing filters, space
 * toggles, enter confirms, and the current selection is always visible. Keys
 * that are not commands are treated as filter input, so the user never has to
 * think about which mode they are in.
 */
export function multiselect({
  message,
  choices,
  initialSelected = [],
  hint,
  required = false,
}) {
  if (!isInteractive()) {
    throw new CliError(`"${message}" needs an interactive terminal`, {
      hint: "Pass the choice explicitly instead, e.g. --skill <name> or --agent <name>.",
    });
  }
  if (choices.length === 0) return [];

  const selected = new Set(initialSelected.filter((value) => choices.some((c) => c.value === value)));
  let cursor = 0;
  let filter = "";
  let offset = 0;

  const stop = readKeys();
  const write = (line) => stdout.write(line);
  const pageSize = Math.min(10, Math.max(3, stdout.rows ? stdout.rows - 8 : 10));

  const visible = () =>
    filter === ""
      ? choices
      : choices.filter((choice) =>
          // `keywords` lets a choice carry extra searchable text — a skill's
          // full description, say — without widening what the list shows.
          (choice.keywords ?? `${choice.label} ${choice.description ?? ""}`)
            .toLowerCase()
            .includes(filter.toLowerCase())
        );

  const render = (bottomLine) => {
    const rows = visible();
    if (cursor >= rows.length) cursor = Math.max(0, rows.length - 1);
    if (cursor < offset) offset = cursor;
    if (cursor >= offset + pageSize) offset = cursor - pageSize + 1;

    write("\x1B[2K\r");
    write(`${bold("?")} ${bold(message)}\n`);

    if (hint) write(`  ${dim(hint)}\n`);
    if (filter) write(`  ${dim("filter:")} ${filter}${cyan("▌")}\n`);
    write("\x1B[1A".repeat(filter ? 2 : hint ? 2 : 1));

    const window = rows.slice(offset, offset + pageSize);
    const labelWidth = Math.max(
      0,
      ...choices.map((choice) => visibleWidth(choice.label))
    );

    for (const choice of window) {
      const index = rows.indexOf(choice);
      const isCursor = index === cursor;
      const isSelected = selected.has(choice.value);
      const marker = isSelected ? cyan("◉") : dim("○");
      const pointer = isCursor ? cyan("❯") : " ";
      const label = isCursor ? bold(pad(choice.label, labelWidth)) : pad(choice.label, labelWidth);
      const description = choice.description ? dim(`  ${choice.description}`) : "";
      write(`  ${pointer} ${marker} ${label}${description}\n`);
    }

    write("\x1B[1A".repeat(window.length));
    write("\x1B[2K\r");
    write(`${bottomLine}\n`);
  };

  const cleanup = (message) => {
    stop();
    write("\x1B[?25h"); // show cursor
    if (message) write(`${message}\n`);
  };

  stdout.write("\x1B[?25l"); // hide cursor for the duration of the prompt

  return new Promise((resolve, reject) => {
    const summary = () =>
      selected.size === 0
        ? `${dim("(none selected)")}`
        : dim(`(${selected.size} selected: ${[...selected].join(", ")})`);

    render(summary());

    const onKeypress = (str, key) => {
      const name = keyOf(key);

      if (name === KEY.ctrlC) {
        write("\x1B[1A".repeat(1)); // clear summary row
        cleanup();
        process.exit(130);
      }

      if (name === KEY.escape) {
        cleanup();
        reject(new CliError("Aborted."));
        return;
      }

      if (name === KEY.enter) {
        if (required && selected.size === 0) {
          render(`${yellow("!")} select at least one (enter to confirm)`);
          return;
        }
        cleanup();
        resolve(choices.filter((choice) => selected.has(choice.value)));
        return;
      }

      if (name === KEY.up || name === KEY.down) {
        const rows = visible();
        if (rows.length === 0) return;
        cursor = name === KEY.up ? cursor - 1 : cursor + 1;
        if (cursor < 0) cursor = rows.length - 1;
        if (cursor >= rows.length) cursor = 0;
        render(summary());
        return;
      }

      if (name === KEY.space) {
        const rows = visible();
        const choice = rows[cursor];
        if (!choice) return;
        if (selected.has(choice.value)) selected.delete(choice.value);
        else selected.add(choice.value);
        render(summary());
        return;
      }

      if (name === KEY.backspace) {
        filter = filter.slice(0, -1);
        cursor = 0;
        offset = 0;
        render(summary());
        return;
      }

      // Anything else is filter input.
      if (str && !key.ctrl && !key.meta && visibleWidth(str) > 0) {
        filter += str;
        cursor = 0;
        offset = 0;
        render(summary());
      }
    };

    stdin.on("keypress", onKeypress);
    stdin.resume();
  });
}

/** Single-select, same interaction model with `enter` selecting the cursor. */
export function select({ message, choices, initialIndex = 0 }) {
  if (choices.length === 0) return [];

  if (!isInteractive()) {
    throw new CliError(`"${message}" needs an interactive terminal`, {
      hint: "Pass the choice explicitly as a flag instead.",
    });
  }

  let cursor = Math.min(initialIndex, choices.length - 1);
  let offset = 0;
  const stop = readKeys();
  const write = (line) => stdout.write(line);
  const pageSize = Math.min(10, Math.max(3, stdout.rows ? stdout.rows - 8 : 10));

  const render = () => {
    if (cursor >= choices.length) cursor = choices.length - 1;
    if (cursor < offset) offset = cursor;
    if (cursor >= offset + pageSize) offset = cursor - pageSize + 1;

    write("\x1B[2K\r");
    write(`${bold("?")} ${bold(message)}\n`);

    const window = choices.slice(offset, offset + pageSize);
    const labelWidth = Math.max(0, ...choices.map((choice) => visibleWidth(choice.label)));

    for (const choice of window) {
      const index = offset + window.indexOf(choice);
      const pointer = index === cursor ? cyan("❯") : " ";
      const label = index === cursor ? bold(pad(choice.label, labelWidth)) : pad(choice.label, labelWidth);
      const description = choice.description ? dim(`  ${choice.description}`) : "";
      write(`  ${pointer} ${label}${description}\n`);
    }

    write("\x1B[1A".repeat(window.length));
    write("\x1B[2K\r");
    write(dim("  ↑/↓ move · enter select\n"));
  };

  const cleanup = () => {
    stop();
    write("\x1B[?25h");
  };

  stdout.write("\x1B[?25l"); // hide cursor for the duration of the prompt

  return new Promise((resolve, reject) => {
    render();

    const onKeypress = (str, key) => {
      const name = keyOf(key);

      if (name === KEY.ctrlC) {
        cleanup();
        process.exit(130);
      }
      if (name === KEY.escape) {
        cleanup();
        reject(new CliError("Aborted."));
        return;
      }
      if (name === KEY.enter) {
        cleanup();
        resolve([choices[cursor]]);
        return;
      }
      if (name === KEY.up || name === KEY.down) {
        cursor = name === KEY.up ? cursor - 1 : cursor + 1;
        if (cursor < 0) cursor = choices.length - 1;
        if (cursor >= choices.length) cursor = 0;
        render();
      }
    };

    stdin.on("keypress", onKeypress);
    stdin.resume();
  });
}

/**
 * Yes/no. Defaults to `defaultYes` on enter, and to that same value when there
 * is no terminal at all.
 */
export async function confirm(message, { defaultYes = true } = {}) {
  if (!isInteractive()) return defaultYes;

  const { createInterface } = readline;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const suffix = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = (await rl.question(`${bold("?")} ${message} ${dim(suffix)} `)).trim().toLowerCase();
    if (answer === "") return defaultYes;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export async function promptText(message, fallback = "") {
  if (!isInteractive()) return fallback;
  const { createInterface } = readline;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const suffix = fallback ? dim(` (${fallback})`) : "";
    const answer = (await rl.question(`${bold("?")} ${message}${suffix} `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

export { select as selectOne, multiselect as selectMany };
