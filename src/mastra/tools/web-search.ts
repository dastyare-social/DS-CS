import { createTool, webFetchTool } from "@mastra/core/tools";
import { z } from "zod";

import type { SearchProvider } from "../config";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_TIMEOUT_MS = 15_000;

const freshnessSchema = z.enum(["day", "week", "month", "year"]);

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface WebSearchResponse {
  provider: SearchProvider | "none";
  query: string;
  results: WebSearchResult[];
  /** Present when no provider is configured, or the provider returned nothing. */
  note?: string;
}

/**
 * Mastra's built-in `webSearchTool` is a provider-defined tool: it only works
 * when the model itself can search (OpenAI, Anthropic, Google, xAI) and throws
 * for router providers such as OpenRouter. The agent model is OpenRouter, so
 * search is backed by an explicit provider instead.
 */
export function detectSearchProvider(): SearchProvider | null {
  if (process.env.TAVILY_API_KEY?.trim()) return "tavily";
  if (process.env.BRAVE_SEARCH_API_KEY?.trim()) return "brave";
  return null;
}

export function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 5;
  return Math.min(10, Math.max(1, Math.round(value as number)));
}

export function mapTavilyResults(payload: unknown, limit: number): WebSearchResult[] {
  const results = (payload as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];

  return results
    .slice(0, limit)
    .flatMap((entry): WebSearchResult[] => {
      const item = entry as {
        title?: unknown;
        url?: unknown;
        content?: unknown;
        published_date?: unknown;
      };
      if (typeof item.url !== "string" || !item.url) return [];

      return [
        {
          title: typeof item.title === "string" ? item.title : item.url,
          url: item.url,
          snippet: typeof item.content === "string" ? item.content : "",
          publishedAt:
            typeof item.published_date === "string"
              ? item.published_date
              : undefined,
        },
      ];
    });
}

export function mapBraveResults(payload: unknown, limit: number): WebSearchResult[] {
  const results = (payload as { web?: { results?: unknown } })?.web?.results;
  if (!Array.isArray(results)) return [];

  return results
    .slice(0, limit)
    .flatMap((entry): WebSearchResult[] => {
      const item = entry as {
        title?: unknown;
        url?: unknown;
        description?: unknown;
        age?: unknown;
      };
      if (typeof item.url !== "string" || !item.url) return [];

      return [
        {
          title: typeof item.title === "string" ? item.title : item.url,
          url: item.url,
          snippet: typeof item.description === "string" ? item.description : "",
          publishedAt: typeof item.age === "string" ? item.age : undefined,
        },
      ];
    });
}

function tavilyDays(freshness: z.infer<typeof freshnessSchema> | undefined) {
  switch (freshness) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
    case "year":
      return 365;
    default:
      return undefined;
  }
}

async function searchTavily(
  query: string,
  limit: number,
  freshness?: z.infer<typeof freshnessSchema>,
): Promise<WebSearchResult[]> {
  const response = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TAVILY_API_KEY?.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      max_results: limit,
      search_depth: "basic",
      include_answer: false,
      topic: "general",
      ...(tavilyDays(freshness) ? { days: tavilyDays(freshness) } : {}),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with ${response.status}`);
  }

  return mapTavilyResults(await response.json(), limit);
}

function braveFreshness(freshness: z.infer<typeof freshnessSchema> | undefined) {
  switch (freshness) {
    case "day":
      return "pd";
    case "week":
      return "pw";
    case "month":
      return "pm";
    case "year":
      return "py";
    default:
      return undefined;
  }
}

async function searchBrave(
  query: string,
  limit: number,
  freshness?: z.infer<typeof freshnessSchema>,
): Promise<WebSearchResult[]> {
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(limit));
  const range = braveFreshness(freshness);
  if (range) url.searchParams.set("freshness", range);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY?.trim() ?? "",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Brave search failed with ${response.status}`);
  }

  return mapBraveResults(await response.json(), limit);
}

/**
 * Runs one search against whichever provider is configured. When neither is,
 * the tool answers with a `note` instead of throwing: a clear "not configured"
 * is better for the model than a tool error it will try to work around.
 */
export async function runWebSearch({
  query,
  limit,
  freshness,
}: {
  query: string;
  limit?: number;
  freshness?: z.infer<typeof freshnessSchema>;
}): Promise<WebSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      provider: "none",
      query,
      results: [],
      note: "Empty query.",
    };
  }

  const provider = detectSearchProvider();
  if (!provider) {
    return {
      provider: "none",
      query: trimmed,
      results: [],
      note: "Web search is not configured. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY. You can still read a specific URL with web_fetch.",
    };
  }

  const max = clampLimit(limit);
  const results =
    provider === "tavily"
      ? await searchTavily(trimmed, max, freshness)
      : await searchBrave(trimmed, max, freshness);

  return {
    provider,
    query: trimmed,
    results,
    ...(results.length === 0
      ? { note: "No results. Try a broader query." }
      : {}),
  };
}

const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  publishedAt: z.string().optional(),
});

export const webSearch = createTool({
  id: "web_search",
  description:
    "Search the public web for current information: news, competitor channels, platform policy changes, or references. Returns titles, URLs and snippets. Use web_fetch to read a result in full.",
  inputSchema: z.object({
    query: z.string().describe("What to search for."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("How many results to return (default 5)."),
    freshness: freshnessSchema
      .optional()
      .describe("Restrict results to the last day, week, month or year."),
  }),
  outputSchema: z.object({
    provider: z.enum(["tavily", "brave", "none"]),
    query: z.string(),
    results: z.array(searchResultSchema),
    note: z.string().optional(),
  }),
  execute: async ({ query, limit, freshness }) =>
    runWebSearch({ query, limit, freshness }),
});

/**
 * Built-in plain fetch (no API key, no provider dependency). Kept alongside
 * `web_search` so the agent can always read a URL it was given, even when no
 * search provider is configured.
 */
export const zernioWebTools = {
  web_search: webSearch,
  web_fetch: webFetchTool,
};
