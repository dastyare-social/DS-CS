import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  countStories,
  createStory,
  deleteStoryById,
  getStoryById,
  getStories,
  updateStory,
} from "@/lib/api/stories";
import { fail, notFound, ok } from "../result";

const StoryMediaInput = z.object({
  url: z.string(),
  type: z.enum(["image", "video"]).nullish(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
  thumbnail: z.string().optional(),
  caption: z.string().optional(),
});

type StoryPatch = Parameters<typeof updateStory>[0]["patch"];

export function registerStoryTools(
  server: McpServer,
  opts: { canWrite: () => boolean }
) {
  server.registerTool(
    "list_stories",
    {
      title: "List stories",
      description:
        "List ephemeral stories with pagination. Supports search and filtering by media type (image|video).",
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
          .enum(["image", "video"])
          .optional()
          .describe("Filter by story media type"),
      },
    },
    async (args) => {
      try {
        const page = args.page ?? 1;
        const limit = args.limit ?? 20;
        const result = await getStories({
          page,
          limit,
          search: args.search,
          type: args.type,
        });
        return ok(result);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to list stories"
        );
      }
    }
  );

  server.registerTool(
    "get_story",
    {
      title: "Get a single story",
      description: "Fetch a single story by its id.",
      inputSchema: {
        id: z.string().min(1).describe("The story id"),
      },
    },
    async (args) => {
      try {
        const story = await getStoryById(args.id);
        if (!story) return notFound("Story", args.id);
        return ok(story);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to get story"
        );
      }
    }
  );

  server.registerTool(
    "count_stories",
    {
      title: "Count stories",
      description: "Get the total number of stories.",
      inputSchema: {},
    },
    async () => {
      try {
        return ok({ total: await countStories() });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to count stories"
        );
      }
    }
  );

  server.registerTool(
    "create_story",
    {
      title: "Create a story",
      description:
        "Create a new ephemeral story. Media must reference an existing URL. Requires API key auth.",
      inputSchema: {
        type: z
          .enum(["image", "video"])
          .nullish()
          .describe("Story media type (inferred from URL if omitted)"),
        views: z.number().int().nonnegative().optional(),
        likes: z.number().int().nonnegative().optional(),
        media: z
          .union([StoryMediaInput, z.array(StoryMediaInput)])
          .nullish()
          .describe("Media item (or array of items) for the story"),
      },
    },
    async (args) => {
      if (!opts.canWrite()) {
        return fail(
          "Write access denied. Connect with an Authorization: Bearer <API_KEY> header."
        );
      }
      try {
        const story = await createStory({
          type: args.type ?? null,
          views: args.views != null ? String(args.views) : undefined,
          likes: args.likes != null ? String(args.likes) : undefined,
          media: args.media ?? undefined,
        });
        return ok(story);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to create story"
        );
      }
    }
  );

  server.registerTool(
    "update_story",
    {
      title: "Update a story",
      description: "Update an existing story's media, views, or likes. Requires API key auth.",
      inputSchema: {
        id: z.string().min(1).describe("The story id"),
        type: z.enum(["image", "video"]).nullish(),
        views: z.string().nullish(),
        likes: z.string().nullish(),
        media: z.union([StoryMediaInput, z.array(StoryMediaInput)]).nullish(),
      },
    },
    async (args) => {
      if (!opts.canWrite()) {
        return fail(
          "Write access denied. Connect with an Authorization: Bearer <API_KEY> header."
        );
      }
      try {
        const patch: StoryPatch = {};
        if (args.type) patch.type = args.type;
        if (args.views != null) patch.views = args.views;
        if (args.likes != null) patch.likes = args.likes;
        if (args.media !== undefined) patch.media = args.media as never;
        const story = await updateStory({ id: args.id, patch });
        if (!story) return notFound("Story", args.id);
        return ok(story);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to update story"
        );
      }
    }
  );

  server.registerTool(
    "delete_story",
    {
      title: "Delete a story",
      description: "Permanently delete a story by its id. Requires API key auth.",
      inputSchema: {
        id: z.string().min(1).describe("The story id"),
      },
    },
    async (args) => {
      if (!opts.canWrite()) {
        return fail(
          "Write access denied. Connect with an Authorization: Bearer <API_KEY> header."
        );
      }
      try {
        const deleted = await deleteStoryById(args.id);
        return ok({ id: args.id, deleted });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Failed to delete story"
        );
      }
    }
  );
}
