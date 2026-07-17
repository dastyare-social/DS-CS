import { trpc } from "@/lib/trpc/client";
import type { PostWithReactions } from "@/lib/api/posts";

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

export async function createPost(content: string | null) {
  return trpc.posts.create.mutate({ content });
}

export async function batchIncrementViews(ids: string[]) {
  await trpc.posts.batchView.mutate({ ids });
}

export async function addReaction(postId: string, emoji: string) {
  return trpc.posts.addReaction.mutate({ postId, emoji });
}

export async function viewPost(id: string) {
  return trpc.posts.view.mutate({ id });
}

export async function deletePost(id: string) {
  return trpc.posts.delete.mutate({ id });
}
