/**
 * Chunking for retrieval over channel content.
 *
 * Posts are short, so chunks are paragraph-shaped rather than fixed-size:
 * split on blank lines, pack paragraphs up to `maxChars`, and only hard-split
 * a paragraph that is longer than a chunk on its own. Consecutive chunks share
 * a short tail so a sentence that straddles the boundary is retrievable from
 * both sides.
 */

export interface TextChunk {
  index: number;
  content: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 1_200;
const DEFAULT_OVERLAP_CHARS = 150;

function normalize(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitOversized(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];

  const pieces: string[] = [];
  let rest = paragraph;

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    // Prefer a word boundary in the last 20% of the window.
    const boundary = window.lastIndexOf(" ");
    const cut =
      boundary > maxChars * 0.8 ? boundary : maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) pieces.push(rest);
  return pieces;
}

export function chunkText(
  input: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS);
  const overlapChars = Math.min(
    Math.max(0, options.overlapChars ?? DEFAULT_OVERLAP_CHARS),
    Math.floor(maxChars / 2),
  );

  const text = normalize(input);
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitOversized(paragraph.trim(), maxChars))
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);

    const tail = overlapChars > 0 ? current.slice(-overlapChars).trim() : "";
    // Only carry the overlap when it still fits: a paragraph that already fills
    // the chunk must not lose its own beginning to a tail.
    current =
      tail && tail.length + 2 + paragraph.length <= maxChars
        ? `${tail}\n\n${paragraph}`
        : paragraph;
  }

  if (current) chunks.push(current);

  return chunks.map((content, index) => ({ index, content }));
}
