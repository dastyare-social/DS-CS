import { trpc } from "@/lib/trpc/client";
import type { PostWithReactions } from "@/lib/api/posts";
import { captureClientEvent } from "@/lib/analytics/client";

export type { PostWithReactions };

export type GetPostsParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: "list" | "shorts";
};

export async function getPosts(params?: GetPostsParams | null) {
  const safe = {
    page: params?.page ?? 1,
    limit: Math.max(1, params?.limit ?? 8),
    search: params?.search ?? undefined,
    type: params?.type ?? "list",
  };
  return trpc.posts.list.query(safe);
}

export async function getExploreInitial() {
  return trpc.posts.exploreInitial.query();
}

export async function countPosts() {
  try {
    const result = await trpc.posts.count.query();
    return result.total;
  } catch (err) {
    console.error("countPosts failed:", err);
    return 0;
  }
}

export async function getPostById(id: string) {
  return trpc.posts.getById.query({ id });
}

export async function createPost(content: string | null, media?: any[] | undefined) {
  const result = await trpc.posts.create.mutate({ content, media });
  void captureClientEvent("post_created", {
    post_type: result.type,
    has_media: Boolean(result.media),
    content_length: result.content?.length ?? 0,
  });
  return result;
}

export async function batchIncrementViews(ids: string[]) {
  const result = await trpc.posts.batchView.mutate({ ids });
  void captureClientEvent("post_batch_viewed", {
    post_ids: ids,
    count: ids.length,
    success: result.success,
  });
}

export async function addReaction(postId: string, emoji: string) {
  const result = await trpc.posts.addReaction.mutate({ postId, emoji });
  void captureClientEvent("post_reacted", {
    post_id: postId,
    emoji,
    reaction_count: result.count,
  });
  return result;
}

export async function viewPost(id: string) {
  const result = await trpc.posts.view.mutate({ id });
  void captureClientEvent("post_viewed", {
    post_id: id,
    views: result?.views,
  });
  return result;
}

export async function deletePost(id: string) {
  return trpc.posts.delete.mutate({ id });
}
