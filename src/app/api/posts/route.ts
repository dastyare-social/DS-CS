import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPostsWithReactions,
  createPostWithOptionalUpload,
  countPosts,
  batchIncrementViews,
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
 * @description Create a text post (JSON) or upload media (multipart/form-data). Legacy: accepts content and file. New: accepts files[], urls[], types[], widths[], heights[], durations[] for multiple media. JSON body with action=batch-view and ids array increments views for multiple posts.
 * @tag Posts
 * @contentType application/json
 * @contentType multipart/form-data
 * @response PostWithReactionsSchema
 * @response PostSuccessResponse
 * @openapi
 */
export async function POST(req: NextRequest) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const content = formData.get("content");
      const file = formData.get("file");
      
      // Handle new media inputs (multiple files/URLs)
      const mediaInputs: any[] = [];
      const files = formData.getAll("files");
      const urls = formData.getAll("urls");
      const types = formData.getAll("types");
      const widths = formData.getAll("widths");
      const heights = formData.getAll("heights");
      const durations = formData.getAll("durations");

      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f instanceof File) {
            mediaInputs.push({
              file: f,
              type: types[i] || null,
              dimensions: {
                width: Number(widths[i]) || 0,
                height: Number(heights[i]) || 0,
                duration: Number(durations[i]) || undefined,
              },
            });
          }
        }
      }

      if (urls && urls.length > 0) {
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          if (typeof url === "string" && url.length > 0) {
            mediaInputs.push({
              url,
              type: types[i] || null,
              dimensions: {
                width: Number(widths[i]) || 0,
                height: Number(heights[i]) || 0,
                duration: Number(durations[i]) || undefined,
              },
            });
          }
        }
      }

      const post = await createPostWithOptionalUpload({
        content: typeof content === "string" ? content : null,
        file: file && file instanceof File ? file : null,
        media: mediaInputs.length > 0 ? mediaInputs : null,
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
