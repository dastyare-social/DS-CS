"use client";

import { usePosts } from "@/lib/hooks/use-posts";
import ProfileModal from "@/components/modals/profile";
import UploadStoryModal from "@/components/modals/upload-story-modal";
import Stories from "@/components/stories";
import { capitalize, cn, formatTimeAgo } from "@/lib/utils";
import { CircleDashedIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import { RefObject, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import Link from "next/link";
import { routes } from "@/config/routes";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import type { PostWithReactions } from "@/lib/api/posts";

interface HeaderProps {
  explore?: boolean;
  new_story?: boolean;
  back_to_channel?: boolean;
  container_className?: string;
  headerRef?: RefObject<HTMLDivElement | null>;
  // NEW: optional props to avoid redundant fetch
  postsData?: PostWithReactions[];
  totalCount?: number | null;
  loading?: boolean;
}

const Header = ({
  explore = false,
  new_story = false,
  back_to_channel = false,
  container_className,
  headerRef,
  postsData,
  totalCount,
  loading,
}: HeaderProps) => {
  const t = useTranslations();

  const locale = useLocale() as Locale;

  // Fallback to usePosts only if props are not provided
  const hookData = usePosts(postsData ? 0 : 1);

  const finalPosts = postsData ?? hookData.posts;
  const finalTotal = totalCount ?? hookData.total;
  const finalIsLoading = loading ?? hookData.isLoading;

  const t_last_time = useTranslations("last_time");

  const latestPost = finalPosts[0];

  const latestTimeLabel =
    latestPost && latestPost.createdAt
      ? formatTimeAgo(new Date(latestPost.createdAt))
      : null;

  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/favicon.ico", { method: "HEAD", cache: "no-store" })
        .then(() => { if (!cancelled) setIsOffline(false); })
        .catch(() => { if (!cancelled) setIsOffline(true); });

    check();
    window.addEventListener("online", check);
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", check);
      clearInterval(interval);
    };
  }, []);

  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyRefreshKey, setStoryRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={headerRef}
      className={cn(
        "fixed top-0 z-50 flex items-center gap-x-2 w-full border-b border-x border-secondary/5 backdrop-blur-3xl bg-white/50 px-3.5 py-3",
        container_className,
      )}
    >
      <div className="flex flex-1 items-center gap-x-2.5">
        <Stories size={50} key={storyRefreshKey} />

        <Dialog>
          <DialogTrigger asChild>
            <div className="flex flex-col gap-y-1 cursor-pointer">
              <div className="text-xl flex flex-col sm:flex-row max-sm:justify-center sm:items-center">
                <span className="line-clamp-1">
                  {t("general.app_name", {
                    owner_name: app_config[locale].name,
                  })}
                  &nbsp;
                </span>
                <span className="text-sm opacity-80 flex">
                  {isOffline ? (
                    <span className="sm:hidden animate-pulse-text">
                      — you lost internet connection — trying to connect
                      <span className="inline-flex w-6 text-left">
                        <span className="dot-1">.</span>
                        <span className="dot-2">.</span>
                        <span className="dot-3">.</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <span>—&nbsp;</span>
                      {finalPosts.length > 0 && (
                        <>
                          {finalTotal} {t("general.posts")}
                          <span>&nbsp;{t("general.published")}</span>
                        </>
                      )}
                      {!finalIsLoading && finalPosts.length === 0 && (
                        <span className="hidden sm:block">
                          {t("general.not_posted_any_content_yet")}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
              <div className="text-sm leading-4 opacity-80 hidden sm:flex">
                {isOffline ? (
                  <span className="animate-pulse-text">
                    — you lost internet connection — trying to connect
                    <span className="inline-flex w-6 text-left">
                      <span className="dot-1">.</span>
                      <span className="dot-2">.</span>
                      <span className="dot-3">.</span>
                    </span>
                  </span>
                ) : (
                  finalPosts.length > 0 &&
                  latestTimeLabel && (
                    <>
                      — {t("general.posted")}&nbsp;&nbsp;
                      {t_last_time(latestTimeLabel.key, latestTimeLabel.values)}
                    </>
                  )
                )}
              </div>
            </div>
          </DialogTrigger>

          <DialogContent>
            <ProfileModal opened={true} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-x-1.5 items-center">
        {explore && (
          <Link
            href={routes.explore}
            className="flex gap-x-1.5 items-center text-sm cursor-pointer hover:opacity-60"
          >
            {capitalize(t("general.explore"))} —
            <CircleDashedIcon className="size-5 stroke-1 hidden sm:block" />
          </Link>
        )}

        {back_to_channel && (
          <Link
            href={routes.default}
            className="flex items-center text-sm cursor-pointer hover:opacity-60"
          >
            {capitalize(t("general.channel"))} —
          </Link>
        )}

        {new_story && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  e.target.value = "";
                  return;
                }

                const TARGET_RATIO = 9 / 16;
                const TOLERANCE = 0.02;

                const checkRatio = (w: number, h: number) => {
                  const ratio = w / h;
                  if (Math.abs(ratio - TARGET_RATIO) <= TOLERANCE) {
                    setStoryFile(file);
                    setStoryModalOpen(true);
                  } else {
                    setStoryError(t("general.story_ratio_error"));
                    setTimeout(() => setStoryError(null), 3000);
                  }
                };

                if (file.type.startsWith("video/")) {
                  const video = document.createElement("video");
                  video.preload = "metadata";
                  video.onloadedmetadata = () => {
                    URL.revokeObjectURL(video.src);
                    checkRatio(video.videoWidth, video.videoHeight);
                  };
                  video.src = URL.createObjectURL(file);
                } else {
                  const img = new Image();
                  img.onload = () => {
                    URL.revokeObjectURL(img.src);
                    checkRatio(img.naturalWidth, img.naturalHeight);
                  };
                  img.src = URL.createObjectURL(file);
                }

                e.target.value = "";
              }}
            />
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm md:text-sm px-2.5 py-0.5 backdrop-blur-3xl text-nowrap"
            >
              {t("general.new_story")}
            </Button>
          </>
        )}
      </div>

      <UploadStoryModal
        open={storyModalOpen}
        onOpenChange={setStoryModalOpen}
        file={storyFile}
        onStoryCreated={() => setStoryRefreshKey((k) => k + 1)}
      />

      {storyError && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 w-full max-w-2xl pointer-events-none" style={{ top: `calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) + 8px)` }}>
          <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-md px-4 py-3 text-center text-sm text-red-500">
            {storyError}
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
