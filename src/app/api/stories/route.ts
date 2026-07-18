import { NextRequest, NextResponse } from "next/server";
import {
  getStories,
  createStoryWithOptionalUpload,
  countStories,
  StoryType,
} from "@/lib/api/stories";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { captureServerEvent } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

/**
 * List or count stories
 * @description Returns paginated stories. Use query type=count for total. Filter by kind=image or kind=video.
 * @tag Stories
 * @openapi
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "list";

    if (type === "count") {
      const total = await countStories();
      return NextResponse.json({ total });
    }

    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const search = searchParams.get("search") ?? undefined;

    const kindParam = searchParams.get("kind");
    const kind = (
      kindParam === "image" || kindParam === "video" ? kindParam : undefined
    ) as StoryType | undefined;

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20;

    const result = await getStories({
      page: safePage,
      limit: safeLimit,
      search,
      type: kind,
    });

    await captureServerEvent("stories_list_requested", {
      page: safePage,
      limit: safeLimit,
      has_search: Boolean(search),
      kind: kind ?? "all",
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET /api/stories error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Create a story
 * @description Create a story with JSON body or multipart/form-data (type, file, views, likes, media). Types: image, video.
 * @tag Stories
 * @contentType application/json
 * @contentType multipart/form-data
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

      const typeValue = formData.get("type");
      const viewsValue = formData.get("views");
      const likesValue = formData.get("likes");
      const mediaValue = formData.get("media");
      const file = formData.get("file");

      const type =
        typeof typeValue === "string" &&
        (typeValue === "image" || typeValue === "video")
          ? (typeValue as StoryType)
          : undefined;

      const views =
        typeof viewsValue === "string" && viewsValue.length > 0
          ? viewsValue
          : undefined;

      const likes =
        typeof likesValue === "string" && likesValue.length > 0
          ? likesValue
          : undefined;

      let media: any = undefined;
      if (typeof mediaValue === "string" && mediaValue.length > 0) {
        try {
          media = JSON.parse(mediaValue);
        } catch {
          // ignore invalid JSON, will be validated in schema if needed
          media = undefined;
        }
      }

      const story = await createStoryWithOptionalUpload({
        type,
        views,
        likes,
        media,
        file: file && file instanceof File ? file : null,
      });

      return NextResponse.json(story, { status: 201 });
    }

    // JSON fallback (no file upload)
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const type =
      body.type === "image" || body.type === "video"
        ? (body.type as StoryType)
        : undefined;

    const views =
      typeof body.views === "string" && body.views.length > 0
        ? body.views
        : undefined;

    const likes =
      typeof body.likes === "string" && body.likes.length > 0
        ? body.likes
        : undefined;

    const media =
      body.media && typeof body.media === "object" ? body.media : undefined;

    const story = await createStoryWithOptionalUpload({
      type,
      views,
      likes,
      media,
      file: null,
    });

    return NextResponse.json(story, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/stories error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
