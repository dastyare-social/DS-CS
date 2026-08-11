import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getStories,
  createStory,
  countStories,
  StoryType,
  StoryMediaInput,
} from "@/lib/api/stories";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { captureServerEvent } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

/** @id StoriesQueryParams */
export const StoriesQueryParams = z.object({
  type: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  kind: z.string().optional(),
});

/** @id StoriesListResponse */
export const StoriesListResponse = z.object({
  items: z.array(z.any()),
  total: z.number(),
  hasMore: z.boolean().optional(),
  page: z.number(),
  limit: z.number(),
});

/** @id StoriesCountResponse */
export const StoriesCountResponse = z.object({
  total: z.number(),
});

/** @id StoriesResponse */
export const StoriesResponse = z.union([StoriesListResponse, StoriesCountResponse]);

/** @id StorySuccessResponse */
export const StorySuccessResponse = z.object({
  success: z.boolean(),
});

const StoryMediaItem = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  thumbnail: z.string().optional(),
  caption: z.string().optional(),
});

/** @id CreateStoryBody */
export const CreateStoryBody = z.object({
  type: z.enum(["image", "video"]).nullable().optional(),
  views: z.string().nullable().optional(),
  likes: z.string().nullable().optional(),
  media: z.union([StoryMediaItem, z.array(StoryMediaItem)]).optional(),
});

/**
 * List or count stories
 * @description Returns paginated stories. Use query type=count for total. Filter by kind=image or kind=video.
 * @tag Stories
 * @queryParams StoriesQueryParams
 * @response StoriesResponse
 * @example GET /api/stories?page=1&limit=20
 * @example GET /api/stories?type=count
 * @example GET /api/stories?kind=image
 * @example GET /api/stories?kind=video
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
  } catch (err: unknown) {
    console.error("GET /api/stories error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * Create a story
 * @description Create a story from a JSON body. Media must be referenced by URL — upload files to `/api/media` first, then map the returned `url`, `kind` (as `type`), `width`, `height`, and `duration` into the `media` field below. Types: image, video. An array of media items creates one story per item.
 * @tag Stories
 * @contentType application/json
 * @body CreateStoryBody
 * @response StoryItemSchema
 * @response StorySuccessResponse
 * @examples request: {"type":"image","media":{"url":"https://cdn.example.com/media/image/abc.jpg","width":1080,"height":1920}}
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
      body.media && typeof body.media === "object"
        ? (body.media as StoryMediaInput | StoryMediaInput[])
        : null;

    const story = await createStory({ type, views, likes, media });

    return NextResponse.json(story, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/stories error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
