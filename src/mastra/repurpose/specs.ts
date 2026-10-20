/**
 * Format playbooks for turning one channel post into several platform-native
 * variants.
 *
 * The limits below are the published product limits at the time of writing;
 * they are guidance for the model, not a hard contract, so every entry carries
 * its own rules rather than a single "max characters" number.
 */

export interface RepurposeTarget {
  id: RepurposeTargetId;
  label: string;
  /** Hard ceiling for the whole variant. */
  maxChars: number;
  /** Per-part ceiling, for targets made of several parts (threads). */
  partChars?: number;
  guidance: string[];
}

export const REPURPOSE_TARGET_IDS = [
  "x-post",
  "x-thread",
  "linkedin-post",
  "instagram-caption",
  "newsletter",
  "short-video-script",
] as const;

export type RepurposeTargetId = (typeof REPURPOSE_TARGET_IDS)[number];

export const REPURPOSE_TARGETS: readonly RepurposeTarget[] = [
  {
    id: "x-post",
    label: "X post",
    maxChars: 280,
    guidance: [
      "One idea, no preamble.",
      "Lead with the specific claim or number, not the setup.",
      "At most one hashtag, and only if it is a real community tag.",
      "No 'thread below' unless the thread target is also requested.",
    ],
  },
  {
    id: "x-thread",
    label: "X thread",
    maxChars: 2_800,
    partChars: 280,
    guidance: [
      "Number the parts; each part must stand alone if quoted.",
      "Part 1 is the hook and must be under 280 characters on its own.",
      "End with a concrete takeaway, not a call to follow.",
      "Do not pad to a target length — three good parts beat nine thin ones.",
    ],
  },
  {
    id: "linkedin-post",
    label: "LinkedIn post",
    maxChars: 3_000,
    guidance: [
      "First two lines are the hook; they are all that shows before 'see more'.",
      "Short paragraphs, one idea each, generous line breaks.",
      "No hashtag pile-ups — three relevant tags maximum, at the end.",
      "Close with a question or a clear next step.",
    ],
  },
  {
    id: "instagram-caption",
    label: "Instagram caption",
    maxChars: 2_200,
    guidance: [
      "First 125 characters are the only text shown before the fold.",
      "Write for a reader who cannot click; no bare URLs.",
      "Use line breaks for rhythm; emoji sparingly and never as bullets.",
      "Hashtags, if any, go at the end in one block.",
    ],
  },
  {
    id: "newsletter",
    label: "Newsletter section",
    maxChars: 5_000,
    guidance: [
      "Give it a heading and one short intro sentence.",
      "Expand the source post: add the context a feed reader would already have.",
      "Include one actionable takeaway in a short list.",
      "Plain text, no markdown tables.",
    ],
  },
  {
    id: "short-video-script",
    label: "Short video script",
    maxChars: 6_000,
    guidance: [
      "Structure as HOOK / BODY / CTA with timestamps in seconds.",
      "First three seconds must state the payoff.",
      "Write spoken language, not prose — short sentences, no semicolons.",
      "Describe the on-screen visual for each beat.",
    ],
  },
];

const TARGET_INDEX = new Map(
  REPURPOSE_TARGETS.map((target) => [target.id, target] as const),
);

export function resolveRepurposeTargets(
  ids?: readonly string[],
): RepurposeTarget[] {
  if (!ids || ids.length === 0) return [...REPURPOSE_TARGETS];

  const seen = new Set<string>();
  const resolved: RepurposeTarget[] = [];

  for (const id of ids) {
    const target = TARGET_INDEX.get(id as RepurposeTargetId);
    if (!target || seen.has(target.id)) continue;
    seen.add(target.id);
    resolved.push(target);
  }

  return resolved;
}

export interface RepurposeSource {
  id: string;
  type: string;
  content: string;
  media: string[];
}

export interface RepurposeBrief {
  source: RepurposeSource;
  targets: RepurposeTarget[];
  instructions: string[];
}

export const REPURPOSE_INSTRUCTIONS = [
  "Draft one variant per requested target. Do not merge two targets into one.",
  "Keep every fact, number and name from the source post. Never invent a statistic, quote, link or date.",
  "Re-voice for the platform; do not copy the same sentences across targets.",
  "Keep the author's stance. This is a repurposing task, not a rewrite of the argument.",
  "Return one labelled block per target, in the order requested, and nothing else.",
];

export function buildRepurposeBrief(
  source: RepurposeSource,
  targetIds?: readonly string[],
): RepurposeBrief {
  return {
    source,
    targets: resolveRepurposeTargets(targetIds),
    instructions: REPURPOSE_INSTRUCTIONS,
  };
}
