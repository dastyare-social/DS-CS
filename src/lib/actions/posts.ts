import { orpc } from "@/lib/orpc/client";
import type { PostWithReactions, PostType } from "@/lib/api/posts";
import { captureClientEvent } from "@/lib/analytics/client";

export type { PostWithReactions };

export type PostMediaInput = {
  url?: string | null;
  type?: PostType | null;
  dimensions?: {
    width: number;
    height: number;
    duration?: number;
  };
};

export type GetPostsParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: "list" | "shorts";
  bypassCache?: boolean;
};

export async function getPosts(params?: GetPostsParams | null) {
  const safe = {
    page: params?.page ?? 1,
    limit: Math.max(1, params?.limit ?? 8),
    search: params?.search ?? undefined,
    type: params?.type ?? "list",
    bypassCache: params?.bypassCache ?? false,
  };
  return orpc.posts.list(safe);
}

export async function getExploreInitial() {
  return orpc.posts.exploreInitial();
}

export async function countPosts() {
  try {
    const result = await orpc.posts.count();
    return result.total;
  } catch (err) {
    console.error("countPosts failed:", err);
    return 0;
  }
}

export async function getPostById(id: string) {
  return orpc.posts.getById({ id });
}

export async function createPost(
  content: string | null,
  media?: PostMediaInput[] | undefined
) {
  const result = await orpc.posts.create({ content, media });
  void captureClientEvent("post_created", {
    post_type: result.type,
    has_media: Boolean(result.media),
    content_length: result.content?.length ?? 0,
  });
  return result;
}

export async function batchIncrementViews(ids: string[]) {
  const result = await orpc.posts.batchView({ ids });
  void captureClientEvent("post_batch_viewed", {
    post_ids: ids,
    count: ids.length,
    success: result.success,
  });
}

export async function addReaction(postId: string, emoji: string) {
  const result = await orpc.posts.addReaction({ postId, emoji });
  void captureClientEvent("post_reacted", {
    post_id: postId,
    emoji,
    reaction_count: result.count,
  });
  return result;
}

export async function viewPost(id: string) {
  const result = await orpc.posts.view({ id });
  void captureClientEvent("post_viewed", {
    post_id: id,
    views: result?.views,
  });
  return result;
}

export async function deletePost(id: string) {
  return orpc.posts.delete({ id });
}

export async function updatePostContent(id: string, content: string) {
  const result = await orpc.posts.update({ id, content });
  void captureClientEvent("post_updated", {
    post_id: id,
    content_length: content.length,
  });
  return result;
}

export async function togglePinPost(id: string, pinned: boolean) {
  const result = await orpc.posts.update({
    id,
    pinnedAt: pinned ? new Date().toISOString() : null,
  });
  void captureClientEvent(pinned ? "post_pinned" : "post_unpinned", {
    post_id: id,
  });
  return result;
}

export async function getPinnedPosts(): Promise<PostWithReactions[]> {
  return orpc.posts.pinned();
}