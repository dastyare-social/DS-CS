"use client";

import { Button } from "@/components/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import Post from "@/components/post";
import PinnedBar from "@/components/pinned-bar";
import NewsletterModal from "@/components/modals/notifications";
import Loader from "@/components/loader";
import { usePosts } from "@/lib/hooks/use-posts";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/header";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setUserLocale } from "@/services/locale";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import { batchIncrementViews, getPinnedPosts } from "@/lib/actions/posts";
import type { PostWithReactions } from "@/lib/api/posts";

const Page = () => {
  const t = useTranslations();

  const router = useRouter();
  const locale = useLocale() as Locale;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);

  const updatePageHeight = () => {
    const h = window.innerHeight;
    setPageHeight(h);
    document.documentElement.style.setProperty("--page-height", `${h}px`);
    updateHeaderFooterOffsets();
  };

  useEffect(() => {
    updatePageHeight();
    window.addEventListener("resize", updatePageHeight);
    return () => window.removeEventListener("resize", updatePageHeight);
  }, []);

  const pageRef = useRef<HTMLDivElement | null>(null);

  const updateHeaderFooterOffsets = () => {
    requestAnimationFrame(() => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--chat-header-height",
        `${headerHeight + 20}px`
      );
      document.documentElement.style.setProperty(
        "--chat-footer-height",
        `${footerHeight + 20}px`
      );
    });
  };

  useEffect(() => {
    updateHeaderFooterOffsets();
    window.addEventListener("resize", updateHeaderFooterOffsets);
    return () => window.removeEventListener("resize", updateHeaderFooterOffsets);
  }, []);

  const { posts, total, isLoading, isLoadingMore, error, hasMore, loadMore } =
    usePosts(8);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ──────────────────────────────────────
  // Pinned posts
  // ──────────────────────────────────────
  const [dbPinnedPosts, setDbPinnedPosts] = useState<PostWithReactions[]>([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const programmaticScrollRef = useRef(false);
  // Ref tracks the user's cycle position — only changes on tap, never by scroll
  const cycleIndexRef = useRef(0);

  const refreshPinnedPosts = useCallback(async () => {
    const pinned = await getPinnedPosts();
    setDbPinnedPosts(pinned);
  }, []);

  useEffect(() => {
    refreshPinnedPosts().catch(() => {});
  }, [refreshPinnedPosts]);

  const pinnedPosts = dbPinnedPosts;

  // Clamp both display and cycle when pinned list shrinks
  useEffect(() => {
    if (pinnedPosts.length === 0) return;
    if (displayIndex >= pinnedPosts.length) {
      const clamped = pinnedPosts.length - 1;
      setDisplayIndex(clamped);
      cycleIndexRef.current = clamped;
    }
  }, [pinnedPosts.length, displayIndex]);

  // Scroll to a specific post with retry (loads more if needed)
  const scrollToPost = useCallback(async (targetId: string) => {
    let el = document.getElementById(`message-${targetId}`);
    let attempts = 0;
    while (!el && hasMore && attempts < 20) {
      if (!isLoading && !isLoadingMore) {
        loadMore();
      }
      await new Promise((r) => setTimeout(r, 200));
      el = document.getElementById(`message-${targetId}`);
      attempts++;
    }
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedPostId(targetId);

    const releaseLock = () => {
      programmaticScrollRef.current = false;
      setHighlightedPostId((current) =>
        current === targetId ? null : current
      );
    };

    if ("onscrollend" in el) {
      el.addEventListener("scrollend", releaseLock, { once: true });
      setTimeout(releaseLock, 3000);
    } else {
      setTimeout(releaseLock, 1500);
    }
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  // Click handler: advance cycle ref, scroll to that pin, update display
  const handleCyclePinned = useCallback(() => {
    if (pinnedPosts.length === 0) return;
    const next = (cycleIndexRef.current + 1) % pinnedPosts.length;
    cycleIndexRef.current = next;
    setDisplayIndex(next);
    scrollToPost(pinnedPosts[next].id);
  }, [pinnedPosts, scrollToPost]);

  // Scroll-based display: show which pinned post is most visible
  // Only updates displayIndex when user is scrolling manually (not programmatic)
  useEffect(() => {
    if (pinnedPosts.length === 0) return;
    const container = pageRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;
      const containerRect = container.getBoundingClientRect();
      let bestIndex = 0;
      let bestVisibility = -Infinity;

      for (let i = 0; i < pinnedPosts.length; i++) {
        const el = document.getElementById(`message-${pinnedPosts[i].id}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, containerRect.top);
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight > bestVisibility) {
          bestVisibility = visibleHeight;
          bestIndex = i;
        }
      }

      setDisplayIndex(bestIndex);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [pinnedPosts]);

  const handleUnpin = async (post: PostWithReactions) => {
    const { togglePinPost } = await import("@/lib/actions/posts");
    await togglePinPost(post.id, false);
    await refreshPinnedPosts();
  };

  // Track which posts we've already sent a "view" for
  const viewedIdsRef = useRef<Set<string>>(new Set());
  const pendingViewIdsRef = useRef<Set<string>>(new Set());
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushViews = async () => {
    if (pendingViewIdsRef.current.size === 0) return;
    const ids = Array.from(pendingViewIdsRef.current);
    pendingViewIdsRef.current.clear();
    try {
      await batchIncrementViews(ids);
    } catch (err) {
      console.error("Failed to send batch views", err);
    }
  };

  // Infinite scroll
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoading && !isLoadingMore) {
          loadMore();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  // Observer for post views
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("data-post-id");
          if (!id) return;
          if (viewedIdsRef.current.has(id)) return;
          viewedIdsRef.current.add(id);
          pendingViewIdsRef.current.add(id);
          if (!viewTimeoutRef.current) {
            viewTimeoutRef.current = setTimeout(() => {
              flushViews();
              viewTimeoutRef.current = null;
            }, 2000);
          }
        });
      },
      { root: container, threshold: 0.4 }
    );

    const items = container.querySelectorAll<HTMLDivElement>("[data-post-id]");
    items.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current);
        flushViews();
      }
    };
  }, [posts.length]);

  // Single media playing control
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePlay = (event: Event) => {
      const target = event.target as HTMLMediaElement | null;
      if (!target || (target.tagName !== "AUDIO" && target.tagName !== "VIDEO")) return;
      document.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
        if (el !== target && !el.paused) {
          el.pause();
          el.dispatchEvent(new Event("forcedpause"));
        }
      });
    };
    document.addEventListener("play", handlePlay, true);
    return () => document.removeEventListener("play", handlePlay, true);
  }, []);

  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [posts.length]);

  return (
    <>
      <PinnedBar
        pinnedPosts={pinnedPosts}
        activeIndex={displayIndex}
        onCycle={handleCyclePinned}
        onUnpin={handleUnpin}
      />

      <div
        ref={pageRef}
        style={{ height: `${pageHeight}px` }}
        className="flex flex-col-reverse overflow-y-scroll none-scroll-bar w-full outline-none max-w-2xl border-x border-secondary/5"
      >
        <Header
          explore
          headerRef={headerRef}
          container_className="max-w-2xl"
          postsData={posts}
          totalCount={total}
          loading={isLoading}
        />

        <div className="flex-1 px-2.5 w-full">
          {isLoading && posts.length === 0 && (
            <div className="w-full h-full flex justify-center items-center text-xl text-center">
              <Loader />
            </div>
          )}

          {!isLoading && posts.length === 0 && (
            <div className="w-full h-full flex justify-center items-center text-xl text-center">
              <div>
                {t.rich("general.wait_for_first_content", {
                  owner_name: app_config[locale].name,
                  highlight: (chunks) => (
                    <span className="text-primary">{chunks}</span>
                  ),
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-red-500">
              Failed to load messages: {error}
            </div>
          )}

          <div
            ref={listRef}
            className="flex flex-col-reverse min-h-[var(--page-height)] pt-[calc(var(--chat-header-height)+var(--pinned-bar-height,0px))] pb-[var(--chat-footer-height)]"
          >
            {posts.map((msg, index) => (
              <div
                key={msg.id ?? index}
                id={`message-${msg.id}`}
                data-message-id={msg.id}
                className={`message-wrapper rounded-2xl${highlightedPostId === msg.id ? " bg-primary/5 ring-2 ring-primary/40" : ""}`}
              >
                <Post post={msg} />
              </div>
            ))}

            {isLoadingMore && posts.length > 0 && (
              <div className="grid place-items-center">
                <Loader />
              </div>
            )}

            <div ref={sentinelRef} />
          </div>
        </div>

        <div ref={footerRef} className="fixed bottom-0 max-w-2xl w-full z-50">
          <div className="flex w-full gap-x-1.5 sm:gap-x-2 px-4 pb-3 lg:pb-5 justify-center items-center">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="text-sm md:text-sm px-3.5 py-1.5 backdrop-blur-3xl bg-white/50">
                  {t("general.join_my_channel")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <NewsletterModal />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
