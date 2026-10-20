import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getPostById, type PostWithReactions } from "@/lib/api/posts";
import {
  REPURPOSE_TARGET_IDS,
  buildRepurposeBrief,
  resolveRepurposeTargets,
} from "../repurpose/specs";

function sourceMedia(post: PostWithReactions): string[] {
  const media = post.media;
  if (!media) return [];
  const items = Array.isArray(media) ? media : [media];

  return items.flatMap((item) => {
    const url = (item as { url?: unknown })?.url;
    return typeof url === "string" ? [url] : [];
  });
}

const targetSchema = z.object({
  id: z.enum(REPURPOSE_TARGET_IDS),
  label: z.string(),
  maxChars: z.number(),
  partChars: z.number().optional(),
  titleChars: z.number().optional(),
  guidance: z.array(z.string()),
});

export const repurposePost = createTool({
  id: "repurpose_post",
  description:
    "Turn one channel post into several platform-native variants. Returns the source post plus the format playbook for each requested target (character limits and platform rules). You write the variants from that brief; the tool never rewrites the argument for you.",
  inputSchema: z.object({
    postId: z.string().describe("Id of the post to repurpose."),
    targets: z
      .array(z.enum(REPURPOSE_TARGET_IDS))
      .optional()
      .describe(
        "Which formats to produce. Defaults to all six: x-post, x-thread, linkedin-post, instagram-caption, newsletter, short-video-script.",
      ),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    brief: z
      .object({
        source: z.object({
          id: z.string(),
          type: z.string(),
          content: z.string(),
          media: z.array(z.string()),
        }),
        targets: z.array(targetSchema),
        instructions: z.array(z.string()),
      })
      .nullable(),
    note: z.string().optional(),
  }),
  execute: async ({ postId, targets }) => {
    const post = await getPostById(postId);

    if (!post) {
      return {
        found: false,
        brief: null,
        note: `No post with id "${postId}". Use list_channel_posts to find one.`,
      };
    }

    const content = post.content?.trim() ?? "";
    if (!content && sourceMedia(post).length === 0) {
      return {
        found: false,
        brief: null,
        note: "That post has no text or media to work from.",
      };
    }

    const brief = buildRepurposeBrief(
      {
        id: post.id,
        type: post.type,
        content,
        media: sourceMedia(post),
      },
      targets,
    );

    return {
      found: true,
      brief,
      ...(brief.targets.length === 0
        ? {
            note: `No recognised targets. Valid ids: ${resolveRepurposeTargets()
              .map((target) => target.id)
              .join(", ")}.`,
          }
        : {}),
    };
  },
});

export const repurposeTools = {
  repurpose_post: repurposePost,
};
