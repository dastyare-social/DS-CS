"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostWithReactions } from "@/lib/api/posts";
import { countPosts, getPosts } from "@/lib/actions/posts";

type UsePostsState = {
  posts: PostWithReactions[];
  total: number | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;

  // NEW: helpers for Page
  addPost: (msg: PostWithReactions) => void;
  removePost: (id: string) => void;
};

export function usePosts(initialLimit = 8): UsePostsState {
  const [posts, setPosts] = useState<PostWithReactions[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* —— 1— fetch only the total count via tRPC —— */
  const fetchTotal = useCallback(async () => {
    try {
      const total = await countPosts();
      setTotal(total);
    } catch (err: any) {
      console.error("Failed to fetch total posts count", err);
      // keep total as null, but don't kill the UI
    }
  }, []);

  /* —— fetch one page of posts via tRPC —— */
  const fetchPage = useCallback(
    async (pageNumber: number, append: boolean) => {
      try {
        if (!append) setIsLoading(true);
        else setIsLoadingMore(true);

        setError(null);

        const data = await getPosts({
          page: pageNumber,
          limit: initialLimit,
          type: "list",
        });

        setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
        setHasMore(data.hasMore);
        setPage(data.page);
        setTotal(data.total);
      } catch (err: any) {
        console.error("Failed to fetch posts", err);
        setError(err.post ?? "Failed to load posts");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [initialLimit]
  );

  useEffect(() => {
    fetchTotal();
    fetchPage(1, false);
  }, [fetchPage, fetchTotal]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore) return;
    fetchPage(page + 1, true);
  }, [page, hasMore, isLoading, isLoadingMore, fetchPage]);

  // NEW: add/remove helpers
  const addPost = useCallback((msg: PostWithReactions) => {
    setPosts((prev) => [msg, ...prev]);
    setTotal((prev) => (prev === null ? 1 : prev + 1));
  }, []);

  const removePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((m) => m.id !== id));
    setTotal((prev) => (prev && prev > 0 ? prev - 1 : prev));
  }, []);

  return {
    posts,
    total,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    addPost,
    removePost,
  };
}
