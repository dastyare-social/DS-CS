"use client";

import Loader from "@/components/loader";

interface PullRefreshLoaderProps {
  loaderHeight: number;
  pullOpacity: number;
  isRefreshing: boolean;
  clampedPull: number;
}

export default function PullRefreshLoader({
  loaderHeight,
  pullOpacity,
  isRefreshing,
  clampedPull,
}: PullRefreshLoaderProps) {
  return (
    <div
      className="relative overflow-hidden border-b border-secondary/5"
      style={{
        height: loaderHeight,
        opacity: pullOpacity,
        transition:
          loaderHeight === 0
            ? "height 150ms ease-out, opacity 150ms ease-out"
            : isRefreshing
            ? "height 150ms ease-out, opacity 150ms ease-out"
            : "none",
      }}
    >
      <div className="grid place-items-center h-full">
        {(isRefreshing || clampedPull > 10) && (
          <Loader className="size-12 sm:size-10 border border-primary/10 text-primary/50 p-2 sm:p-1.5 rounded-full backdrop-blur-3xl bg-white/50" />
        )}
      </div>
    </div>
  );
}