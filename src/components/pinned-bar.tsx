"use client";

import { PinIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PostWithReactions } from "@/lib/api/posts";

interface PinnedBarProps {
  pinnedPosts: PostWithReactions[];
  activeIndex: number;
  onScrollToPost: (id: string) => void;
  onUnpin: (post: PostWithReactions) => void;
}

function resolvePostPreview(post?: PostWithReactions) {
  if (!post) return "";
  if (post.type === "text") return post.content ?? "";
  return `${post.type.charAt(0).toUpperCase()}${post.type.slice(1)} Post`;
}

export default function PinnedBar({
  pinnedPosts,
  activeIndex,
  onScrollToPost,
  onUnpin,
}: PinnedBarProps) {
  const t = useTranslations();

  if (pinnedPosts.length === 0) return null;

  const clampedIndex = Math.min(activeIndex, pinnedPosts.length - 1);
  const current = pinnedPosts[clampedIndex];

  return (
    <div className="fixed top-[var(--chat-header-height)] left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 px-4">
      <div
        onClick={() => {
          if (current) onScrollToPost(current.id);
        }}
        className="w-full backdrop-blur-md border border-secondary/5 cursor-pointer px-3 py-2 rounded-2xl bg-background/50"
      >
        <div className="flex items-center gap-x-2.5">
          <PinIcon className="size-5 stroke-[1.5px] rotate-45 shrink-0" />
          <div className="flex flex-col flex-1 text-xs min-w-0">
            <span>
              {t("general.pinned_post")}
              {pinnedPosts.length > 1
                ? ` — ${clampedIndex + 1}/${pinnedPosts.length}`
                : ""}
            </span>
            <span className="line-clamp-1 whitespace-pre-wrap wrap-break-word opacity-60">
              {resolvePostPreview(current)}
            </span>
          </div>
          <XIcon
            onClick={(e) => {
              e.stopPropagation();
              if (current) onUnpin(current);
            }}
            className="size-3 stroke-[1.5px] cursor-pointer shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
