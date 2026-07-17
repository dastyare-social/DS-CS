"use client";

import Loader from "@/components/loader";
import { useTranslations } from "next-intl";

interface NewThreadsBannerProps {
  count: number;
  isApplying: boolean;
  onClick: () => void;
}

export default function NewThreadsBanner({
  count,
  isApplying,
  onClick,
}: NewThreadsBannerProps) {
  const t = useTranslations();

  if (count <= 1) return null;

  return (
    <div
      onClick={onClick}
      className="sticky top-0 mx-4 pt-3.5 flex items-center justify-center"
    >
      <div className="px-3 py-1 rounded-full bg-primary/3 text-primary border border-primary/10 hover:bg-primary/5 text-sm cursor-pointer flex items-center gap-x-2">
        <span>
          {count} {t("general.new_posts")}
        </span>
        {isApplying && (
          <Loader className="size-4 border border-primary/20 text-primary/60 p-0.5 rounded-full bg-white/40" />
        )}
      </div>
    </div>
  );
}