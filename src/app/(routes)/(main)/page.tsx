"use client";

import { Button } from "@/components/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import Post from "@/components/post";
import NewsletterModal from "@/components/modals/notifications";
import { InstallButton } from "@/components/pwa-install";
import Loader from "@/components/loader";
import { usePosts } from "@/lib/hooks/use-posts";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/header";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setUserLocale } from "@/services/locale";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import { batchIncrementViews } from "@/lib/actions/posts";

const Page = () => {
  const t = useTranslations();

  const router = useRouter();
  const locale = useLocale() as Locale;

  // Refs for header/footer like in the first page
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
      // get the height of the screen before loading anything
      updatePageHeight();
      window.addEventListener("resize", updatePageHeight);
      return () => window.removeEventListener("resize", updatePageHeight);
    }, []);

  // Root scroll container ref (optional but useful for future scroll-to-bottom logic)
  const pageRef = useRef<HTMLDivElement | null>(null);

  // --- header/footer offset calculation (SAME method as first page) ---
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
      // Optional: add back to pending if failed?
    }
  };

  // Infinite scroll: trigger when TOP sentinel is visible
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoading && !isLoadingMore) {
          loadMore(); // load older posts
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0.1,
      }
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

          // Batch views: wait 2 seconds after the first view in a batch
          if (!viewTimeoutRef.current) {
            viewTimeoutRef.current = setTimeout(() => {
              flushViews();
              viewTimeoutRef.current = null;
            }, 2000);
          }
        });
      },
      {
        root: container,
        threshold: 0.4,
      }
    );

    const items =
      container.querySelectorAll<HTMLDivElement>("[data-post-id]");
    items.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current);
        flushViews();
      }
    };
  }, [posts.length]);

  // Single media playing control (audio + video)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePlay = (event: Event) => {
      const target = event.target as HTMLMediaElement | null;
      if (
        !target ||
        (target.tagName !== "AUDIO" && target.tagName !== "VIDEO")
      ) {
        return;
      }

      const mediaElements =
        document.querySelectorAll<HTMLMediaElement>("audio, video");

      mediaElements.forEach((el) => {
        if (el !== target && !el.paused) {
          el.pause();
          const pauseEvent = new Event("forcedpause");
          el.dispatchEvent(pauseEvent);
        }
      });
    };

    document.addEventListener("play", handlePlay, true);

    return () => {
      document.removeEventListener("play", handlePlay, true);
    };
  }, []);

  // Whenever posts length changes, header height might change
  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [posts.length]);

  return (
    <div
      ref={pageRef}
      style={{ height: `${pageHeight}px` }}
      className="flex flex-col-reverse overflow-y-scroll none-scroll-bar w-full outline-none max-w-2xl border-x border-secondary/5"
    >
      {/* Header */}
      <Header
        explore
        headerRef={headerRef}
        container_className="max-w-2xl"
        postsData={posts}
        totalCount={total}
        loading={isLoading}
      />

      {/* —— List —— */}
      <div className="flex-1 px-2.5 w-full">
        {/* Initial load */}
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

        {/* Error */}
        {error && (
          <div className="text-center text-sm text-red-500">
            Failed to load messages: {error}
          </div>
        )}

        {/* Posts */}
        <div
          ref={listRef}
          className="flex flex-col-reverse min-h-[var(--page-height)] pt-[var(--chat-header-height)] pb-[var(--chat-footer-height)]"
        >
          {posts.map((msg, index) => (
            <div
              key={msg.id ?? index}
              data-message-id={msg.id}
              className="message-wrapper"
            >
              <Post post={msg} />
            </div>
          ))}

          {/* Loading more (top infinite scroll) */}
          {isLoadingMore && posts.length > 0 && (
            <div className="grid place-items-center">
              <Loader />
            </div>
          )}

          {/* Sentinel for infinite scroll at visual TOP (DOM bottom because of flex-col-reverse) */}
          <div ref={sentinelRef} />
        </div>
      </div>

      {/* Footer with bottom CTA (fixed) */}
      <div ref={footerRef} className="fixed bottom-0 max-w-2xl w-full z-50">
        <div className="flex w-full gap-x-1.5 sm:gap-x-2 px-4 pb-3 lg:pb-5 justify-center items-center">
          <InstallButton />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="text-sm md:text-sm px-3.5 py-1.5 backdrop-blur-3xl bg-white/50">
                {t("general.sub_newsletter_now")}
              </Button>
            </DialogTrigger>

            <DialogContent>
              <NewsletterModal />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Page;
