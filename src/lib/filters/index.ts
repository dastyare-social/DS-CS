import { FilterOptions } from "./types";
import { removeEmojis, filterNsfwWords, sanitizeHtml } from "./pipeline";

export function filterString(
  input: string,
  options: FilterOptions = {},
): string {
  const {
    removeEmojis: doEmoji = true,
    filterNsfw: doNsfw = true,
    sanitizeHtml: doSanitize = true,
  } = options;

  let result = input;

  // if (doEmoji) result = removeEmojis(result);
  if (doNsfw) result = filterNsfwWords(result);
  if (doSanitize) result = sanitizeHtml(result);

  // ✋ No markdownToHtml here — MarkdownRenderer handles that safely in React
  return result;
}

export { removeEmojis, filterNsfwWords, sanitizeHtml } from "./pipeline";
export type { FilterOptions } from "./types";
