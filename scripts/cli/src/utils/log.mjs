/**
 * Terminal output helpers. Colour is opt-out via NO_COLOR and auto-disabled
 * when stdout is not a TTY, so piped output stays clean.
 */

const useColor =
  !process.env.NO_COLOR && process.env.TERM !== "dumb" && process.stdout.isTTY;

const wrap = (open, close) => (text) => (useColor ? `\u001B[${open}m${text}\u001B[${close}m` : text);

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const blue = wrap(34, 39);
export const cyan = wrap(36, 39);

export const log = {
  info(message = "") {
    console.log(message);
  },
  step(message) {
    console.log(`${cyan("::")} ${message}`);
  },
  success(message) {
    console.log(`${green("✓")} ${message}`);
  },
  warn(message) {
    console.log(`${yellow("!")} ${message}`);
  },
  error(message) {
    console.error(`${red("✗")} ${message}`);
  },
  plain(message) {
    console.log(message);
  },
};

export function heading(text) {
  console.log(`\n${bold(text)}`);
}

export function table(rows, columns) {
  if (rows.length === 0) return;
  const widths = columns.map((column) =>
    Math.max(column.title.length, ...rows.map((row) => String(row[column.key] ?? "").length))
  );
  const line = (cells) =>
    cells.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ");
  console.log(dim(line(columns.map((column) => column.title))));
  for (const row of rows) {
    console.log(line(columns.map((column) => row[column.key])));
  }
}
