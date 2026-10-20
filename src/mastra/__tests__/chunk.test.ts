import { describe, expect, it } from "bun:test";

import { chunkText } from "../rag/chunk";

describe("chunkText", () => {
  it("returns nothing for empty or whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("keeps a short post as one chunk", () => {
    const chunks = chunkText("A single short paragraph.");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      index: 0,
      content: "A single short paragraph.",
    });
  });

  it("packs paragraphs up to the limit", () => {
    const text = ["aaa", "bbb", "ccc"].join("\n\n");
    const chunks = chunkText(text, { maxChars: 12, overlapChars: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 12)).toBe(true);
    expect(chunks.map((chunk) => chunk.content).join("\n\n")).toContain("aaa");
  });

  it("numbers chunks in order", () => {
    const text = Array.from({ length: 6 }, (_, i) => `paragraph ${i}`).join(
      "\n\n",
    );
    const chunks = chunkText(text, { maxChars: 40, overlapChars: 0 });

    expect(chunks.map((chunk) => chunk.index)).toEqual(
      chunks.map((_, index) => index),
    );
  });

  it("hard-splits a paragraph that is longer than a chunk", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(words, { maxChars: 100, overlapChars: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 100)).toBe(true);
  });

  it("shares a tail between consecutive chunks", () => {
    const first = "alpha ".repeat(12).trim();
    const second = "beta ".repeat(12).trim();
    const chunks = chunkText(`${first}\n\n${second}`, {
      maxChars: 120,
      overlapChars: 30,
    });

    expect(chunks.length).toBeGreaterThan(1);

    const previousTail = chunks[0]!.content.slice(-30);
    const overlapWord = previousTail.split(" ").pop();
    expect(overlapWord).toBeTruthy();
    expect(chunks[1]!.content).toContain(overlapWord!);
  });

  it("never emits a chunk over the limit", () => {
    const text = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n\n");
    const chunks = chunkText(text, { maxChars: 60, overlapChars: 20 });

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(60);
    }
  });

  it("clamps overlapping to at most half a chunk", () => {
    const text = "x ".repeat(200);
    const chunks = chunkText(text, { maxChars: 100, overlapChars: 90 });

    expect(chunks.every((chunk) => chunk.content.length <= 100)).toBe(true);
  });
});
