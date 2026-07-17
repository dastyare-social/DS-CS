import { trpc } from "@/lib/trpc/client";

export type StoryType = "image" | "video";
export type StoryItem = {
  id: string;
  type: StoryType;
  views: string;
  likes: string;
  media: any;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type GetStoriesParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: StoryType;
};

export async function getStories(params?: GetStoriesParams | null) {
  const safe = {
    page: params?.page ?? 1,
    limit: Math.max(1, params?.limit ?? 8),
    search: params?.search ?? undefined,
    type: params?.type ?? undefined,
  };
  return trpc.stories.list.query(safe);
}

export async function countStories() {
  try {
    const result = await trpc.stories.count.query();
    return result.total;
  } catch (err) {
    console.error("countStories failed:", err);
    return 0;
  }
}

export async function getStoryById(id: string) {
  return trpc.stories.getById.query({ id });
}

export async function incrementStoryViews(id: string) {
  return trpc.stories.view.mutate({ id });
}

export async function toggleStoryLike(id: string, direction: "inc" | "dec") {
  return trpc.stories.like.mutate({ id, direction });
}
