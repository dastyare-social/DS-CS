"use client";

import { useEffect } from "react";
import { usePostsStore } from "@/lib/stores/posts";

export function usePosts(initialLimit = 8) {
  const {
    posts,
    total,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    init,
    loadMore,
    refetch,
    addPost,
    removePost,
    updatePost,
    replacePost,
  } = usePostsStore();

  useEffect(() => {
    init(initialLimit);
  }, [init, initialLimit]);

  return {
    posts,
    total,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    addPost,
    removePost,
    updatePost,
    replacePost,
  };
}
