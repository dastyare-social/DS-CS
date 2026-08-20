"use client";

import { create } from "zustand";
import type { PostWithReactions } from "@/lib/api/posts";
import { getPosts, countPosts } from "@/lib/actions/posts";

type PostsState = {
  posts: PostWithReactions[];
  total: number | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  _initialized: boolean;

  init: (limit: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  addPost: (post: PostWithReactions) => void;
  removePost: (id: string) => void;
  updatePost: (updated: PostWithReactions) => void;
  replacePost: (oldId: string, replacement: PostWithReactions) => void;
};

export const usePostsStore = create<PostsState>((set, get) => ({
  posts: [],
  total: null,
  isLoading: true,
  isLoadingMore: false,
  error: null,
  hasMore: true,
  page: 1,
  _initialized: false,

  init: async (limit: number) => {
    const { _initialized } = get();
    // Always re-fetch fresh data (even if already initialized)
    try {
      set({ isLoading: !_initialized, error: null });
      const [data, total] = await Promise.all([
        getPosts({ page: 1, limit, type: "list" }),
        countPosts(),
      ]);
      set({
        posts: data.items,
        total,
        hasMore: data.hasMore,
        page: data.page,
        isLoading: false,
        _initialized: true,
      });
    } catch (err: any) {
      console.error("Failed to load posts", err);
      set({ error: err.message ?? "Failed to load posts", isLoading: false, _initialized: true });
    }
  },

  loadMore: async () => {
    const { hasMore, isLoading, isLoadingMore, page } = get();
    if (!hasMore || isLoading || isLoadingMore) return;

    try {
      set({ isLoadingMore: true });
      const data = await getPosts({ page: page + 1, limit: 8, type: "list" });
      set((s) => ({
        posts: [...s.posts, ...data.items],
        hasMore: data.hasMore,
        page: data.page,
        isLoadingMore: false,
      }));
    } catch (err: any) {
      console.error("Failed to load more posts", err);
      set({ isLoadingMore: false });
    }
  },

  refetch: async () => {
    const { page } = get();
    try {
      const [data, total] = await Promise.all([
        getPosts({ page: 1, limit: Math.max(page * 8, 8), type: "list", bypassCache: true }),
        countPosts(),
      ]);
      set({ posts: data.items, total, hasMore: data.hasMore });
    } catch (err: any) {
      console.error("Failed to refetch posts", err);
    }
  },

  addPost: (post) =>
    set((s) => ({ posts: [post, ...s.posts], total: (s.total ?? 0) + 1 })),

  removePost: (id) =>
    set((s) => ({
      posts: s.posts.filter((p) => p.id !== id),
      total: s.total && s.total > 0 ? s.total - 1 : s.total,
    })),

  updatePost: (updated) =>
    set((s) => ({
      posts: s.posts.map((p) => (p.id === updated.id ? updated : p)),
    })),

  replacePost: (oldId, replacement) =>
    set((s) => ({
      posts: s.posts.map((p) => (p.id === oldId ? replacement : p)),
    })),
}));

// Re-fetch posts whenever the tab becomes visible (handles back navigation, app re-open, push notification deep links)
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      usePostsStore.getState().refetch();
    }
  });
}
