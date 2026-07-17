import { NSFW_MAP } from "./nsfwMap";

export function removeEmojis(input: string): string {
  return input.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu,
    "",
  );
}

export function filterNsfwWords(input: string): string {
  return input.replace(/\b(\w+)\b/gi, (match: string): string => {
    const lower = match.toLowerCase();
    if (lower === "shit") return match;
    return NSFW_MAP[lower] ?? match;
  });
}

export function sanitizeHtml(input: string): string {
  return input
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?[a-z][a-z0-9]*(?:\s[^>]*)?\/?>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
