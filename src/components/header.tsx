"use client";

import { usePosts } from "@/lib/hooks/use-posts";
import ProfileModal from "@/components/modals/profile";
import Stories from "@/components/stories";
import { capitalize, cn, formatTimeAgo } from "@/lib/utils";
import { CircleDashedIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import { RefObject } from "react";
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

  return (
    <div
      ref={headerRef}
      className={cn(
        "fixed top-0 z-50 flex items-center gap-x-2 w-full border-b border-x border-secondary/5 backdrop-blur-3xl bg-white/50 px-3.5 py-3",
        container_className
      )}
    >
      <div className="flex flex-1 items-center gap-x-2.5">
        <Stories size={50} />

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
                  —&nbsp;
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
                </span>
              </div>
              <div className="text-sm leading-4 opacity-80 hidden sm:flex">
                {finalPosts.length > 0 && latestTimeLabel && (
                  <>
                    — {t("general.posted")}&nbsp;&nbsp;
                    {t_last_time(latestTimeLabel.key, latestTimeLabel.values)}
                  </>
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
          <Button
            variant="primary"
            className="text-sm md:text-sm px-2.5 py-0.5 backdrop-blur-3xl text-nowrap"
          >
            {t("general.new_story")}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Header;
