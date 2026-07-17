import { NextRequest, NextResponse } from "next/server";
import {
  getPostById,
  updatePost,
  deletePostById,
  addReaction,
} from "@/lib/api/posts";
import { patchPostsSchema } from "@/lib/db/schema/posts";

type RouteParams = {
  params: Promise<{
    post_id: string;
  }>;
};

export const dynamic = "force-dynamic";

/**
 * Get post by ID
 * @description Returns a single post with reactions.
 * @tag Posts
 * @openapi
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const { post_id } = await context.params;
  const post = await getPostById(post_id);
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(post);
}

/**
 * Update post
 * @description Partial update of post fields (content, views, pinnedAt, media, type).
 * @tag Posts
 * @body patchPostsSchema
 * @openapi
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
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
 * @description Perform actions on a post. action=reaction requires emoji string. action=view increments the view count.
 * @tag Posts
 * @openapi
 */
export async function POST(req: NextRequest, context: RouteParams) {
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
      // load current message
      const post = await getPostById(post_id);
      if (!post) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const currentViews = Number(post.views || "0");
      const newViews = String(currentViews + 1);

      const updated = await updatePost({
        id: post_id,
        patch: { views: newViews },
      });

      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(
        { messageId: post_id, views: newViews },
        { status: 201 }
      );
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
 * @description Permanently deletes a post by ID.
 * @tag Posts
 * @openapi
 */
export async function DELETE(req: NextRequest, context: RouteParams) {
  const { post_id } = await context.params;
  const ok = await deletePostById(post_id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
