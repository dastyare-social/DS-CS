import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  clampLimit,
  detectSearchProvider,
  mapBraveResults,
  mapTavilyResults,
  runWebSearch,
} from "../tools/web-search";

const originalTavily = process.env.TAVILY_API_KEY;
const originalBrave = process.env.BRAVE_SEARCH_API_KEY;

function clearKeys() {
  delete process.env.TAVILY_API_KEY;
  delete process.env.BRAVE_SEARCH_API_KEY;
}

beforeEach(clearKeys);

afterEach(() => {
  if (originalTavily === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalTavily;

  if (originalBrave === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY = originalBrave;
});

describe("detectSearchProvider", () => {
  it("returns null when nothing is configured", () => {
    expect(detectSearchProvider()).toBeNull();
  });

  it("prefers Tavily when both keys are present", () => {
    process.env.TAVILY_API_KEY = "tvly-test";
    process.env.BRAVE_SEARCH_API_KEY = "brave-test";
    expect(detectSearchProvider()).toBe("tavily");
  });

  it("falls back to Brave", () => {
    process.env.BRAVE_SEARCH_API_KEY = "brave-test";
    expect(detectSearchProvider()).toBe("brave");
  });

  it("ignores blank values", () => {
    process.env.TAVILY_API_KEY = "   ";
    expect(detectSearchProvider()).toBeNull();
  });
});

describe("clampLimit", () => {
  it("defaults to five", () => {
    expect(clampLimit(undefined)).toBe(5);
    expect(clampLimit(Number.NaN)).toBe(5);
  });

  it("bounds to 1..10 and rounds", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(99)).toBe(10);
    expect(clampLimit(4.4)).toBe(4);
  });
});

describe("mapTavilyResults", () => {
  it("maps a normal payload", () => {
    const results = mapTavilyResults(
      {
        results: [
          {
            title: "Primary source",
            url: "https://example.com/a",
            content: "A snippet",
            published_date: "2026-10-01",
          },
        ],
      },
      5,
    );

    expect(results).toEqual([
      {
        title: "Primary source",
        url: "https://example.com/a",
        snippet: "A snippet",
        publishedAt: "2026-10-01",
      },
    ]);
  });

  it("drops entries without a URL and tolerates missing fields", () => {
    const results = mapTavilyResults(
      { results: [{ title: "no url" }, { url: "https://example.com/b" }] },
      5,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("https://example.com/b");
    expect(results[0]?.snippet).toBe("");
  });

  it("returns an empty list for a malformed payload", () => {
    expect(mapTavilyResults(null, 5)).toEqual([]);
    expect(mapTavilyResults({ results: "nope" }, 5)).toEqual([]);
  });

  it("honours the limit", () => {
    const payload = {
      results: [
        { url: "https://example.com/1" },
        { url: "https://example.com/2" },
        { url: "https://example.com/3" },
      ],
    };
    expect(mapTavilyResults(payload, 2)).toHaveLength(2);
  });
});

describe("mapBraveResults", () => {
  it("maps web results", () => {
    expect(
      mapBraveResults(
        {
          web: {
            results: [
              {
                title: "Brave result",
                url: "https://example.com/c",
                description: "Description",
                age: "2 days ago",
              },
            ],
          },
        },
        5,
      ),
    ).toEqual([
      {
        title: "Brave result",
        url: "https://example.com/c",
        snippet: "Description",
        publishedAt: "2 days ago",
      },
    ]);
  });

  it("returns an empty list when web results are missing", () => {
    expect(mapBraveResults({}, 5)).toEqual([]);
  });
});

describe("runWebSearch", () => {
  it("explains that search is not configured instead of throwing", async () => {
    const response = await runWebSearch({ query: "mastra subagents" });

    expect(response.provider).toBe("none");
    expect(response.results).toEqual([]);
    expect(response.note).toContain("TAVILY_API_KEY");
  });

  it("rejects an empty query without calling out", async () => {
    const response = await runWebSearch({ query: "   " });

    expect(response.provider).toBe("none");
    expect(response.note).toBe("Empty query.");
  });
});
