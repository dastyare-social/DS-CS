import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getStoryById,
  updateStory,
  deleteStoryById,
  incrementStoryViews,
  toggleStoryLike,
} from "@/lib/api/stories";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { patchStoriesSchema } from "@/lib/db/schema/stories";
import { captureServerEvent } from "@/lib/analytics/server";

type RouteParams = {
  params: Promise<{
    story_id: string;
  }>;
};

/** @id StoryParams */
export const StoryParams = z.object({
  story_id: z.string(),
});

export const dynamic = "force-dynamic";

/** @id StoryItemSchema */
export const StoryItemSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "video"]),
  views: z.string(),
  likes: z.string(),
  media: z.any(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

/**
 * Get story by ID
 * @description Returns a single story.
 * @tag Stories
 * @pathParams StoryParams
 * @response 200 StoryItemSchema
 * @openapi
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const { story_id } = await context.params;
  const story = await getStoryById(story_id);
  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  captureServerEvent("story_requested", {
    story_id,
  });

  return NextResponse.json(story);
}

/**
 * Update story
 * @description Partial update of story fields (type, views, likes, media).
 * @tag Stories
 * @pathParams StoryParams
 * @body patchStoriesSchema
 * @response 200 StoryItemSchema
 * @openapi
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  const { story_id } = await context.params;

  try {
    const body = await req.json();
    const patch = patchStoriesSchema.parse(body);

    const updated = await updateStory({ id: story_id, patch });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/stories/[story_id] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Bad Request" },
      { status: 400 }
    );
  }
}

/**
 * Story actions
 * @description Perform actions on a story. action=view increments views. action=like with direction=inc or dec toggles likes.
 * @tag Stories
 * @pathParams StoryParams
 * @response 201 StoryItemSchema
 * @response 200 StorySuccessResponse
 * @openapi
 */
export async function POST(req: NextRequest, context: RouteParams) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  const { story_id } = await context.params;

  try {
    const body = await req.json();

    // ----- VIEW -----
    if (body.action === "view") {
      const result = await incrementStoryViews(story_id);
      if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(result, { status: 201 });
    }

    // ----- LIKE -----
    if (body.action === "like") {
      const direction =
        body.direction === "dec" ? "dec" : ("inc" as "inc" | "dec");

      const result = await toggleStoryLike(story_id, direction);
      if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/stories/[story_id] error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete story
 * @description Permanently deletes a story by ID.
 * @tag Stories
 * @pathParams StoryParams
 * @response z.object({ success: z.boolean() })
 * @openapi
 */
export async function DELETE(req: NextRequest, context: RouteParams) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  const { story_id } = await context.params;
  const ok = await deleteStoryById(story_id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
