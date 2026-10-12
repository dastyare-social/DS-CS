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

const MAX_COLUMN_WIDTH = 60;

/**
 * Render an aligned table.
 *
 * Columns are capped and the total is checked against the terminal width: skill
 * descriptions are a full sentence or more, so an uncapped table wraps into an
 * unreadable wall and pushes the source column off screen.
 */
export function table(rows, columns, { maxWidth = process.stdout.columns || 100 } = {}) {
  if (rows.length === 0) return;

  const capped = columns.map((column) => ({
    ...column,
    width: Math.min(
      MAX_COLUMN_WIDTH,
      Math.max(column.title.length, ...rows.map((row) => String(row[column.key] ?? "").length))
    ),
  }));

  // Hand whatever width the fixed columns leave over to the flexible one.
  const fixedWidth = capped.reduce((sum, column) => sum + column.width + 2, 0);
  const flexible = capped.find((column) => column.flex);
  if (flexible && maxWidth > fixedWidth) {
    flexible.width = Math.min(MAX_COLUMN_WIDTH, maxWidth - fixedWidth);
  }

  const format = (value, column) => {
    const text = String(value ?? "");
    const clipped = text.length > column.width ? `${text.slice(0, column.width - 1)}…` : text;
    return clipped.padEnd(column.width);
  };

  // `cells` is a row of values, so the column has to be paired in explicitly —
  // passing `format` straight to map would hand it the array index instead.
  const line = (cells) =>
    cells.map((value, index) => format(value, capped[index])).join("  ").trimEnd();
  console.log(dim(line(capped.map((column) => column.title))));
  for (const row of rows) {
    console.log(line(capped.map((column) => row[column.key])));
  }
}
