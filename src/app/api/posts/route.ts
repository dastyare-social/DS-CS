import { NextRequest, NextResponse } from "next/server";
import {
  getPostsWithReactions,
  createPostWithOptionalUpload,
  countPosts,
  batchIncrementViews,
} from "@/lib/api/posts";

export const dynamic = "force-dynamic";

/**
 * List or count posts
 * @description Returns paginated posts with reactions. Use query type=count for total count, type=shorts for vertical videos (1080x1920). Default type=list.
 * @tag Posts
 * @openapi
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "list";

    if (type === "count") {
      const total = await countPosts();
      return NextResponse.json({ total });
    }

    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const search = searchParams.get("search") ?? undefined;

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20;

    const result = await getPostsWithReactions({
      page: safePage,
      limit: safeLimit,
      search,
    });

    if (type === "shorts") {
      const filtered = result.items.filter((m) => {
        if (m.type !== "video" || !m.media) return false;
        const media = m.media as {
          width?: number;
          height?: number;
        };
        return media.width === 1080 && media.height === 1920;
      });
      return NextResponse.json({
        ...result,
        items: filtered,
        total: filtered.length,
        hasMore: false,
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET /api/posts error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Create a post or batch-increment views
 * @description Create a text post (JSON) or upload media (multipart/form-data with content and file). JSON body with action=batch-view and ids array increments views for multiple posts.
 * @tag Posts
 * @contentType application/json
 * @contentType multipart/form-data
 * @openapi
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const content = formData.get("content");
      const file = formData.get("file");

      const post = await createPostWithOptionalUpload({
        content: typeof content === "string" ? content : null,
        file: file && file instanceof File ? file : null,
      });

      return NextResponse.json(post, { status: 201 });
    }

    // JSON body
    const body = await req.json().catch(() => null);

    // ----- BATCH VIEW -----
    if (body?.action === "batch-view") {
      const ids = body.ids;
      if (!Array.isArray(ids)) {
        return NextResponse.json(
          { error: "ids must be an array" },
          { status: 400 }
        );
      }
      await batchIncrementViews(ids);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // JSON fallback (text-only posts)
    const content =
      body && typeof body.content === "string" ? body.content : null;

    const post = await createPostWithOptionalUpload({
      content,
      file: null,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/posts error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
