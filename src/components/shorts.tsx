"use client";

import Short from "@/components/short";
import type { PostWithReactions } from "@/lib/api/posts";
import type { MouseEvent } from "react";

interface ShortsProps {
  shorts: PostWithReactions[];
  likedStates: boolean[];
  likeCounts: number[];
  videoLoadingStates: boolean[];
  videoPreloadStates: boolean[];
  activeIndex: number;
  lastSecondsVisibleIndex: number | null;
  videoRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>;
  containerRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onContainerClick: (e: MouseEvent<HTMLDivElement>, index: number) => void;
  onToggleLike: (index: number) => void;
  onVideoPlay: (video: HTMLVideoElement) => void;
  onVideoEnded: (index: number) => void;
  onSwitchToThreads: () => void;
  onWaiting: (index: number) => void;
  onLoadStart: (index: number) => void;
  onLoadedData: (index: number) => void;
  onCanPlay: (index: number) => void;
  onPlaying: (index: number) => void;
  onStalled: (index: number) => void;
  onError: (index: number) => void;
}

export default function Shorts({
  shorts,
  likedStates,
  likeCounts,
  videoLoadingStates,
  videoPreloadStates,
  activeIndex,
  lastSecondsVisibleIndex,
  videoRefs,
  containerRefs,
  scrollContainerRef,
  onContainerClick,
  onToggleLike,
  onVideoPlay,
  onVideoEnded,
  onSwitchToThreads,
  onWaiting,
  onLoadStart,
  onLoadedData,
  onCanPlay,
  onPlaying,
  onStalled,
  onError,
}: ShortsProps) {
  return (
    <div className="sm:flex flex-col max-sm:flex-1 h-[var(--page-height)]">
      <div className="hidden sm:block h-[var(--chat-header-height)] w-full" />
      <div
        ref={scrollContainerRef}
        className="flex overflow-y-scroll none-scroll-bar snap-y snap-mandatory outline-none scrollbar-none flex-col items-center w-full sm:w-auto h-[var(--page-height)] sm:h-[calc(var(--page-height)-var(--chat-header-height))] sm:overflow-hidden sm:aspect-1080/1920"
      >
        {shorts.map((short, index) => (
          <Short
            key={short.id}
            short={short}
            index={index}
            activeIndex={activeIndex}
            likedStates={likedStates}
            likeCounts={likeCounts}
            videoLoadingStates={videoLoadingStates}
            videoPreloadStates={videoPreloadStates}
            lastSecondsVisibleIndex={lastSecondsVisibleIndex}
            containerRef={(el) => (containerRefs.current[index] = el)}
            videoRef={(el) => (videoRefs.current[index] = el)}
            onContainerClick={onContainerClick}
            onToggleLike={onToggleLike}
            onVideoPlay={onVideoPlay}
            onVideoEnded={onVideoEnded}
            onSwitchToThreads={onSwitchToThreads}
            onWaiting={onWaiting}
            onLoadStart={onLoadStart}
            onLoadedData={onLoadedData}
            onCanPlay={onCanPlay}
            onPlaying={onPlaying}
            onStalled={onStalled}
            onError={onError}
          />
        ))}
      </div>
    </div>
  );
}