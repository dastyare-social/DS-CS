import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPostsWithReactions,
  createPost,
  countPosts,
  batchIncrementViews,
  PostMediaInput,
} from "@/lib/api/posts";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { captureServerEvent } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

/** @id PostsQueryParams */
export const PostsQueryParams = z.object({
  type: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

/** @id PostsListResponse */
export const PostsListResponse = z.object({
  items: z.array(z.any()),
  total: z.number(),
  hasMore: z.boolean(),
  page: z.number(),
  limit: z.number(),
});

/** @id PostsCountResponse */
export const PostsCountResponse = z.object({
  total: z.number(),
});

/** @id PostsResponse */
export const PostsResponse = z.union([PostsListResponse, PostsCountResponse]);

/** @id PostSuccessResponse */
export const PostSuccessResponse = z.object({
  success: z.boolean(),
});

/**
 * List or count posts
 * @description Returns paginated posts with reactions. Use query type=count for total count, type=shorts for vertical videos (1080x1920). Default type=list.
 * @tag Posts
 * @queryParams PostsQueryParams
 * @response PostsResponse
 * @example GET /api/posts?page=1&limit=20
 * @example GET /api/posts?type=count
 * @example GET /api/posts?type=shorts
 * @example GET /api/posts?search=keyword
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

    await captureServerEvent("posts_list_requested", {
      page: safePage,
      limit: safeLimit,
      has_search: Boolean(search),
      type,
    });

    if (type === "shorts") {
      const filtered = result.items.filter((m) => {
        if (m.type !== "video" || !m.media) return false;
        const media = m.media as {
          width?: number;
          height?: number;
        };
        const width = media.width || 0;
        const height = media.height || 0;
        if (width === 0 || height === 0) return false;
        // Check for 9:16 aspect ratio (height > width, approximately 1.77:1 ratio)
        const aspectRatio = height / width;
        return aspectRatio >= 1.6 && aspectRatio <= 2.0;
      });
      return NextResponse.json({
        ...result,
        items: filtered,
        total: filtered.length,
        hasMore: false,
      });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET /api/posts error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * Create a post or batch-increment views
 * @description Create a post from a JSON body. Media must be referenced by URL — upload files to /api/media first, then pass the returned url and dimensions. Accepts a single post or, when multiple media items are provided, one post per item (or a single image post for multiple images). JSON body with action=batch-view and ids array increments views for multiple posts.
 * @tag Posts
 * @contentType application/json
 * @response PostWithReactionsSchema
 * @response PostSuccessResponse
 * @example POST /api/posts {"content": "Hello world"}
 * @example POST /api/posts {"content": "Hello", "media": [{"url": "https://cdn.example.com/media/image/abc.jpg", "type": "image", "width": 1080, "height": 1920}]}
 * @example POST /api/posts {"content": "Hello", "media": [{"url": "https://cdn.example.com/media/video/abc.mp4", "type": "video"}]}
 * @example POST /api/posts {"action": "batch-view", "ids": ["id1", "id2"]}
 * @openapi
 */
export async function POST(req: NextRequest) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // ----- BATCH VIEW -----
    if (body.action === "batch-view") {
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

    // ----- CREATE -----
    const content =
      typeof body.content === "string" ? body.content : null;

    const media = Array.isArray(body.media)
      ? (body.media as PostMediaInput[])
      : null;

    const post = await createPost({ content, media });

    if (post && "_multiple" in post) {
      return NextResponse.json(
        { posts: post.posts, multiple: true },
        { status: 201 }
      );
    }

    return NextResponse.json(post, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/posts error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
