import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  countPosts,
  createPost,
  deletePostById,
  getPostById,
  getPostsWithReactions,
  updatePost,
} from "@/lib/api/posts";
import { fail, notFound, ok } from "../result";

const MediaInput = z.object({
  url: z.string(),
  type: z.enum(["text", "image", "video", "voice", "file"]).nullish(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
});

type PostPatch = Parameters<typeof updatePost>[0]["patch"];

export function registerPostTools(
  server: McpServer,
  opts: { canWrite: () => boolean }
) {
  server.registerTool(
    "list_posts",
    {
      title: "List posts",
      description:
        "List posts from the channel with pagination. Supports free-text search, counting (type=count), and filtering to short-form vertical videos (type=shorts).",
      inputSchema: {
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Page number, starts at 1"),
        limit: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe("Items per page, max 100"),
        search: z.string().optional().describe("Free-text search over content"),
        type: z
          .enum(["list", "count", "shorts"])
          .optional()
          .describe("list (default), count (total only), or shorts (vertical videos only)"),
      },
    },
    async (args) => {
      try {
        const page = args.page ?? 1;
        const limit = args.limit ?? 20;
        const type = args.type ?? "list";

        if (type === "count") {
          return ok({ total: await countPosts() });
        }

        const result = await getPostsWithReactions({
          page,
          limit,
          search: args.search,
        });

        if (type === "shorts") {
          const items = result.items.filter((m) => {
            if (m.type !== "video" || !m.media) return false;
            const media = m.media as { width?: number; height?: number };
            const width = media.width || 0;
            const height = media.height || 0;
            if (width === 0 || height === 0) return false;
            const aspectRatio = height / width;
            return aspectRatio >= 1.6 && aspectRatio <= 2.0;
          });
          return ok({ ...result, items, total: items.length, hasMore: false });
        }

        return ok(result);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to list posts"
        );
      }
    }
  );

  server.registerTool(
    "get_post",
    {
      title: "Get a single post",
      description: "Fetch a single post by its id, including its reactions.",
      inputSchema: {
        id: z.string().min(1).describe("The post id"),
      },
    },
    async (args) => {
      try {
        const post = await getPostById(args.id);
        if (!post) return notFound("Post", args.id);
        return ok(post);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to get post"
        );
      }
    }
  );

  server.registerTool(
    "create_post",
    {
      title: "Create a post",
      description:
        "Create a new post on the channel. Media must reference an existing URL — upload files to /api/media first. Requires API key auth.",
      inputSchema: {
        content: z.string().nullish().describe("Text content of the post"),
        media: z
          .array(MediaInput)
          .max(10)
          .optional()
          .describe("Media items attached to the post"),
      },
    },
    async (args) => {
      if (!opts.canWrite()) {
        return fail(
          "Write access denied. Connect with an Authorization: Bearer <API_KEY> header."
        );
      }
      try {
        const post = await createPost({
          content: args.content ?? null,
          media: args.media ?? null,
        });
        return ok(post);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to create post"
        );
      }
    }
  );

  server.registerTool(
    "update_post",
    {
      title: "Update a post",
      description:
        "Update an existing post's content or pin status. Requires API key auth.",
      inputSchema: {
        id: z.string().min(1).describe("The post id"),
        content: z.string().nullish().describe("New text content"),
        pinnedAt: z
          .string()
          .nullish()
          .describe("ISO timestamp to pin the post, or null to unpin"),
      },
    },
    async (args) => {
      if (!opts.canWrite()) {
        return fail(
          "Write access denied. Connect with an Authorization: Bearer <API_KEY> header."
        );
      }
      try {
        const patch: PostPatch = {};
        if (args.content !== undefined) patch.content = args.content;
        if (args.pinnedAt !== undefined) {
          patch.pinnedAt = args.pinnedAt ? new Date(args.pinnedAt) : null;
        }
        const post = await updatePost({ id: args.id, patch });
        if (!post) return notFound("Post", args.id);
        return ok(post);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to update post"
        );
      }
    }
  );

  server.registerTool(
    "delete_post",
    {
      title: "Delete a post",
      description: "Permanently delete a post by its id. Requires API key auth.",
      inputSchema: {
        id: z.string().min(1).describe("The post id"),
      },
    },
    async (args) => {
      if (!opts.canWrite()) {
        return fail(
          "Write access denied. Connect with an Authorization: Bearer <API_KEY> header."
        );
      }
      try {
        const deleted = await deletePostById(args.id);
        return ok({ id: args.id, deleted });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to delete post"
        );
      }
    }
  );
}
