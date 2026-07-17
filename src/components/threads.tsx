"use client";

import { useEffect } from "react";
import Loader from "@/components/loader";
import Thread from "@/components/thread";
import PullRefreshLoader from "@/components/pull-refresh-loader";
import NewThreadsBanner from "@/components/new-threads-banner";
import type { PostWithReactions } from "@/lib/api/posts";

interface ThreadsProps {
  threads: PostWithReactions[];
  threadsError: string | null;
  isRefreshingThreads: boolean;
  isApplyingNewThreads: boolean;
  newThreadsCount: number;
  isLoadingMoreThreads: boolean;
  hasMoreThreads: boolean;
  threadsPageRef: React.RefObject<HTMLDivElement | null>;
  threadsScrollRef: React.RefObject<HTMLDivElement | null>;
  threadsListRef: React.RefObject<HTMLDivElement | null>;
  threadsSentinelRef: React.RefObject<HTMLDivElement | null>;
  threadVideoRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>;
  isPullingRef: React.MutableRefObject<boolean>;
  refreshLoaderHeight: number;
  refreshLoaderOpacity: number;
  clampedPull: number;
  onShowNewThreads: () => void;
  onThreadReact: (threadId: string, emoji: string) => void;
  onVideoPlay: (video: HTMLVideoElement) => void;
  loadMore: () => void;
}

export default function Threads({
  threads,
  threadsError,
  isRefreshingThreads,
  isApplyingNewThreads,
  newThreadsCount,
  isLoadingMoreThreads,
  hasMoreThreads,
  threadsPageRef,
  threadsScrollRef,
  threadsListRef,
  threadsSentinelRef,
  threadVideoRefs,
  isPullingRef,
  refreshLoaderHeight,
  refreshLoaderOpacity,
  clampedPull,
  onShowNewThreads,
  onThreadReact,
  onVideoPlay,
  loadMore,
}: ThreadsProps) {
  // Infinite scroll sentinel
  useEffect(() => {
    const container = threadsScrollRef.current;
    const sentinel = threadsSentinelRef.current;
    if (!container || !sentinel) return;
    if (!hasMoreThreads) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        root: container,
        rootMargin: "200px",
        threshold: 0.01,
      }
    );
    observer.observe(sentinel);

    // scroll listener fallback
    const onScroll = () => {
      if (!hasMoreThreads) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - (scrollTop + clientHeight) < 300) {
        loadMore();
      }
    };
    container.addEventListener("scroll", onScroll);

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", onScroll);
    };
  }, [hasMoreThreads, threadsScrollRef, threadsSentinelRef, loadMore]);

  return (
    <div
      ref={threadsPageRef}
      style={{ height: "100dvh" }}
      className="flex flex-col-reverse w-full justify-start"
    >
      <div
        ref={threadsScrollRef}
        className="flex-1 pt-[var(--chat-header-height)] pb-[var(--chat-footer-height)] overflow-y-scroll none-scroll-bar"
        style={{ touchAction: "pan-y" }}
      >
        <PullRefreshLoader
          loaderHeight={refreshLoaderHeight}
          pullOpacity={refreshLoaderOpacity}
          isRefreshing={isRefreshingThreads}
          clampedPull={clampedPull}
        />
        <div ref={threadsListRef}>
          <NewThreadsBanner
            count={newThreadsCount}
            isApplying={isApplyingNewThreads}
            onClick={onShowNewThreads}
          />
          {threadsError && (
            <div className="text-center text-sm text-primary px-5 pt-2">
              Failed to load threads: {threadsError}
            </div>
          )}
          {threads.map((thread, index) => (
            <Thread
              key={thread.id}
              thread={thread}
              index={index}
              threadVideoRef={(el) => (threadVideoRefs.current[index] = el)}
              onThreadReact={onThreadReact}
              onPlay={onVideoPlay}
              isPullingRef={isPullingRef}
            />
          ))}
          {isLoadingMoreThreads && threads.length > 0 && (
            <div className="grid place-items-center py-4">
              <Loader className="size-8" />
            </div>
          )}
          <div ref={threadsSentinelRef} />
        </div>
      </div>
    </div>
  );
}