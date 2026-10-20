import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { splitSentences, splitWords, textMetrics } from "../text/metrics";

const TRANSCRIPTION_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_WPM = 150;

/**
 * Hosts that serve an HTML page rather than a media file. Transcription works
 * on direct media URLs only: scraping a platform page is both brittle and a
 * terms-of-service problem, so the tool asks for the transcript instead of
 * pretending it can fetch one.
 */
const PLATFORM_PAGE_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "vimeo.com",
  "twitch.tv",
  "reddit.com",
];

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
}

export interface ParsedTranscript {
  format: "srt" | "vtt" | "plain";
  text: string;
  cues: TranscriptCue[];
  durationSeconds: number | null;
}

export function timestampToSeconds(value: string): number | null {
  const match = value
    .trim()
    .match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);
  if (!match) return null;

  const hours = match[1] ? Number(match[1]) : 0;
  return (
    hours * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4].padEnd(3, "0")) / 1000
  );
}

function stripCueMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Accepts SRT, WebVTT or a plain transcript. Timestamps are optional: a plain
 * transcript is still analysable, it just cannot report cue pace.
 */
export function parseTranscript(raw: string): ParsedTranscript {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return { format: "plain", text: "", cues: [], durationSeconds: null };
  }

  const isVtt = normalized.startsWith("WEBVTT");
  const cues: TranscriptCue[] = [];

  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.trim());
    const arrowIndex = lines.findIndex((line) => line.includes("-->"));
    if (arrowIndex === -1) continue;

    const [startRaw, endRaw] = lines[arrowIndex]
      .split("-->")
      .map((part) => part.trim().split(/\s+/)[0]);
    const start = timestampToSeconds(startRaw);
    const end = timestampToSeconds(endRaw);
    const text = stripCueMarkup(lines.slice(arrowIndex + 1).join(" "));

    if (start === null || end === null || !text) continue;
    cues.push({ start, end, text });
  }

  if (cues.length === 0) {
    return {
      format: "plain",
      text: stripCueMarkup(normalized),
      cues: [],
      durationSeconds: null,
    };
  }

  return {
    format: isVtt ? "vtt" : "srt",
    text: cues.map((cue) => cue.text).join(" "),
    cues,
    durationSeconds: cues[cues.length - 1]!.end,
  };
}

export type ScriptSeverity = "info" | "warning" | "error";

export interface ScriptFlag {
  code: string;
  severity: ScriptSeverity;
  message: string;
}

export interface ScriptAnalysis {
  metrics: ReturnType<typeof textMetrics> & {
    estimatedDurationSeconds: number;
    paceWpm: number;
    fillerCount: number;
    hasCta: boolean;
    hook: string;
  };
  flags: ScriptFlag[];
}

const FILLER_RE =
  /\b(?:um+|uh+|erm+|you know|basically|actually|literally|sort of|kind of|i mean)\b/gi;
const CTA_RE =
  /\b(?:subscribe|follow|comment|share|save this|link in bio|sign up|book a call|download|buy|shop|join|click|tap|visit|check out)\b/i;
const FORMULAIC_OPENING_RE =
  /^(?:hey guys|hi guys|hi everyone|hello everyone|welcome back|in this video|today we(?:'| a)?re going to|let'?s dive in)/i;

export function analyzeScript(
  raw: string,
  options: { durationSeconds?: number | null; wpm?: number } = {},
): ScriptAnalysis {
  const parsed = parseTranscript(raw);
  const text = parsed.text;
  const metrics = textMetrics(text);
  const wpm =
    Number.isFinite(options.wpm) && (options.wpm as number) > 0
      ? (options.wpm as number)
      : DEFAULT_WPM;
  const durationSeconds =
    options.durationSeconds && options.durationSeconds > 0
      ? options.durationSeconds
      : parsed.durationSeconds;

  const sentences = splitSentences(text);
  const firstSentence = sentences[0] ?? "";
  const hook = (firstSentence || splitWords(text).slice(0, 12).join(" ")).slice(
    0,
    160,
  );
  const fillerCount = text.match(FILLER_RE)?.length ?? 0;
  const hasCta = CTA_RE.test(text);
  const estimatedDurationSeconds = durationSeconds
    ? Math.round(durationSeconds)
    : Math.round((metrics.words / wpm) * 60);
  const paceWpm = durationSeconds
    ? Math.round(metrics.words / (durationSeconds / 60))
    : wpm;

  const flags: ScriptFlag[] = [];

  if (!text.trim()) {
    flags.push({
      code: "empty",
      severity: "error",
      message: "No transcript or script text to analyse.",
    });
    return {
      metrics: {
        ...metrics,
        estimatedDurationSeconds: 0,
        paceWpm: 0,
        fillerCount: 0,
        hasCta: false,
        hook: "",
      },
      flags,
    };
  }

  const firstCueStart = parsed.cues[0]?.start;
  if (typeof firstCueStart === "number" && firstCueStart > 3) {
    flags.push({
      code: "late-hook",
      severity: "warning",
      message: `The first spoken line starts at ${firstCueStart.toFixed(1)}s. Put the payoff inside the first three seconds.`,
    });
  }

  if (FORMULAIC_OPENING_RE.test(firstSentence)) {
    flags.push({
      code: "formulaic-opening",
      severity: "warning",
      message:
        "The opening is a generic greeting. Start with the claim, the number or the contradiction instead.",
    });
  }

  if (splitWords(firstSentence).length > 28) {
    flags.push({
      code: "long-hook",
      severity: "warning",
      message: `The first sentence is ${splitWords(firstSentence).length} words. A spoken hook should be under 20.`,
    });
  }

  if (splitWords(hook).length < 4) {
    flags.push({
      code: "thin-hook",
      severity: "warning",
      message: "The hook is too short to say anything specific.",
    });
  }

  if (fillerCount >= 4) {
    flags.push({
      code: "filler-words",
      severity: "info",
      message: `${fillerCount} filler phrases (um, you know, basically…). Cut them; they cost seconds without adding meaning.`,
    });
  }

  if (metrics.avgWordsPerSentence > 24 || metrics.longestSentenceWords > 35) {
    flags.push({
      code: "long-sentences",
      severity: "warning",
      message: `Average sentence ${metrics.avgWordsPerSentence} words, longest ${metrics.longestSentenceWords}. Spoken lines should be one clause at a time.`,
    });
  }

  if (durationSeconds && paceWpm > 190) {
    flags.push({
      code: "fast-pace",
      severity: "warning",
      message: `${paceWpm} words per minute is too fast for a spoken script (comfortable range is 130–170).`,
    });
  }

  if (durationSeconds && paceWpm < 100) {
    flags.push({
      code: "slow-pace",
      severity: "info",
      message: `${paceWpm} words per minute leaves a lot of silence. Check for dead air or under-written beats.`,
    });
  }

  if (estimatedDurationSeconds >= 20 && !hasCta) {
    flags.push({
      code: "no-cta",
      severity: "info",
      message:
        "No call to action detected. If the video asks for something (follow, comment, link), say it explicitly.",
    });
  }

  if (metrics.numberCount === 0 && metrics.words >= 40) {
    flags.push({
      code: "no-specifics",
      severity: "info",
      message:
        "No numbers in the script. One concrete figure usually beats three adjectives.",
    });
  }

  if (metrics.words >= 80 && metrics.readingEase < 30) {
    flags.push({
      code: "dense-language",
      severity: "warning",
      message: `Reading ease is ${metrics.readingEase}. Simplify the sentences; this is meant to be spoken.`,
    });
  }

  return {
    metrics: {
      ...metrics,
      estimatedDurationSeconds,
      paceWpm,
      fillerCount,
      hasCta,
      hook,
    },
    flags,
  };
}

export interface TranscriptionConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxBytes: number;
}

export function transcriptionConfig(): TranscriptionConfig | null {
  const apiKey =
    process.env.TRANSCRIPTION_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const configuredMax = Number(process.env.TRANSCRIPTION_MAX_BYTES);
  const maxBytes =
    Number.isFinite(configuredMax) && configuredMax > 0
      ? Math.floor(configuredMax)
      : DEFAULT_MAX_BYTES;

  return {
    apiKey,
    baseUrl: (
      process.env.TRANSCRIPTION_BASE_URL?.trim() || "https://api.openai.com/v1"
    ).replace(/\/+$/, ""),
    model: process.env.TRANSCRIPTION_MODEL?.trim() || "whisper-1",
    maxBytes,
  };
}

export interface TranscriptionResult {
  text: string;
  cues: TranscriptCue[];
  durationSeconds: number | null;
  provider: "openai-compatible" | "none";
  note?: string;
}

function isPlatformPage(url: URL): boolean {
  return PLATFORM_PAGE_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

function failure(note: string): TranscriptionResult {
  return {
    text: "",
    cues: [],
    durationSeconds: null,
    provider: "none",
    note,
  };
}

function fileNameFor(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).pop();
  return last && last.includes(".") ? last : "media";
}

/**
 * Transcribes a direct audio/video URL through an OpenAI-compatible
 * `/audio/transcriptions` endpoint. Returns a readable `note` instead of
 * throwing when nothing is configured, matching `web_search`.
 */
export async function transcribeMedia({
  url,
  language,
  prompt,
}: {
  url: string;
  language?: string;
  prompt?: string;
}): Promise<TranscriptionResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return failure(`"${url}" is not a valid URL.`);
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    return failure("Only http(s) URLs can be transcribed.");
  }

  if (isPlatformPage(parsedUrl)) {
    return failure(
      "That is a platform page, not a direct media file. Pass a direct audio/video URL, or paste the transcript into analyze_video.",
    );
  }

  const config = transcriptionConfig();
  if (!config) {
    return failure(
      "Transcription is not configured. Set TRANSCRIPTION_API_KEY (or OPENAI_API_KEY), or paste the transcript into analyze_video.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);

  try {
    const mediaResponse = await fetch(parsedUrl, {
      signal: controller.signal,
      redirect: "follow",
    });

    if (!mediaResponse.ok) {
      return failure(
        `Could not download the media (HTTP ${mediaResponse.status}). The URL must be publicly reachable.`,
      );
    }

    const contentType = mediaResponse.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      return failure(
        "That URL returned an HTML page, not media. Use a direct audio/video URL or paste the transcript.",
      );
    }

    const declaredLength = Number(
      mediaResponse.headers.get("content-length") ?? 0,
    );
    if (declaredLength > config.maxBytes) {
      return failure(
        `The file is ${Math.round(declaredLength / 1024 / 1024)} MB, over the ${Math.round(config.maxBytes / 1024 / 1024)} MB transcription limit.`,
      );
    }

    const buffer = await mediaResponse.arrayBuffer();
    if (buffer.byteLength > config.maxBytes) {
      return failure(
        `The file is ${Math.round(buffer.byteLength / 1024 / 1024)} MB, over the ${Math.round(config.maxBytes / 1024 / 1024)} MB transcription limit.`,
      );
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer], {
        type: contentType || "application/octet-stream",
      }),
      fileNameFor(parsedUrl),
    );
    form.append("model", config.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (language) form.append("language", language);
    if (prompt) form.append("prompt", prompt);

    const transcriptionResponse = await fetch(
      `${config.baseUrl}/audio/transcriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal: controller.signal,
      },
    );

    if (!transcriptionResponse.ok) {
      const detail = (await transcriptionResponse.text()).slice(0, 300);
      return failure(
        `Transcription failed (HTTP ${transcriptionResponse.status}): ${detail || "no detail returned"}`,
      );
    }

    const payload = (await transcriptionResponse.json()) as {
      text?: unknown;
      duration?: unknown;
      segments?: Array<{ start?: unknown; end?: unknown; text?: unknown }>;
    };

    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const segments = Array.isArray(payload.segments) ? payload.segments : [];
    const cues = segments.flatMap((segment): TranscriptCue[] => {
      if (
        typeof segment.start !== "number" ||
        typeof segment.end !== "number" ||
        typeof segment.text !== "string"
      ) {
        return [];
      }
      return [
        {
          start: segment.start,
          end: segment.end,
          text: segment.text.trim(),
        },
      ];
    });

    const durationSeconds =
      typeof payload.duration === "number"
        ? payload.duration
        : cues.length
          ? cues[cues.length - 1]!.end
          : null;

    if (!text) {
      return failure("The transcription provider returned no text.");
    }

    return {
      text,
      cues,
      durationSeconds,
      provider: "openai-compatible",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return failure("Transcription timed out.");
    }
    return failure(
      `Transcription failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

const cueSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

const flagSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
});

const metricsSchema = z.object({
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
  estimatedDurationSeconds: z.number(),
  paceWpm: z.number(),
  fillerCount: z.number(),
  hasCta: z.boolean(),
  hook: z.string(),
});

export const transcribeMediaTool = createTool({
  id: "transcribe_media",
  description:
    "Transcribe a publicly reachable audio or video file (direct media URL) through an OpenAI-compatible transcription endpoint. Returns the transcript, timed cues and duration. For a platform page (YouTube, TikTok, Instagram…) paste the transcript into analyze_video instead.",
  inputSchema: z.object({
    url: z.string().describe("Direct http(s) URL to an audio or video file."),
    language: z
      .string()
      .optional()
      .describe("Optional ISO language hint, e.g. en or fa."),
    prompt: z
      .string()
      .optional()
      .describe(
        "Optional vocabulary hint (names, product terms) to improve recognition.",
      ),
  }),
  outputSchema: z.object({
    text: z.string(),
    cues: z.array(cueSchema),
    durationSeconds: z.number().nullable(),
    provider: z.enum(["openai-compatible", "none"]),
    note: z.string().optional(),
  }),
  execute: async ({ url, language, prompt }) => {
    return transcribeMedia({ url, language, prompt });
  },
});

export const analyzeScriptTool = createTool({
  id: "analyze_script",
  description:
    "Analyse a video script or transcript without a model: hook, pacing, filler words, sentence length, readability, CTA and specificity, with concrete flags. Accepts plain text, SRT or WebVTT.",
  inputSchema: z.object({
    transcript: z
      .string()
      .describe("The script or transcript, plain text, SRT or WebVTT."),
    durationSeconds: z
      .number()
      .positive()
      .optional()
      .describe("Known runtime in seconds. Omit to estimate from word count."),
    wpm: z
      .number()
      .positive()
      .optional()
      .describe("Word-per-minute assumption when duration is unknown."),
  }),
  outputSchema: z.object({
    metrics: metricsSchema,
    flags: z.array(flagSchema),
  }),
  execute: async ({ transcript, durationSeconds, wpm }) => {
    return analyzeScript(transcript, { durationSeconds, wpm });
  },
});

export const analyzeVideoTool = createTool({
  id: "analyze_video",
  description:
    "Analyse a video end to end: transcribe a direct media URL when needed, then report hook, pacing, filler, readability, CTA and specificity. Accepts a URL, a pasted transcript (plain, SRT or WebVTT), or both.",
  inputSchema: z.object({
    url: z
      .string()
      .optional()
      .describe("Direct audio/video URL to transcribe when no transcript is given."),
    transcript: z
      .string()
      .optional()
      .describe("A pasted transcript or script; plain text, SRT or WebVTT."),
    language: z.string().optional().describe("Optional ISO language hint."),
    wpm: z
      .number()
      .positive()
      .optional()
      .describe("Word-per-minute assumption when duration is unknown."),
  }),
  outputSchema: z.object({
    source: z.enum(["transcript", "transcription", "none"]),
    format: z.enum(["srt", "vtt", "plain"]),
    text: z.string(),
    cues: z.array(cueSchema),
    durationSeconds: z.number().nullable(),
    metrics: metricsSchema.nullable(),
    flags: z.array(flagSchema),
    note: z.string().optional(),
  }),
  execute: async ({ url, transcript, language, wpm }) => {
    let parsed = transcript
      ? parseTranscript(transcript)
      : { format: "plain" as const, text: "", cues: [], durationSeconds: null };
    let source: "transcript" | "transcription" | "none" = transcript
      ? "transcript"
      : "none";
    let note: string | undefined;

    if (!parsed.text.trim() && url) {
      const transcription = await transcribeMedia({ url, language });
      if (transcription.text) {
        parsed = {
          format: "plain",
          text: transcription.text,
          cues: transcription.cues,
          durationSeconds: transcription.durationSeconds,
        };
        source = "transcription";
      } else {
        note = transcription.note;
      }
    }

    if (!parsed.text.trim()) {
      return {
        source,
        format: parsed.format,
        text: "",
        cues: parsed.cues,
        durationSeconds: parsed.durationSeconds,
        metrics: null,
        flags: [],
        ...(note ? { note } : {}),
      };
    }

    const analysis = analyzeScript(parsed.text, {
      durationSeconds: parsed.durationSeconds,
      wpm,
    });

    return {
      source,
      format: parsed.format,
      text: parsed.text,
      cues: parsed.cues,
      durationSeconds: parsed.durationSeconds,
      metrics: analysis.metrics,
      flags: analysis.flags,
      ...(note ? { note } : {}),
    };
  },
});

export const videoTools = {
  transcribe_media: transcribeMediaTool,
  analyze_script: analyzeScriptTool,
  analyze_video: analyzeVideoTool,
};
