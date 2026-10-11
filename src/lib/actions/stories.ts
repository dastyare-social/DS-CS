import { orpc } from "@/lib/orpc/client";
import { captureClientEvent } from "@/lib/analytics/client";
import type {
  GetStoriesParams,
  StoryItem,
  StoryType,
} from "@/lib/api/stories";

export type { GetStoriesParams, StoryItem, StoryType };

export async function getStories(params?: GetStoriesParams | null) {
  const safe = {
    page: params?.page ?? 1,
    limit: Math.max(1, params?.limit ?? 8),
    search: params?.search ?? undefined,
    type: params?.type ?? undefined,
  };
  return orpc.stories.list(safe);
}

export async function countStories() {
  try {
    const result = await orpc.stories.count();
    return result.total;
  } catch (err) {
    console.error("countStories failed:", err);
    return 0;
  }
}

export async function getStoryById(id: string) {
  return orpc.stories.getById({ id });
}

export async function incrementStoryViews(id: string) {
  const result = await orpc.stories.view({ id });
  void captureClientEvent("story_viewed", {
    story_id: id,
    views: result?.views,
  });
  return result;
}

export async function toggleStoryLike(id: string, direction: "inc" | "dec") {
  const result = await orpc.stories.like({ id, direction });
  void captureClientEvent("story_liked", {
    story_id: id,
    direction,
    likes: result?.likes,
  });
  return result;
}

export async function createStoryAction(media: {
  url: string;
  width?: number;
  height?: number;
  duration?: number;
}) {
  const type = media.url.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv|m4v)$/)
    ? "video"
    : "image";
  const result = await orpc.stories.create({ type, media });
  void captureClientEvent("story_created", {
    story_id: result.id,
    type,
  });
  return result;
}

export async function deleteStoryAction(id: string) {
  const ok = await orpc.stories.delete({ id });
  if (ok) {
    void captureClientEvent("story_deleted", {
      story_id: id,
    });
  }
  return ok;
}