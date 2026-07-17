"use client";

import Loader from "@/components/loader";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import { capitalize, cn, formatCount } from "@/lib/utils";
import {
  HeartIcon,
  ChevronDownIcon,
  LineSquiggleIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import type { PostWithReactions } from "@/lib/api/posts";

export interface ShortItemProps {
  short: PostWithReactions;
  index: number;
  activeIndex: number;
  likedStates: boolean[];
  likeCounts: number[];
  videoLoadingStates: boolean[];
  videoPreloadStates: boolean[];
  lastSecondsVisibleIndex: number | null;
  containerRef: (el: HTMLDivElement | null) => void;
  videoRef: (el: HTMLVideoElement | null) => void;
  onContainerClick: (e: MouseEvent<HTMLDivElement>, index: number) => void;
  onToggleLike: (index: number) => void;
  onVideoPlay?: (video: HTMLVideoElement) => void;
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

export default function ShortItem({
  short,
  index,
  activeIndex,
  likedStates,
  likeCounts,
  videoLoadingStates,
  videoPreloadStates,
  lastSecondsVisibleIndex,
  containerRef,
  videoRef,
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
}: ShortItemProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  return (
    <section
      className="w-full h-[var(--page-height)] sm:h-full sm:aspect-1080/1920 flex justify-center items-center snap-start outline-none"
    >
      <div
        ref={containerRef}
        onClick={(e) => onContainerClick(e, index)}
        className="relative w-full h-[var(--page-height)] sm:h-[calc(var(--page-height)-var(--chat-header-height))] sm:aspect-1080/1920 sm:h-auto sm:max-w-xs outline-none sm:border border-secondary/5 cursor-pointer"
      >
        {short.media?.url && (
          <video
            ref={videoRef}
            src={short.media.url}
            className="absolute inset-0 object-cover w-full h-full sm:p-1 outline-none"
            autoPlay={index === 0}
            muted={false}
            loop={true}
            playsInline
            onPlay={(e) => {
              onVideoPlay?.(e.currentTarget);
            }}
            onEnded={() => onVideoEnded(index)}
            onWaiting={() => onWaiting(index)}
            onLoadStart={() => onLoadStart(index)}
            onLoadedData={() => onLoadedData(index)}
            onCanPlay={() => onCanPlay(index)}
            onPlaying={() => onPlaying(index)}
            onStalled={() => onStalled(index)}
            onError={() => onError(index)}
          />
        )}

        {/* PRE-DOWNLOAD LOADER */}
        {videoPreloadStates[index] && (
          <div className="absolute inset-0 z-[9] flex items-center justify-center bg-black">
            <Loader className="size-10 border border-white/20 text-white/70 p-2 rounded-full bg-black/40 backdrop-blur-2xl" />
          </div>
        )}

        {/* BUFFERING LOADER */}
        {videoLoadingStates[index] && !videoPreloadStates[index] && (
          <div className="absolute inset-0 z-[8] flex items-center justify-center bg-black/20">
            <Loader className="size-12 border border-white/10 text-white/50 p-2 rounded-full backdrop-blur-3xl flex justify-center items-center" />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 h-28 sm:mx-1 sm:mt-1 bg-gradient-to-b from-black/60 via-black/30 to-transparent z-[5]" />

        <div className="absolute inset-x-0 bottom-0 h-80 sm:mx-1 sm:mb-1 bg-gradient-to-t from-black/30 via-black/20 to-transparent z-[5]" />

        <div className="absolute top-0 w-full px-5 py-4 z-10 text-white">
          <div className="flex items-center">
            <div className="flex-1 text-lg sm:text-md">
              {capitalize(t("general.shorts"))} &nbsp; —&nbsp;
              <span className="opacity-80">
                &nbsp;&nbsp;
                {t("general.app_name", {
                  owner_name: app_config[locale].name,
                })}
              </span>
            </div>

            <LineSquiggleIcon
              onClick={(e) => {
                e.stopPropagation();
                onSwitchToThreads();
              }}
              className="block sm:hidden opacity-80 size-5 stroke-1 hover:opacity-100"
            />
          </div>
        </div>

        <div className="absolute flex bottom-0 text-white z-10 w-full px-5 py-4 items-end">
          <div className="flex-1">
            {index === activeIndex &&
              lastSecondsVisibleIndex === index &&
              index !== (likedStates.length - 1) && (
                <div className="flex flex-col items-center opacity-80 animate-bounce">
                  <div className="leading-3 text-sm">
                    {t("general.scroll_for_more")}
                  </div>
                  <ChevronDownIcon className="stroke-1 size-5" />
                </div>
              )}
          </div>

          <div className="flex flex-col gap-y-2.5 items-center">
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(index);
              }}
              className="text-sm flex flex-col items-center cursor-pointer"
            >
              {likedStates[index] ? (
                <HeartIcon className="size-6 fill-current text-primary/80 stroke-primary/80 stroke-[1.5]" />
              ) : (
                <HeartIcon className="size-6 stroke-[1.5]" />
              )}
              <div>{formatCount(likeCounts[index])}</div>
            </div>

            <div className="text-[12px] leading-3 text-center opacity-80">
              {formatCount(Number(short.views || 0))}
              <br />
              {t("general.views")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
