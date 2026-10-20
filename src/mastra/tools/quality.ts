import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { REUSE_LIMITS } from "../repurpose/specs";
import { analyzeScript } from "./video";
import { splitSentences, splitWords, textMetrics } from "../text/metrics";

/**
 * Deterministic quality checks for anything the studio drafts.
 *
 * The point is to give the model numbers it cannot hallucinate — character
 * counts, a platform ceiling, reading ease, tag counts — and a small set of
 * editorial rules that are cheap to enforce without another model call.
 */

export const COPY_KINDS = [
  "post",
  "thread",
  "article",
  "caption",
  "email",
  "script",
  "hashtags",
  "reddit",
] as const;

export const COPY_PLATFORMS = [
  "x",
  "linkedin",
  "instagram",
  "tiktok",
  "facebook",
  "threads",
  "bluesky",
  "mastodon",
  "reddit",
  "youtube",
  "pinterest",
  "substack",
  "email",
  "generic",
] as const;

export type CopyKind = (typeof COPY_KINDS)[number];
export type CopyPlatform = (typeof COPY_PLATFORMS)[number];

export type IssueSeverity = "info" | "warning" | "error";

export interface CopyIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
}

export interface CopyCheckInput {
  kind: CopyKind;
  text: string;
  platform?: CopyPlatform;
  subject?: string;
  wpm?: number;
}

export interface CopyCheckResult {
  score: number;
  verdict: "ship" | "revise" | "rewrite";
  issues: CopyIssue[];
  metrics: ReturnType<typeof textMetrics> & {
    limit: number | null;
    hashtags: number;
    links: number;
    firstLineChars: number;
    parts: number;
  };
}

const PLATFORM_LIMITS: Partial<Record<CopyPlatform, number>> = {
  x: 280,
  linkedin: 3_000,
  instagram: 2_200,
  tiktok: 2_200,
  facebook: 5_000,
  threads: 500,
  bluesky: 300,
  mastodon: 500,
  reddit: 40_000,
  youtube: 5_000,
  pinterest: 500,
  substack: 100_000,
  email: 100_000,
  generic: 5_000,
};

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  error: 25,
  warning: 8,
  info: 2,
};

const SLOP_PHRASES = [
  "in today's fast-paced world",
  "in the ever-evolving",
  "unlock the",
  "game-changer",
  "game changer",
  "dive into",
  "delve into",
  "elevate your",
  "seamless",
  "leverage the",
  "tapestry",
  "testament to",
  "navigate the landscape",
  "revolutionize",
  "cutting-edge",
  "synergy",
  "unleash",
  "take it to the next level",
  "it's not just",
];

const BAIT_PHRASES = [
  "comment yes",
  "drop a",
  "tag someone",
  "agree?",
  "who else",
  "follow for more",
  "smash that",
  "double tap",
  "link in bio",
];

const FORMULAIC_OPENINGS = [
  "excited to announce",
  "excited to share",
  "i'm thrilled",
  "i am thrilled",
  "thrilled to announce",
  "humbled to announce",
  "i've been thinking about",
  "i have been thinking about",
];

const SELF_PROMO_PHRASES = [
  "check out my",
  "my product",
  "my course",
  "my service",
  "buy my",
  "link in comments",
  "dm me",
];

const GENERIC_HASHTAGS = new Set([
  "#love",
  "#instagood",
  "#follow",
  "#followme",
  "#f4f",
  "#likeforlike",
  "#photooftheday",
  "#picoftheday",
  "#happy",
  "#cute",
  "#tagsforlikes",
]);

const ACRONYMS = new Set([
  "API",
  "AI",
  "SEO",
  "URL",
  "HTTP",
  "HTTPS",
  "JSON",
  "PDF",
  "CTA",
  "ROI",
  "KPI",
  "LLM",
  "GPT",
  "USA",
  "UK",
  "EU",
  "CEO",
  "CTO",
  "CFO",
]);

function limitFor(kind: CopyKind, platform?: CopyPlatform): number | null {
  if (kind === "article" || kind === "script" || kind === "hashtags") {
    return null;
  }
  if (kind === "thread") return 2_800;
  if (kind === "reddit") return REUSE_LIMITS.redditBody;

  if (platform) return PLATFORM_LIMITS[platform] ?? null;

  switch (kind) {
    case "post":
      return 5_000;
    case "caption":
      return 2_200;
    case "email":
      return 100_000;
    default:
      return null;
  }
}

function findPhrases(text: string, phrases: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return phrases.filter((phrase) => lower.includes(phrase));
}

function normalizeSentence(sentence: string): string {
  return sentence.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();
}

export function checkCopy(input: CopyCheckInput): CopyCheckResult {
  const text = input.text ?? "";
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const metrics = textMetrics(normalized);
  const tags = normalized.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const links = normalized.match(/https?:\/\/\S+/g) ?? [];
  const firstLine = normalized.split("\n").find((line) => line.trim()) ?? "";
  const limit = limitFor(input.kind, input.platform);

  const baseMetrics = {
    ...metrics,
    limit,
    hashtags: tags.length,
    links: links.length,
    firstLineChars: firstLine.trim().length,
    parts: normalized.split(/\n{2,}/).filter((part) => part.trim()).length,
  };

  if (!normalized) {
    return {
      score: 0,
      verdict: "rewrite",
      issues: [
        {
          code: "empty",
          severity: "error",
          message: "There is nothing to check.",
        },
      ],
      metrics: baseMetrics,
    };
  }

  const issues: CopyIssue[] = [];

  if (limit !== null && normalized.length > limit) {
    const over = normalized.length - limit;
    issues.push({
      code: "over-limit",
      severity: "error",
      message: `${normalized.length} characters, ${over} over the ${limit}-character limit.`,
    });
  }

  if (input.kind === "thread") {
    const parts = normalized.split(/\n{2,}/).filter((part) => part.trim());
    const oversized = parts.filter((part) => part.length > 280);
    if (oversized.length > 0) {
      issues.push({
        code: "thread-part-over-limit",
        severity: "error",
        message: `${oversized.length} part(s) exceed 280 characters; the longest is ${Math.max(...oversized.map((part) => part.length))}.`,
      });
    }
    if (parts.length > 10) {
      issues.push({
        code: "long-thread",
        severity: "info",
        message: `${parts.length} parts. Threads past ten usually lose the argument; cut or split the topic.`,
      });
    }
  }

  if (firstLine.trim().length > 200) {
    issues.push({
      code: "long-first-line",
      severity: "info",
      message: `The first line is ${firstLine.trim().length} characters. Only the opening survives the fold on most platforms.`,
    });
  }

  const formulaic = findPhrases(firstLine, FORMULAIC_OPENINGS);
  if (formulaic.length > 0) {
    issues.push({
      code: "formulaic-opening",
      severity: "warning",
      message: `The opening is a stock announcement ("${formulaic[0]}"). Lead with the claim instead.`,
    });
  }

  const slop = findPhrases(normalized, SLOP_PHRASES);
  if (slop.length > 0) {
    issues.push({
      code: "ai-slop",
      severity: "warning",
      message: `Generic phrasing: ${slop.slice(0, 4).join(", ")}. Replace it with a concrete detail.`,
    });
  }

  const bait = findPhrases(normalized, BAIT_PHRASES);
  if (bait.length > 0) {
    issues.push({
      code: "engagement-bait",
      severity: "warning",
      message: `Engagement bait: ${bait.slice(0, 3).join(", ")}. Ask a real question or drop the ask.`,
    });
  }

  const fillerCount =
    normalized.match(
      /\b(?:um+|uh+|erm+|you know|basically|actually|literally|sort of|kind of)\b/gi,
    )?.length ?? 0;
  if (fillerCount >= 5) {
    issues.push({
      code: "filler-words",
      severity: "info",
      message: `${fillerCount} filler phrases. Cut them; they soften the claim.`,
    });
  }

  const allCapsWords = splitWords(normalized)
    .filter((word) => word.length >= 4)
    .filter((word) => /^[A-Z]+$/.test(word) && !ACRONYMS.has(word));
  if (metrics.words >= 8 && allCapsWords.length / metrics.words > 0.3) {
    issues.push({
      code: "all-caps",
      severity: "warning",
      message: `${allCapsWords.length} words in all caps. It reads as shouting and slows the reader down.`,
    });
  }

  if (metrics.emojiCount > 8) {
    issues.push({
      code: "emoji-heavy",
      severity: "info",
      message: `${metrics.emojiCount} emoji. Keep them where they replace a word, not as decoration.`,
    });
  }
  if (
    metrics.emojiCount > 2 &&
    (input.platform === "email" ||
      input.platform === "reddit" ||
      input.platform === "linkedin")
  ) {
    issues.push({
      code: "emoji-off-platform",
      severity: "warning",
      message: `${metrics.emojiCount} emoji is a lot for ${input.platform}.`,
    });
  }

  if (tags.length > 0) {
    const duplicates = tags.filter(
      (tag, index) => tags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) !== index,
    );
    if (duplicates.length > 0) {
      issues.push({
        code: "duplicate-hashtags",
        severity: "warning",
        message: `Duplicate tags: ${[...new Set(duplicates)].join(", ")}.`,
      });
    }

    const generic = tags.filter((tag) => GENERIC_HASHTAGS.has(tag.toLowerCase()));
    if (generic.length > 0) {
      issues.push({
        code: "generic-hashtags",
        severity: "warning",
        message: `Generic tags: ${generic.join(", ")}. They add noise, not reach.`,
      });
    }
  }

  if (input.kind === "hashtags") {
    if (tags.length === 0) {
      issues.push({
        code: "no-hashtags",
        severity: "error",
        message: "No hashtags found.",
      });
    }
    if (tags.length > 15) {
      issues.push({
        code: "hashtag-pile",
        severity: "warning",
        message: `${tags.length} tags. Pick the ten that describe the post most precisely.`,
      });
    }
  } else {
    const maxByPlatform: Partial<Record<CopyPlatform, number>> = {
      instagram: 10,
      tiktok: 6,
      linkedin: 3,
      x: 1,
      email: 0,
      substack: 0,
      reddit: 0,
    };
    const max = input.platform ? maxByPlatform[input.platform] : undefined;
    if (max !== undefined && tags.length > max) {
      issues.push({
        code: "platform-hashtag-count",
        severity: input.platform === "email" || input.platform === "reddit" ? "warning" : "info",
        message: `${tags.length} hashtags on ${input.platform}; ${max} is the useful ceiling.`,
      });
    }
  }

  if (input.platform === "instagram" && links.length > 0) {
    issues.push({
      code: "instagram-link",
      severity: "warning",
      message: "Instagram captions are not clickable. Say where the link is instead.",
    });
  }
  if (links.length > 2) {
    issues.push({
      code: "many-links",
      severity: "info",
      message: `${links.length} links. More than two splits attention; keep the primary one.`,
    });
  }

  const seen = new Map<string, number>();
  for (const sentence of splitSentences(normalized)) {
    const key = normalizeSentence(sentence);
    if (key.length < 20) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const repeated = [...seen.entries()].filter(([, count]) => count > 1);
  if (repeated.length > 0) {
    issues.push({
      code: "repeated-sentences",
      severity: "warning",
      message: `${repeated.length} sentence(s) repeat within the draft.`,
    });
  }

  if (input.kind === "article") {
    const headings = normalized.match(/^#{2,3} .+/gm)?.length ?? 0;
    if (metrics.words > 600 && headings < 2) {
      issues.push({
        code: "article-headings",
        severity: "info",
        message: `${metrics.words} words with ${headings} subheads. Add one every 200–300 words.`,
      });
    }
    const longParagraph = normalized
      .split(/\n{2,}/)
      .filter((paragraph) => splitWords(paragraph).length > 120);
    if (longParagraph.length > 0) {
      issues.push({
        code: "long-paragraphs",
        severity: "info",
        message: `${longParagraph.length} paragraph(s) over 120 words. Split them for screen reading.`,
      });
    }
  }

  if (input.kind === "email" && input.subject) {
    const subject = input.subject.trim();
    if (subject.length > 90) {
      issues.push({
        code: "long-subject",
        severity: "error",
        message: `Subject is ${subject.length} characters. Keep it under 50, and never past 90.`,
      });
    } else if (subject.length > 50) {
      issues.push({
        code: "long-subject",
        severity: "warning",
        message: `Subject is ${subject.length} characters; mobile clients truncate around 40–50.`,
      });
    }
    if (/^[^a-z]*$/.test(subject) && /[A-Z]/.test(subject)) {
      issues.push({
        code: "shouting-subject",
        severity: "warning",
        message: "The subject is all caps.",
      });
    }
  }

  if (input.kind === "reddit") {
    if (!input.subject) {
      issues.push({
        code: "missing-title",
        severity: "info",
        message: "No title supplied. Check the title length against the 300-character limit.",
      });
    } else if (input.subject.length > REUSE_LIMITS.redditTitle) {
      issues.push({
        code: "long-title",
        severity: "error",
        message: `Title is ${input.subject.length} characters; Reddit allows ${REUSE_LIMITS.redditTitle}.`,
      });
    }

    const selfPromo = findPhrases(normalized, SELF_PROMO_PHRASES);
    if (selfPromo.length > 0) {
      issues.push({
        code: "reddit-self-promo",
        severity: "warning",
        message: `Possible self-promotion: ${selfPromo.slice(0, 2).join(", ")}. Read the subreddit rules and disclose affiliation.`,
      });
    }
  }

  if (input.kind === "script") {
    const analysis = analyzeScript(normalized, { wpm: input.wpm });
    for (const flag of analysis.flags) {
      issues.push({
        code: `script-${flag.code}`,
        severity: flag.severity,
        message: flag.message,
      });
    }
  }

  if (metrics.words >= 120 && metrics.readingEase < 30) {
    issues.push({
      code: "dense-copy",
      severity: "info",
      message: `Reading ease is ${metrics.readingEase}. Shorten sentences and remove subordinate clauses.`,
    });
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        issues.reduce(
          (total, issue) => total + SEVERITY_WEIGHT[issue.severity],
          0,
        ),
    ),
  );

  return {
    score,
    verdict: score >= 85 ? "ship" : score >= 60 ? "revise" : "rewrite",
    issues: issues.sort(
      (a, b) =>
        SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
    ),
    metrics: baseMetrics,
  };
}

export const checkCopyTool = createTool({
  id: "check_copy",
  description:
    "Run deterministic QA on a draft: platform character limits, hook length, AI-slop and engagement-bait phrases, hashtag count and duplicates, links, all-caps, repeated sentences, reading ease, article structure, email subject length and Reddit rules. Returns a score, a verdict and a list of issues.",
  inputSchema: z.object({
    text: z.string().describe("The draft to check."),
    kind: z.enum(COPY_KINDS).describe("What kind of copy this is."),
    platform: z
      .enum(COPY_PLATFORMS)
      .optional()
      .describe("Target platform, when there is one."),
    subject: z
      .string()
      .optional()
      .describe("Email subject line, or Reddit post title."),
    wpm: z
      .number()
      .positive()
      .optional()
      .describe("Words per minute, used for script timing."),
  }),
  outputSchema: z.object({
    score: z.number(),
    verdict: z.enum(["ship", "revise", "rewrite"]),
    issues: z.array(
      z.object({
        code: z.string(),
        severity: z.enum(["info", "warning", "error"]),
        message: z.string(),
      }),
    ),
    metrics: z.object({
      characters: z.number(),
      words: z.number(),
      sentences: z.number(),
      paragraphs: z.number(),
      syllables: z.number(),
      avgWordsPerSentence: z.number(),
      longestSentenceWords: z.number(),
      readingEase: z.number(),
      readingGrade: z.number(),
      emojiCount: z.number(),
      questionCount: z.number(),
      numberCount: z.number(),
      limit: z.number().nullable(),
      hashtags: z.number(),
      links: z.number(),
      firstLineChars: z.number(),
      parts: z.number(),
    }),
  }),
  execute: async ({ kind, text, platform, subject, wpm }) => {
    return checkCopy({ kind, text, platform, subject, wpm });
  },
});

export const qualityTools = {
  check_copy: checkCopyTool,
};
