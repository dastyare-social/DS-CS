import readline from "node:readline";
import { stdin, stdout } from "node:process";

import { CliError } from "./errors.mjs";
import { bold, cyan, dim, yellow } from "./log.mjs";

/**
 * Interactive prompts.
 *
 * Hand-rolled rather than pulled from a prompt library, because the CLI ships
 * with zero runtime dependencies.
 */

const KEY = {
  up: "up",
  down: "down",
  space: "space",
  enter: "enter",
  escape: "escape",
  ctrlC: "c",
  backspace: "backspace",
};

/**
 * A repainting region of the terminal.
 *
 * The previous implementation moved the cursor up, cleared a single line, and
 * wrote the menu again — which appended a fresh copy on every keypress and
 * scrolled the real menu off screen. Repainting has to be stateless: each frame
 * is measured, the last one is fully erased, and the new one is written at a
 * known position.
 */
function createScreen(write) {
  let lastHeight = 0;

  return {
    paint(lines) {
      if (lastHeight > 0) write(`\x1B[${lastHeight}A`);
      write("\x1B[0J"); // erase from the cursor to the end of the screen
      for (const line of lines) write(`${line}\n`);
      lastHeight = lines.length;
    },
    erase() {
      if (lastHeight === 0) return;
      write(`\x1B[${lastHeight}A`);
      write("\x1B[0J");
      lastHeight = 0;
    },
  };
}

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
      return KEY.up;
    case "k":
      return KEY.up;
    case "down":
      return KEY.down;
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

function stripAnsi(text) {
  return text.replace(/\u001B\[[0-9;]*m/g, "");
}

function visibleWidth(text) {
  return stripAnsi(text).length;
}

function pad(text, width) {
  const gap = width - visibleWidth(text);
  return gap > 0 ? text + " ".repeat(gap) : text;
}

function termWidth() {
  return stdout.columns || 80;
}

function termRows() {
  return stdout.rows || 24;
}

/**
 * Search-and-multi-select over a list of choices.
 *
 * The prompt an installer lives or dies by: typing filters, space toggles,
 * enter confirms. A leading "Select all" row — and the `a` shortcut — make the
 * whole registry selectable without fifteen space presses, which is what you
 * want on a first run and never again.
 */
export function multiselect({ message, choices, initialSelected = [], hint, required = false }) {
  if (!isInteractive()) {
    throw new CliError(`"${message}" needs an interactive terminal`, {
      hint: "Pass the choice explicitly instead, e.g. --skill <name> or --agent <name>.",
    });
  }
  if (choices.length === 0) return [];

  const ALL = Symbol("select-all");
  const selected = new Set(
    initialSelected.filter((value) => choices.some((choice) => choice.value === value))
  );

  let cursor = 0;
  let filter = "";
  let offset = 0;
  let status = "";

  const write = (line) => stdout.write(line);
  const screen = createScreen(write);
  const stop = readKeys();
  const pageSize = Math.min(8, Math.max(3, termRows() - 9));

  const visibleChoices = () =>
    filter === ""
      ? choices
      : choices.filter((choice) =>
          // `keywords` carries extra searchable text — a skill's full
          // description, say — without widening what the list displays.
          (choice.keywords ?? `${choice.label} ${choice.description ?? ""}`)
            .toLowerCase()
            .includes(filter.toLowerCase())
        );

  const rows = () => [
    { value: ALL, label: "Select all" },
    ...visibleChoices().map((choice) => ({ value: choice.value, label: choice.label, choice })),
  ];

  const paint = () => {
    const all = rows();
    if (cursor >= all.length) cursor = all.length - 1;
    if (cursor < 0) cursor = 0;
    if (cursor < offset) offset = cursor;
    if (cursor >= offset + pageSize) offset = cursor - pageSize + 1;

    const window = all.slice(offset, offset + pageSize);
    const labelWidth = Math.min(
      28,
      Math.max(0, ...all.map((row) => visibleWidth(row.label)))
    );
    const pathWidth = Math.max(
      0,
      ...all.map((row) => visibleWidth(row.choice?.description ?? ""))
    );
    const lines = [];
    lines.push(`${bold("?")} ${bold(message)}`);
    if (hint) lines.push(`  ${dim(hint)}`);
    lines.push(filter === "" ? "" : `  ${dim("filter:")} ${filter}${cyan("▌")}`);
    if (lines[lines.length - 1] === "") lines.pop();

    for (const row of window) {
      const index = offset + window.indexOf(row);
      const isCursor = index === cursor;

      if (row.value === ALL) {
        const every = visibleChoices().length > 0 && visibleChoices().every((c) => selected.has(c.value));
        const marker = every ? cyan("◉") : dim("○");
        lines.push(
          `  ${isCursor ? cyan("❯") : " "} ${marker} ${isCursor ? bold("Select all") : "Select all"}`
        );
        continue;
      }

      const isSelected = selected.has(row.value);
      const marker = isSelected ? cyan("◉") : dim("○");
      const label = isCursor ? bold(pad(row.label, labelWidth)) : pad(row.label, labelWidth);
      const path = row.choice?.description ? dim(`  ${row.choice.description}`) : "";
      lines.push(
        `  ${isCursor ? cyan("❯") : " "} ${marker} ${label}${path}`.slice(0, termWidth()).padEnd(
          Math.min(termWidth(), labelWidth + pathWidth + 6)
        )
      );
    }

    if (all.length > window.length) {
      lines.push(dim(`  … ${all.length - window.length} more`));
    }
    lines.push("");
    lines.push(
      status ||
        dim(
          selected.size === 0
            ? "(none selected)"
            : `(${selected.size} selected: ${[...selected].slice(0, 4).join(", ")}${selected.size > 4 ? ", …" : ""})`
        )
    );
    screen.paint(lines);
  };

  const finish = (error) => {
    stop();
    screen.erase();
    stdout.write("\x1B[?25h");
    if (error) throw error;
  };

  stdout.write("\x1B[?25l"); // hide the cursor while navigating
  paint();

  return new Promise((resolve) => {
    const toggleAll = () => {
      const shown = visibleChoices();
      const everySelected = shown.every((choice) => selected.has(choice.value));
      if (everySelected) for (const choice of shown) selected.delete(choice.value);
      else for (const choice of shown) selected.add(choice.value);
    };

    const onKeypress = (str, key) => {
      const name = keyOf(key);
      const all = rows();

      if (name === KEY.ctrlC) {
        finish();
        process.exit(130);
      }
      if (name === KEY.escape) {
        finish(new CliError("Aborted."));
        return;
      }
      if (name === KEY.enter) {
        if (required && selected.size === 0) {
          status = yellow("! select at least one (enter to confirm)");
          paint();
          return;
        }
        finish();
        resolve(choices.filter((choice) => selected.has(choice.value)));
        return;
      }
      if (name === KEY.up || name === KEY.down) {
        cursor = name === KEY.up ? cursor - 1 : cursor + 1;
        if (cursor < 0) cursor = all.length - 1;
        if (cursor >= all.length) cursor = 0;
        status = "";
        paint();
        return;
      }
      if (name === KEY.space) {
        const row = all[cursor];
        if (row) {
          if (row.value === ALL) toggleAll();
          else if (selected.has(row.value)) selected.delete(row.value);
          else selected.add(row.value);
        }
        status = "";
        paint();
        return;
      }
      if (name === KEY.backspace) {
        filter = filter.slice(0, -1);
        cursor = 0;
        offset = 0;
        status = "";
        paint();
        return;
      }

      // `a` toggles everything; anything else is filter input.
      if (str === "a" && !key.ctrl && !key.meta) {
        toggleAll();
        status = "";
        paint();
        return;
      }
      if (str && !key.ctrl && !key.meta && visibleWidth(str) > 0) {
        filter += str;
        cursor = 0;
        offset = 0;
        status = "";
        paint();
      }
    };

    stdin.on("keypress", onKeypress);
    stdin.resume();
  });
}

/** Single-select, same repaint model with enter choosing the cursor row. */
export function select({ message, choices, initialIndex = 0, hint }) {
  if (choices.length === 0) return [];

  if (!isInteractive()) {
    throw new CliError(`"${message}" needs an interactive terminal`, {
      hint: "Pass the choice explicitly as a flag instead.",
    });
  }

  let cursor = Math.min(Math.max(0, initialIndex), choices.length - 1);
  let offset = 0;

  const write = (line) => stdout.write(line);
  const screen = createScreen(write);
  const stop = readKeys();
  const pageSize = Math.min(8, Math.max(3, termRows() - 8));

  const paint = () => {
    if (cursor >= choices.length) cursor = choices.length - 1;
    if (cursor < offset) offset = cursor;
    if (cursor >= offset + pageSize) offset = cursor - pageSize + 1;

    const window = choices.slice(offset, offset + pageSize);
    const labelWidth = Math.min(28, Math.max(0, ...choices.map((choice) => visibleWidth(choice.label))));

    const lines = [`${bold("?")} ${bold(message)}`];
    if (hint) lines.push(`  ${dim(hint)}`);

    for (const choice of window) {
      const index = offset + window.indexOf(choice);
      const isCursor = index === cursor;
      const label = isCursor ? bold(pad(choice.label, labelWidth)) : pad(choice.label, labelWidth);
      const description = choice.description ? dim(`  ${choice.description}`) : "";
      lines.push(`  ${isCursor ? cyan("❯") : " "} ${label}${description}`);
    }

    if (choices.length > window.length) {
      lines.push(dim(`  … ${choices.length - window.length} more`));
    }
    lines.push("");
    lines.push(dim(hint ? "" : "↑/↓ move · enter select"));
    if (lines[lines.length - 1] === "") lines.pop();

    screen.paint(lines);
  };

  stdout.write("\x1B[?25l");
  paint();

  return new Promise((resolve, reject) => {
    const onKeypress = (str, key) => {
      const name = keyOf(key);

      if (name === KEY.ctrlC) {
        stop();
        screen.erase();
        stdout.write("\x1B[?25h");
        process.exit(130);
      }
      if (name === KEY.escape) {
        stop();
        screen.erase();
        stdout.write("\x1B[?25h");
        reject(new CliError("Aborted."));
        return;
      }
      if (name === KEY.enter) {
        stop();
        screen.erase();
        stdout.write("\x1B[?25h");
        resolve([choices[cursor]]);
        return;
      }
      if (name === KEY.up || name === KEY.down) {
        cursor = name === KEY.up ? cursor - 1 : cursor + 1;
        if (cursor < 0) cursor = choices.length - 1;
        if (cursor >= choices.length) cursor = 0;
        paint();
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

  const rl = readline.createInterface({ input: stdin, output: stdout });
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
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const suffix = fallback ? dim(` (${fallback})`) : "";
    const answer = (await rl.question(`${bold("?")} ${message}${suffix} `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

export { select as selectOne, multiselect as selectMany };