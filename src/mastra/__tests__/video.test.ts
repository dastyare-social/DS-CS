import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  analyzeScript,
  parseTranscript,
  timestampToSeconds,
  transcribeMedia,
} from "../tools/video";

const originalTranscriptionKey = process.env.TRANSCRIPTION_API_KEY;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  delete process.env.TRANSCRIPTION_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  if (originalTranscriptionKey === undefined) {
    delete process.env.TRANSCRIPTION_API_KEY;
  } else {
    process.env.TRANSCRIPTION_API_KEY = originalTranscriptionKey;
  }

  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
});

describe("timestampToSeconds", () => {
  it("parses SRT and VTT timestamps", () => {
    expect(timestampToSeconds("00:00:01,500")).toBe(1.5);
    expect(timestampToSeconds("00:01:02.250")).toBe(62.25);
    expect(timestampToSeconds("01:02:03.000")).toBe(3723);
  });

  it("rejects non-timestamps", () => {
    expect(timestampToSeconds("hello")).toBeNull();
  });
});

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world.

2
00:00:04,500 --> 00:00:06,000
Second line.`;

const VTT = `WEBVTT

00:00:00.500 --> 00:00:02.000
<v Speaker>Welcome back.

00:00:02.500 --> 00:00:05.000
Today we test the flow.`;

describe("parseTranscript", () => {
  it("returns empty output for empty input", () => {
    expect(parseTranscript("   ")).toEqual({
      format: "plain",
      text: "",
      cues: [],
      durationSeconds: null,
    });
  });

  it("parses SRT cues and duration", () => {
    const parsed = parseTranscript(SRT);

    expect(parsed.format).toBe("srt");
    expect(parsed.cues).toHaveLength(2);
    expect(parsed.text).toBe("Hello world. Second line.");
    expect(parsed.durationSeconds).toBe(6);
  });

  it("parses WebVTT and strips inline markup", () => {
    const parsed = parseTranscript(VTT);

    expect(parsed.format).toBe("vtt");
    expect(parsed.text).toBe("Welcome back. Today we test the flow.");
    expect(parsed.cues[0]?.text).toBe("Welcome back.");
    expect(parsed.durationSeconds).toBe(5);
  });

  it("treats untimed text as a plain transcript", () => {
    const parsed = parseTranscript("Just a script with no timestamps.");

    expect(parsed.format).toBe("plain");
    expect(parsed.cues).toEqual([]);
    expect(parsed.text).toBe("Just a script with no timestamps.");
  });
});

describe("analyzeScript", () => {
  it("reports an empty script as an error", () => {
    const analysis = analyzeScript("");

    expect(analysis.flags[0]?.code).toBe("empty");
    expect(analysis.metrics.words).toBe(0);
  });

  it("measures words, sentences and CTA presence", () => {
    const analysis = analyzeScript(
      "We cut onboarding from 41% to 58% in two weeks. Subscribe for the breakdown.",
    );

    expect(analysis.metrics.words).toBeGreaterThan(10);
    expect(analysis.metrics.sentences).toBe(2);
    expect(analysis.metrics.hasCta).toBe(true);
    expect(analysis.metrics.numberCount).toBeGreaterThan(0);
  });

  it("flags a generic greeting as the opening", () => {
    const analysis = analyzeScript(
      "Hey guys, welcome back to the channel. Today we test the new flow.",
    );

    expect(analysis.flags.some((flag) => flag.code === "formulaic-opening")).toBe(
      true,
    );
  });

  it("flags filler words", () => {
    const analysis = analyzeScript(
      "um uh you know basically sort of this is the point.",
    );

    expect(analysis.metrics.fillerCount).toBeGreaterThanOrEqual(4);
    expect(analysis.flags.some((flag) => flag.code === "filler-words")).toBe(
      true,
    );
  });

  it("flags a pace that is too fast for the runtime", () => {
    const script = `${"word ".repeat(120)}Subscribe.`;
    const analysis = analyzeScript(script, { durationSeconds: 20 });

    expect(analysis.metrics.paceWpm).toBeGreaterThan(190);
    expect(analysis.flags.some((flag) => flag.code === "fast-pace")).toBe(true);
  });

  it("flags a late first cue", () => {
    const analysis = analyzeScript(
      `1
00:00:05,000 --> 00:00:08,000
Here is the point.

2
00:00:08,500 --> 00:00:10,000
Subscribe.`,
    );

    expect(analysis.flags.some((flag) => flag.code === "late-hook")).toBe(true);
  });

  it("estimates duration from words when no runtime is given", () => {
    const analysis = analyzeScript(
      "One two three four five six seven eight nine ten.",
      { wpm: 100 },
    );

    expect(analysis.metrics.estimatedDurationSeconds).toBe(6);
  });
});

describe("transcribeMedia", () => {
  it("explains that transcription is not configured", async () => {
    const result = await transcribeMedia({
      url: "https://cdn.example.com/audio.mp3",
    });

    expect(result.provider).toBe("none");
    expect(result.note).toContain("TRANSCRIPTION_API_KEY");
  });

  it("refuses a platform page before asking for a key", async () => {
    const result = await transcribeMedia({
      url: "https://www.youtube.com/watch?v=abc",
    });

    expect(result.note).toContain("platform page");
  });

  it("rejects a malformed URL", async () => {
    const result = await transcribeMedia({ url: "not a url" });

    expect(result.note).toContain("not a valid URL");
  });
});
