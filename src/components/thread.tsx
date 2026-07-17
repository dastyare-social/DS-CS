"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/context-menu";
import Stories from "@/components/stories";
import Reaction from "@/components/reaction";
import { app_config } from "@/config/app";
import { reactionEmojis } from "@/config/constants";
import { Locale } from "@/config/locale";
import { pally } from "@/lib/fonts";
import { renderSimpleMarkdown } from "@/lib/render-post-markdown";
import { cn, formatCount } from "@/lib/utils";
import { BoxIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useLocale } from "next-intl";

import type { PostWithReactions } from "@/lib/api/posts";

export interface ThreadItemProps {
  thread: PostWithReactions;
  index: number;
  threadVideoRef: (el: HTMLVideoElement | null) => void;
  onThreadReact: (threadId: string, emoji: string) => void;
  onPlay?: (video: HTMLVideoElement) => void;
  isPullingRef: { current: boolean };
}

export default function ThreadItem({
  thread,
  index,
  threadVideoRef,
  onThreadReact,
  onPlay,
  isPullingRef,
}: ThreadItemProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;

  return (
    <ContextMenu key={index}>
      <ContextMenuTrigger
        className="w-full"
        onContextMenu={(e) => {
          if (isPullingRef.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onTouchStart={(e) => {
          if (isPullingRef.current) {
            e.stopPropagation();
          }
        }}
      >
        <div
          data-thread-id={thread.id}
          className="thread-item-view w-full flex items-start gap-x-2.5 cursor-pointer hover:bg-primary/3 border-b border-secondary/5 py-5 px-5"
        >
          <Stories size={40} />
          <div className="flex flex-col text-sm gap-y-1.5 w-full">
            <div className="opacity-80">
              {app_config[locale].name}
              &nbsp;—&nbsp;
              <span dir="ltr" className={cn(pally.className)}>
                @{app_config.general.username}
              </span>
            </div>

            {/* Text Content */}
            <div className="text-[15px] whitespace-pre-wrap w-full">
              {renderSimpleMarkdown(thread.content) ?? "— no content —"}
            </div>

            {/* Media Content */}
            {thread.type === "image" && thread.media?.url && (
              <div
                className={cn(
                  "relative w-full max-w-2xs mt-2 max-h-[960px] overflow-hidden border border-secondary/5 aspect-video cursor-pointer",
                  thread.media["width"] === thread.media["height"] && "aspect-square",
                  thread.media["width"] > thread.media["height"] && "aspect-video"
                )}
              >
                <Image
                  src={thread.media.url}
                  alt={thread.content || "image_post"}
                  fill
                  sizes="(max-width: 768px) 80vw, 320px"
                  loading="lazy"
                  className="object-cover p-1"
                />
              </div>
            )}

            {thread.type === "video" && thread.media?.url && (
              <video
                ref={threadVideoRef}
                src={thread.media.url}
                controls
                className="mt-2 w-full border border-secondary/10"
                onPlay={(e) => {
                  onPlay?.(e.currentTarget);
                }}
              />
            )}

            <div className="flex flex-col sm:flex-row gap-x-1.5 gap-y-1.5 sm:items-end mt-2">
              <div className="flex-1 flex text-[12px] ml-[-1px] gap-x-1">
                {reactionEmojis.map((emoji) => {
                  const rCount =
                    thread.reactions?.find(
                      (r: any) => r.emoji === emoji
                    )?.count || 0;
                  return (
                    <div
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onThreadReact(thread.id, emoji);
                      }}
                    >
                      <Reaction emoji={emoji} count={rCount} />
                    </div>
                  );
                })}
              </div>

              <div className="opacity-60 flex gap-x-1 whitespace-nowrap">
                <span>
                  {formatCount(Number(thread.views || 0))} {t("general.views")}
                </span>
                &nbsp;—&nbsp;
                <span>
                  {thread.createdAt &&
                    new Date(thread.createdAt)
                      .toISOString()
                      .split("T")[0]
                      .replace(/-/g, "/")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-36">
        <ContextMenuItem
          onClick={() => {
            if (typeof window === "undefined") return;
            const url = new URL(window.location.href);
            url.pathname = `/posts/${thread.id}`;
            const full = url.toString();

            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(full).catch(() => {});
            } else {
              const textarea = document.createElement("textarea");
              textarea.value = full;
              textarea.style.position = "fixed";
              textarea.style.left = "-9999px";
              document.body.appendChild(textarea);
              textarea.select();
              try {
                document.execCommand("copy");
              } catch {
              } finally {
                document.body.removeChild(textarea);
              }
            }
          }}
          className="flex gap-x-2 py-1.5"
        >
          <div className="flex-1">{t("general.copy_post_link")} —</div>
          <BoxIcon className="stroke-[1.5px] size-4" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
