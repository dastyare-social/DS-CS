"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import Post from "@/components/post";
import NewsletterModal from "@/components/modals/notifications";
import Loader from "@/components/loader";
import Header from "@/components/header";
import type { PostWithReactions } from "@/lib/api/posts";
import { useTranslations } from "next-intl";
import { getPostById, viewPost } from "@/lib/actions/posts";

const Page = () => {
  const t = useTranslations();

  const router = useRouter();
  const params = useParams();
  const messageId = params?.post_id as string | undefined;

  const [message, setMessage] = useState<PostWithReactions | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track which messages we've already sent a "view" for
  const viewedIdsRef = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  // ---- NEW: layout refs & state (same pattern as other page) ----
  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  const [pageHeight, setPageHeight] = useState<number | null>(null);

  // Only update header/footer CSS variables
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

  // Update pageHeight from window + then update header/footer
  const updatePageHeight = () => {
    setPageHeight(window.innerHeight);
    updateHeaderFooterOffsets();
  };

  useEffect(() => {
    updatePageHeight(); // get the height of the screen before loading anything
    window.addEventListener("resize", updatePageHeight);
    return () => window.removeEventListener("resize", updatePageHeight);
  }, []);

  // Fetch single message
  useEffect(() => {
    if (!messageId) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    const fetchMessage = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getPostById(messageId);

        if (!data) {
          router.replace("/");
          return;
        }

        if (!cancelled) {
          setMessage(data);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error("Failed to fetch message", err);
        setError(err?.message ?? "Failed to load message");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchMessage();

    return () => {
      cancelled = true;
    };
  }, [messageId, router]);

  // Observer for message views
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    if (!message || !message.id) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (!entry.isIntersecting) return;

          const id = entry.target.getAttribute("data-message-id");
          if (!id) return;
          if (viewedIdsRef.current.has(id)) return;

          viewedIdsRef.current.add(id);

          try {
            await viewPost(id);

            // Optimistically update local views count if present
            setMessage((prev: PostWithReactions | null) =>
              prev && prev.id === id
                ? {
                    ...prev,
                    views: String((Number(prev.views) || 0) + 1),
                  }
                : prev
            );
          } catch (err) {
            console.error("Failed to send view", err);
          }
        });
      },
      {
        root: container,
        threshold: 0.4,
      }
    );

    const item = container.querySelector<HTMLDivElement>("[data-message-id]");
    if (item) observer.observe(item);

    return () => observer.disconnect();
  }, [message?.id]);

  // --- Single media playing control (audio + video) ---
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

  // When message changes, header height might change
  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [message?.id]);

  if (pageHeight === null) return null;

  return (
    <div
      ref={pageRef}
      style={{ height: `100dvh` }}
      className="flex flex-col-reverse overflow-y-scroll none-scroll-bar w-full outline-none max-w-2xl border-x border-secondary/5"
    >
      <Header
        headerRef={headerRef}
        container_className="max-w-2xl"
        postsData={message ? [message] : []}
        loading={isLoading}
      />

      <div className="flex-1 px-2.5 w-full">
        {/* Single Post Container */}
        <div
          ref={listRef}
          className="flex flex-col-reverse pt-[var(--chat-header-height)] pb-[var(--chat-footer-height)] w-full h-full"
        >
          {/* Loading state */}
          {isLoading && (
            <div className="w-full h-full flex justify-center items-center text-xl text-center">
              <Loader className="size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="w-full h-full flex justify-center items-center text-sm text-primary text-center px-4">
              Failed to load message: {error}
            </div>
          )}

          {/* Post Content */}
          {!isLoading && !error && message && (
            <div className="message-wrapper" data-message-id={message.id}>
              <Post post={message} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA (now fixed footer, using footerRef + CSS var) */}
      <div ref={footerRef} className="fixed bottom-0 max-w-2xl w-full z-50">
        <div className="flex gap-x-1.5 sm:gap-x-2 px-4 pb-3 lg:pb-5 justify-center items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="text-sm md:text-sm px-3.5 py-1.5 backdrop-blur-3xl bg-white/50 text-nowrap">
                {t("general.sub_newsletter_now")}
              </Button>
            </DialogTrigger>

            <DialogContent>
              <NewsletterModal />
            </DialogContent>
          </Dialog>

          <Button
            variant="primary"
            className="text-sm md:text-sm px-3.5 py-1.5 backdrop-blur-3xl text-nowrap"
            onClick={() => router.push("/")}
          >
            {t("general.view_other_contents")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Page;
