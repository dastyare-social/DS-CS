import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { searchChannelKnowledge } from "../rag/search";

export const searchChannel = createTool({
  id: "search_channel",
  description:
    "Retrieve passages from this channel's own posts to ground an answer: what the channel already published, which claims were made, how a topic was phrased before. Uses full-text retrieval, upgraded to semantic search when embeddings are configured.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("What to look for, phrased as the topic rather than a SQL query."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum passages to return (default 6)."),
  }),
  outputSchema: z.object({
    mode: z.enum(["keyword", "semantic", "hybrid"]),
    hits: z.array(
      z.object({
        sourceType: z.literal("post"),
        sourceId: z.string(),
        content: z.string(),
        score: z.number(),
        createdAt: z.string().nullable().optional(),
      }),
    ),
    note: z.string().optional(),
  }),
  execute: async ({ query, limit }) => searchChannelKnowledge({ query, limit }),
});

export const knowledgeTools = {
  search_channel: searchChannel,
};
