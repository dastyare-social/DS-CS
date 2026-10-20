import { sql } from "drizzle-orm";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  countPosts,
  getPostById,
  getPostsWithReactions,
  type PostWithReactions,
} from "@/lib/api/posts";
import { countStories } from "@/lib/api/stories";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

function mediaSummary(post: PostWithReactions) {
  const media = post.media;
  if (!media) return [];

  return Array.isArray(media) ? media : [media];
}

function toPostSummary(post: PostWithReactions) {
  return {
    id: post.id,
    type: post.type,
    content: post.content ?? "",
    views: Number(post.views) || 0,
    pinned: post.pinnedAt !== null,
    createdAt: post.createdAt?.toISOString() ?? null,
    mediaCount: mediaSummary(post).length,
    reactions: post.reactions.map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
    })),
  };
}

function toMediaUrls(post: PostWithReactions) {
  return mediaSummary(post).flatMap((item) => {
    const url = (item as { url?: unknown })?.url;
    return typeof url === "string" ? [url] : [];
  });
}

async function channelTotals() {
  // `views` is a text column, so guard the cast: a single malformed row would
  // otherwise make the whole aggregate fail.
  const [row] = await db
    .select({
      views: sql<string>`coalesce(sum(case when ${posts.views} ~ '^[0-9]+$' then ${posts.views}::bigint else 0 end), 0)`,
    })
    .from(posts);

  return {
    postViews: Number(row?.views ?? 0) || 0,
  };
}

export const listChannelPosts = createTool({
  id: "list_channel_posts",
  description:
    "List posts published on this channel, newest first. Use it to find a post to reference, repurpose or compare. Supports a keyword search.",
  inputSchema: z.object({
    page: z.number().int().min(1).optional().describe("Page number, default 1."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Items per page, default 10."),
    search: z.string().optional().describe("Keyword filter."),
  }),
  outputSchema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        content: z.string(),
        views: z.number(),
        pinned: z.boolean(),
        createdAt: z.string().nullable(),
        mediaCount: z.number(),
        reactions: z.array(z.object({ emoji: z.string(), count: z.number() })),
      }),
    ),
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  }),
  execute: async ({ page, limit, search }) => {
    const result = await getPostsWithReactions({
      page: page ?? 1,
      limit: limit ?? 10,
      search,
      bypassCache: true,
    });

    return {
      items: result.items.map(toPostSummary),
      page: result.page,
      limit: result.limit,
      total: result.total,
      hasMore: result.hasMore,
    };
  },
});

export const getChannelPost = createTool({
  id: "get_channel_post",
  description:
    "Read one post by id, including its full text, media URLs, view count and reactions. Use it before repurposing a specific post.",
  inputSchema: z.object({
    id: z.string().describe("Post id."),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    post: z
      .object({
        id: z.string(),
        type: z.string(),
        content: z.string(),
        views: z.number(),
        pinned: z.boolean(),
        createdAt: z.string().nullable(),
        media: z.array(z.string()),
        reactions: z.array(z.object({ emoji: z.string(), count: z.number() })),
      })
      .nullable(),
  }),
  execute: async ({ id }) => {
    const post = await getPostById(id);
    if (!post) return { found: false, post: null };

    return {
      found: true,
      post: {
        ...toPostSummary(post),
        media: toMediaUrls(post),
      },
    };
  },
});

export const channelStats = createTool({
  id: "channel_stats",
  description:
    "Totals for this channel: number of posts and stories, and accumulated post views. Use it for quick reporting questions.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    posts: z.number(),
    stories: z.number(),
    postViews: z.number(),
  }),
  execute: async () => {
    const [posts, stories, totals] = await Promise.all([
      countPosts(),
      countStories(),
      channelTotals(),
    ]);

    return { posts, stories, postViews: totals.postViews };
  },
});

export const channelDataTools = {
  list_channel_posts: listChannelPosts,
  get_channel_post: getChannelPost,
  channel_stats: channelStats,
};
