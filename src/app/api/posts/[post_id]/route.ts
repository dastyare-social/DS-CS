import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPostById,
  updatePost,
  viewPost,
  deletePostById,
  addReaction,
} from "@/lib/api/posts";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { patchPostsSchema } from "@/lib/db/schema/posts";
import { captureServerEvent } from "@/lib/analytics/server";
import { isDemoMode } from "@/lib/demo-mode";

type RouteParams = {
  params: Promise<{
    post_id: string;
  }>;
};

/** @id PostParams */
export const PostParams = z.object({
  post_id: z.string(),
});

/** @id PostActionBody */
export const PostActionBody = z.object({
  action: z.enum(["reaction", "view"]),
  emoji: z.string().optional(),
  direction: z.enum(["inc", "dec"]).optional(),
});

export const dynamic = "force-dynamic";

/** @id PostWithReactionsSchema */
export const PostWithReactionsSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "image", "video", "voice", "file"]),
  content: z.string().nullable(),
  views: z.string(),
  pinnedAt: z.string().nullable(),
  media: z.any(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  reactions: z.array(
    z.object({
      emoji: z.string(),
      count: z.number(),
    })
  ),
});

/**
 * Get post by ID
 * @summary Read Post — Get by ID
 * @description Returns a single post with reactions.
 * @tag Posts
 * @pathParams PostParams
* @response PostWithReactionsSchema
 * @examples response: {"id":"b1a2c3d4-e5f6-4789-a012-3456789abcde","type":"list","content":"Just shipped a new behind-the-scenes clip from the studio 🎬","media":[{"kind":"image","url":"https://sample-ref-12345678.supabase.co/storage/v1/object/public/dastyare-social-cs/media/image/9f8e7d6c-5b4a-4321-8765-fedcba987654.jpg","width":1080,"height":1920}],"reactions":[{"emoji":"❤️","count":12}],"views":342,"pinnedAt":null,"postStatus":"sent","createdAt":"2026-08-23T10:15:00.000Z"}
 * @openapi
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const { post_id } = await context.params;
  const post = await getPostById(post_id);
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  captureServerEvent("post_requested", {
    post_id,
  });

  return NextResponse.json(post);
}

/**
 * Update post
 * @summary Update Post — Edit Fields
 * @description Partial update of post fields (content, views, pinnedAt, media, type).
 * @tag Posts
 * @pathParams PostParams
 * @examples request: {"content":"Updated caption — full vlog drops Friday 🎥","pinnedAt":"2026-08-23T08:00:00.000Z"}
* @response PostWithReactionsSchema
 * @examples response: {"id":"b1a2c3d4-e5f6-4789-a012-3456789abcde","type":"list","content":"Updated caption — full vlog drops Friday 🎥","media":[],"reactions":[],"views":342,"pinnedAt":"2026-08-23T08:00:00.000Z","postStatus":"sent","createdAt":"2026-08-23T10:15:00.000Z"}
 * @openapi
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Read-only demo mode is active" },
      { status: 403 }
    );
  }

  const { post_id } = await context.params;

  try {
    const body = await req.json();
    const patch = patchPostsSchema.parse(body);

    const updated = await updatePost({ id: post_id, patch });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/posts/[post_id] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Bad Request" },
      { status: 400 }
    );
  }
}

/**
 * Post actions
 * @summary Post Actions — React or View
 * @description Perform actions on a post. action=reaction requires emoji string. action=view increments the view count.
 * @tag Posts
 * @pathParams PostParams
 * @body PostActionBody
 * @examples request: {"action":"reaction","emoji":"❤️"}
* @response PostWithReactionsSchema
* @response PostSuccessResponse
 * @examples response: {"id":"b1a2c3d4-e5f6-4789-a012-3456789abcde","reactions":[{"emoji":"❤️","count":13}],"views":343,"message":"Reaction added"}
 * @openapi
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  const { post_id } = await context.params;

  try {
    const body = await req.json();

    // ----- REACTION -----
    if (body.action === "reaction") {
      const { emoji } = body;

      if (!emoji || typeof emoji !== "string") {
        return NextResponse.json(
          { error: "emoji is required" },
          { status: 400 }
        );
      }

      const reaction = await addReaction({
        postId: post_id,
        emoji,
      });

      return NextResponse.json(reaction, { status: 201 });
    }

    // ----- VIEW -----
    if (body.action === "view") {
      const result = await viewPost(post_id);
      if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/posts/[post_id] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete post
 * @summary Delete Post — Remove by ID
 * @description Permanently deletes a post by ID.
 * @tag Posts
 * @pathParams PostParams
* @response PostSuccessResponse
 * @examples response: {"success":true,"message":"Post deleted","id":"b1a2c3d4-e5f6-4789-a012-3456789abcde"}
 * @openapi
 */
export async function DELETE(req: NextRequest, context: RouteParams) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Read-only demo mode is active" },
      { status: 403 }
    );
  }

  const { post_id } = await context.params;
  const ok = await deletePostById(post_id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
