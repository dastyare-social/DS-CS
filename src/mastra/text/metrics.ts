/**
 * Shared text measurements.
 *
 * Kept deterministic and dependency-free: the same numbers must come out of the
 * video analyser and the copy QA tool, and a model should never be asked to
 * count words.
 */

export interface TextMetrics {
  characters: number;
  words: number;
  sentences: number;
  paragraphs: number;
  syllables: number;
  avgWordsPerSentence: number;
  longestSentenceWords: number;
  readingEase: number;
  readingGrade: number;
  emojiCount: number;
  questionCount: number;
  numberCount: number;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  return normalized
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function splitWords(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return 0;
  if (cleaned.length <= 3) return 1;

  const trimmed = cleaned
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);

  return groups?.length || 1;
}

export function textMetrics(text: string): TextMetrics {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const sentences = splitSentences(normalized);
  const words = splitWords(normalized);
  const paragraphs = normalized
    ? normalized.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).length
    : 0;
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const wordsPerSentence = sentences.length
    ? words.length / sentences.length
    : words.length;
  const syllablesPerWord = words.length ? syllables / words.length : 0;
  const longestSentenceWords = sentences.reduce(
    (longest, sentence) => Math.max(longest, splitWords(sentence).length),
    0,
  );

  // Flesch Reading Ease and Flesch–Kincaid grade, with the usual clamp.
  const readingEase = words.length
    ? 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord
    : 0;
  const readingGrade = words.length
    ? 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59
    : 0;

  return {
    characters: normalized.length,
    words: words.length,
    sentences: sentences.length,
    paragraphs,
    syllables,
    avgWordsPerSentence: Number(wordsPerSentence.toFixed(1)),
    longestSentenceWords,
    readingEase: Number(Math.max(0, Math.min(120, readingEase)).toFixed(1)),
    readingGrade: Number(Math.max(0, readingGrade).toFixed(1)),
    emojiCount: normalized.match(EMOJI_RE)?.length ?? 0,
    questionCount: (normalized.match(/\?/g) ?? []).length,
    numberCount: (normalized.match(/\d[\d.,]*/g) ?? []).length,
  };
}
