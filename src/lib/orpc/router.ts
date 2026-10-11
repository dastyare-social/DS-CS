import { os } from "@orpc/server";
import { z } from "zod";
import {
  addReaction,
  batchIncrementViews,
  countPosts,
  createPost,
  deletePostById,
  getPostById,
  getPostsWithReactions,
  getPinnedPosts,
  updatePost,
  viewPost,
} from "@/lib/api/posts";
import {
  getStories,
  countStories,
  getStoryById,
  incrementStoryViews,
  toggleStoryLike,
  createStory,
  deleteStoryById,
  StoryMediaInput,
} from "@/lib/api/stories";

/**
 * Internal RPC router — posts and stories.
 *
 * This mirrors the tRPC router that preceded it, procedure for procedure. Input
 * validation matches the old Zod schemas exactly; output validation is
 * intentionally omitted, as it was under tRPC.
 *
 * Consumers must go through `src/lib/actions/*` — never call this from a
 * component directly.
 */

const postListInput = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  type: z.enum(["list", "shorts"]).optional(),
  bypassCache: z.boolean().optional(),
});

const mediaInput = z.object({
  url: z.string().nullable().optional(),
  type: z.enum(["text", "image", "video", "voice", "file"]).nullable().optional(),
  dimensions: z
    .object({
      width: z.number(),
      height: z.number(),
      duration: z.number().optional(),
    })
    .optional(),
});

const postCreateInput = z.object({
  content: z.string().nullish(),
  media: z.array(mediaInput).optional(),
});

const postIdInput = z.object({
  id: z.string().min(1),
});

const postUpdateInput = z.object({
  id: z.string().min(1),
  content: z.string().nullish(),
  pinnedAt: z.string().datetime().nullish(),
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

export const postsRouter = {
  // Combined endpoint to fetch initial explore data (shorts + threads) in one request
  exploreInitial: os.handler(async () => {
    const shortsResult = await getPostsWithReactions({ page: 1, limit: 20 });
    const threads = await getPostsWithReactions({ page: 1, limit: 5 });

    // Filter shorts to only include vertical videos (9:16 aspect ratio)
    const filteredShorts = shortsResult.items.filter((item) => {
      if (item.type !== "video" || !item.media) {
        return false;
      }
      const media = item.media as { width?: number; height?: number };
      const width = media.width || 0;
      const height = media.height || 0;

      // If dimensions are 0, include the video anyway (fallback for videos without dimension data)
      if (width === 0 || height === 0) {
        return true;
      }

      // Check for 9:16 aspect ratio (height > width, approximately 1.77:1 ratio)
      const aspectRatio = height / width;
      return aspectRatio >= 1.6 && aspectRatio <= 2.0;
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

  list: os.input(postListInput).handler(async ({ input }) => {
    const result = await getPostsWithReactions({
      page: input.page,
      limit: input.limit,
      search: input.search,
      bypassCache: input.bypassCache,
    });

    if (input.type === "shorts") {
      const filtered = result.items.filter((item) => {
        if (item.type !== "video" || !item.media) return false;
        const media = item.media as { width?: number; height?: number };
        const width = media.width || 0;
        const height = media.height || 0;
        if (width === 0 || height === 0) return false;
        // Check for 9:16 aspect ratio (height > width, approximately 1.77:1 ratio)
        const aspectRatio = height / width;
        return aspectRatio >= 1.6 && aspectRatio <= 2.0;
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

  count: os.handler(async () => ({ total: await countPosts() })),

  pinned: os.handler(async () => {
    return getPinnedPosts();
  }),

  getById: os.input(postIdInput).handler(async ({ input }) => {
    const post = await getPostById(input.id);
    if (!post) {
      throw new Error("Post not found");
    }
    return post;
  }),

  create: os.input(postCreateInput).handler(async ({ input }) => {
    const media = input.media
      ?.filter((m) => typeof m.url === "string" && m.url.length > 0)
      .map((m) => ({
        url: m.url as string,
        type: m.type ?? null,
        width: m.dimensions?.width,
        height: m.dimensions?.height,
        duration: m.dimensions?.duration,
      }));
    const result = await createPost({
      content: input.content ?? null,
      media: media && media.length > 0 ? media : null,
    });
    return "_multiple" in result ? result.posts[0] : result;
  }),

  batchView: os.input(postBatchViewInput).handler(async ({ input }) => {
    await batchIncrementViews(input.ids);
    return { success: true };
  }),

  addReaction: os.input(postReactionInput).handler(async ({ input }) => {
    return addReaction({ postId: input.postId, emoji: input.emoji });
  }),

  view: os.input(postIdInput).handler(async ({ input }) => {
    return viewPost(input.id);
  }),

  delete: os.input(postIdInput).handler(async ({ input }) => {
    const ok = await deletePostById(input.id);
    if (!ok) {
      throw new Error("Post not found");
    }
    return { success: true };
  }),

  update: os.input(postUpdateInput).handler(async ({ input }) => {
    const patch: {
      content?: string | null;
      pinnedAt?: Date | null;
    } = {};
    if (input.content !== undefined) {
      patch.content = input.content;
    }
    if (input.pinnedAt !== undefined) {
      patch.pinnedAt = input.pinnedAt ? new Date(input.pinnedAt) : null;
    }
    const updated = await updatePost({ id: input.id, patch });
    if (!updated) {
      throw new Error("Post not found");
    }
    return updated;
  }),
};

export const storiesRouter = {
  list: os.input(storyListInput).handler(async ({ input }) => {
    return getStories({
      page: input.page,
      limit: input.limit,
      search: input.search,
      type: input.type,
    });
  }),

  count: os.handler(async () => ({ total: await countStories() })),

  getById: os.input(storyIdInput).handler(async ({ input }) => {
    const story = await getStoryById(input.id);
    if (!story) {
      throw new Error("Story not found");
    }
    return story;
  }),

  view: os.input(storyIdInput).handler(async ({ input }) => {
    const result = await incrementStoryViews(input.id);
    if (!result) {
      throw new Error("Story not found");
    }
    return result;
  }),

  like: os.input(storyLikeInput).handler(async ({ input }) => {
    const result = await toggleStoryLike(input.id, input.direction);
    if (!result) {
      throw new Error("Story not found");
    }
    return result;
  }),

  delete: os.input(storyIdInput).handler(async ({ input }) => {
    const ok = await deleteStoryById(input.id);
    if (!ok) {
      throw new Error("Story not found");
    }
    return ok;
  }),

  create: os
    .input(
      z.object({
        type: z.enum(["image", "video"]).nullable().optional(),
        media: z
          .union([
            z.object({
              url: z.string(),
              width: z.number().optional(),
              height: z.number().optional(),
              duration: z.number().optional(),
            }),
            z.array(
              z.object({
                url: z.string(),
                width: z.number().optional(),
                height: z.number().optional(),
                duration: z.number().optional(),
              }),
            ),
          ])
          .optional(),
      }),
    )
    .handler(async ({ input }) => {
      const story = await createStory({
        type: input.type ?? undefined,
        media: (input.media as StoryMediaInput | StoryMediaInput[]) ?? null,
      });
      return story;
    }),
};

export const appRouter = {
  posts: postsRouter,
  stories: storiesRouter,
};

export type AppRouter = typeof appRouter;