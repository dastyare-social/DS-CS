import { router, publicProcedure } from "@/lib/trpc/trpc";
import { z } from "zod";
import {
  addReaction,
  batchIncrementViews,
  countPosts,
  createPostWithOptionalUpload,
  deletePostById,
  getPostById,
  getPostsWithReactions,
  viewPost,
} from "@/lib/api/posts";
import {
  countStories,
  getStoryById,
  getStories,
  incrementStoryViews,
  toggleStoryLike,
} from "@/lib/api/stories";

const postListInput = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  type: z.enum(["list", "shorts"]).optional(),
});

const postCreateInput = z.object({
  content: z.string().nullish(),
});

const postIdInput = z.object({
  id: z.string().min(1),
});

const postBatchViewInput = z.object({
  ids: z.array(z.string().min(1)).nonempty(),
});

const postReactionInput = z.object({
  postId: z.string().min(1),
  emoji: z.string().min(1),
});

const storyListInput = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  type: z.enum(["image", "video"]).optional(),
});

const storyIdInput = z.object({
  id: z.string().min(1),
});

const storyLikeInput = z.object({
  id: z.string().min(1),
  direction: z.enum(["inc", "dec"]),
});

export const postsRouter = router({
  // Combined endpoint to fetch initial explore data (shorts + threads) in one request
  exploreInitial: publicProcedure.query(async () => {
    const shortsResult = await getPostsWithReactions({ page: 1, limit: 2 });
    const threads = await getPostsWithReactions({ page: 1, limit: 5 });
    
    // Filter shorts to only include vertical videos (1080x1920)
    const filteredShorts = shortsResult.items.filter((item) => {
      if (item.type !== "video" || !item.media) return false;
      const media = item.media as { width?: number; height?: number };
      return media.width === 1080 && media.height === 1920;
    });
    
    return {
      shorts: {
        ...shortsResult,
        items: filteredShorts,
        total: filteredShorts.length,
      },
      threads,
    };
  }),
  list: publicProcedure.input(postListInput).query(async ({ input }) => {
    const result = await getPostsWithReactions({
      page: input.page,
      limit: input.limit,
      search: input.search,
    });

    if (input.type === "shorts") {
      const filtered = result.items.filter((item) => {
        if (item.type !== "video" || !item.media) return false;
        const media = item.media as { width?: number; height?: number };
        return media.width === 1080 && media.height === 1920;
      });
      return {
        ...result,
        items: filtered,
        total: filtered.length,
        hasMore: false,
      };
    }

    return result;
  }),

  count: publicProcedure.query(async () => ({ total: await countPosts() })),

  getById: publicProcedure.input(postIdInput).query(async ({ input }) => {
    const post = await getPostById(input.id);
    if (!post) {
      throw new Error("Post not found");
    }
    return post;
  }),

  create: publicProcedure.input(postCreateInput).mutation(async ({ input }) => {
    return createPostWithOptionalUpload({ content: input.content ?? null, file: null });
  }),

  batchView: publicProcedure
    .input(postBatchViewInput)
    .mutation(async ({ input }) => {
      await batchIncrementViews(input.ids);
      return { success: true };
    }),

  addReaction: publicProcedure.input(postReactionInput).mutation(async ({ input }) => {
    return addReaction({ postId: input.postId, emoji: input.emoji });
  }),

  view: publicProcedure.input(postIdInput).mutation(async ({ input }) => {
    return viewPost(input.id);
  }),

  delete: publicProcedure.input(postIdInput).mutation(async ({ input }) => {
    const ok = await deletePostById(input.id);
    if (!ok) {
      throw new Error("Post not found");
    }
    return { success: true };
  }),
});

export const storiesRouter = router({
  list: publicProcedure.input(storyListInput).query(async ({ input }) => {
    return getStories({
      page: input.page,
      limit: input.limit,
      search: input.search,
      type: input.type,
    });
  }),

  count: publicProcedure.query(async () => ({ total: await countStories() })),

  getById: publicProcedure.input(storyIdInput).query(async ({ input }) => {
    const story = await getStoryById(input.id);
    if (!story) {
      throw new Error("Story not found");
    }
    return story;
  }),

  view: publicProcedure.input(storyIdInput).mutation(async ({ input }) => {
    const result = await incrementStoryViews(input.id);
    if (!result) {
      throw new Error("Story not found");
    }
    return result;
  }),

  like: publicProcedure.input(storyLikeInput).mutation(async ({ input }) => {
    const result = await toggleStoryLike(input.id, input.direction);
    if (!result) {
      throw new Error("Story not found");
    }
    return result;
  }),
});

export const appRouter = router({
  posts: postsRouter,
  stories: storiesRouter,
});

export type AppRouter = typeof appRouter;
