"use client";

import SafeImage from "./safe-image";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { cn, formatCount, formatTimeAgo } from "@/lib/utils";
import {
  EllipsisVerticalIcon,
  EraserIcon,
  HeartIcon,
} from "lucide-react";
import Loader from "./loader";
import ProfileModal from "./modals/profile";
import ConfirmDialog from "./confirm-dialog";
import { useLocale, useTranslations } from "next-intl";
import { LangDir } from "@/lib/fonts";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import { useSession } from "@/lib/auth/client";
import {
  getStories,
  incrementStoryViews,
  toggleStoryLike,
  deleteStoryAction,
} from "@/lib/actions/stories";
import { captureClientEvent } from "@/lib/analytics/client";

type StoryItem = {
  id: string;
  type: "image" | "video";
  url: string;
  duration?: number;
  likes: number;
  views: number;
  createdAt: Date;
};

// --- URL NORMALIZER (handles old "http:/..." values) ---
const normalizeMediaUrl = (raw?: string | null): string => {
  if (!raw) return "";
  let url = raw.trim();

  // Fix "http:/host" or "https:/host" -> "http://host" / "https://host"
  url = url.replace(/^([a-zA-Z][a-zA-Z0-9+\-.]*:)(\/)([^/])/, "$1//$3");

  return url;
};

// a press must be held at least this long to be treated as a "hold" (pause);
// shorter presses stay quick taps that navigate like before
const HOLD_THRESHOLD_MS = 300;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const normalizedPointer = (
  rect: DOMRect,
  clientX: number,
  clientY: number,
) => ({
  x: clamp01((clientX - rect.left) / rect.width),
  y: clamp01((clientY - rect.top) / rect.height),
});

const Stories = ({ size, opened }: { size: number; opened?: boolean }) => {
  const t = useTranslations();
  const tLastTime = useTranslations("last_time");

  const locale = useLocale() as Locale;
  const dir = LangDir(locale);

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // per-story like state
  const [likedStates, setLikedStates] = useState<boolean[]>([]);
  const [likeCounts, setLikeCounts] = useState<number[]>([]);

  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isHeld, setIsHeld] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const imageStartTimeRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const pointerDownAtRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerTypeRef = useRef<string>("pointer");

  // per-carousel-session analytics aggregates
  const sessionStartRef = useRef<number | null>(null);
  const sessionStoriesRef = useRef(0);
  const sessionCompletionsRef = useRef(0);
  const sessionHoldsRef = useRef(0);
  const sessionTapsNextRef = useRef(0);
  const sessionTapsBackRef = useRef(0);
  const sessionLikesRef = useRef(0);
  const sessionUnlikesRef = useRef(0);
  const sessionSeenStoryIdsRef = useRef(new Set<string>());

  const currentStory = stories[currentIndex];
  const currentStoryId = currentStory?.id;

  const storyEventProps = (overrides: Record<string, unknown> = {}) => ({
    story_id: currentStoryId,
    story_index: currentIndex,
    stories_total: stories.length,
    media_type: currentStory?.type,
    ...overrides,
  });

  // pre-load delay state
  const [isPreloading, setIsPreloading] = useState<boolean>(false);
  const preloadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // media loading state (after delay – real image/video load)
  const [mediaLoading, setMediaLoading] = useState<boolean>(false);

  // story management (ellipsis menu → delete), only on /os for logged-in session
  const pathname = usePathname();
  const { data: session } = useSession();
  const canManage =
    (pathname === "/os" || pathname?.startsWith("/os/")) && !!session?.user;

  const [menuPos, setMenuPos] = useState<{
    x: number;
    y: number;
    storyIndex: number;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // story id captured the moment "Delete Story" is chosen — immune to any
  // index drift between menu interaction and confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // story interaction frozen while the manage menu / confirm dialog is open
  const menuOpen = !!menuPos || confirmOpen || deleting || !!pendingDeleteId;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ellipsisRef = useRef<HTMLButtonElement | null>(null);

  const MENU_WIDTH = 144; // w-36 — must match the menu container width so it stays flush with the ellipsis

  const clearPreloadingTimeout = () => {
    if (preloadingTimeoutRef.current) {
      clearTimeout(preloadingTimeoutRef.current);
      preloadingTimeoutRef.current = null;
    }
  };

  const clearHoldTimeout = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const releaseHold = () => {
    clearHoldTimeout();
    pointerDownAtRef.current = null;
    suppressClickRef.current = false;
    setIsHeld(false);
  };

  const resetStoryState = () => {
    setProgress(0);
    progressRef.current = 0;
    imageStartTimeRef.current = null;
    clearHoldTimeout();
    setIsHeld(false);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    clearPreloadingTimeout();
    setIsPreloading(false);
    setMediaLoading(false);
  };

  // --- Fetch stories from API ---
  const loadStories = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const data = await getStories({ page: 1, limit: 20 });
      const items = data.items || [];

      const mapped: StoryItem[] = items.map((item) => {
        const legacy = item as { url?: string; duration?: number };
        return {
          id: item.id,
          type: item.type,
          url: normalizeMediaUrl(item.media?.url ?? legacy.url),
          duration: item.media?.duration ?? legacy.duration,
          likes: Number(item.likes ?? 0),
          views: Number(item.views ?? 0),
          createdAt: new Date(item.createdAt ?? 0),
        };
      });

      setStories(mapped);
      setLikedStates(mapped.map(() => false));
      setLikeCounts(mapped.map((s) => s.likes));

      if (!mapped.length) {
        setOpen(false);
        setCurrentIndex(0);
        resetStoryState();
      } else {
        setCurrentIndex((prev) => Math.min(prev, mapped.length - 1));
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load stories");
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStories();
  }, [loadStories]);

  const goToNext = () => {
    if (!stories.length) return;
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // end of stories
      setOpen(false);
      setCurrentIndex(0);
      setProgress(0);
      resetStoryState();
    }
  };

  const goToPrevious = () => {
    if (!stories.length) return;
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      // first story – just reset progress
      setProgress(0);
      progressRef.current = 0;
    }
  };

  // Autoplay effect for images
  // IMPORTANT: only run when story is visible (not preloading, not mediaLoading)
  // and frozen while the manage menu / confirm dialog is open
  useEffect(() => {
    if (
      !open ||
      !stories.length ||
      !currentStory ||
      currentStory.type !== "image" ||
      isPreloading ||
      mediaLoading ||
      menuOpen ||
      isHeld
    ) {
      // stop any running animation if dialog closed or media not ready
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // fixed 5s duration for all images
    const duration = 5000;
    imageStartTimeRef.current =
      performance.now() - (progressRef.current / 100) * duration;

    const updateImageProgress = (now: number) => {
      if (!imageStartTimeRef.current) return;

      const elapsed = now - imageStartTimeRef.current;
      const percent = Math.min((elapsed / duration) * 100, 100);
      setProgress(percent);
      progressRef.current = percent;

      if (elapsed >= duration) {
        sessionCompletionsRef.current += 1;
        void captureClientEvent("story_complete", storyEventProps({}));
        goToNext();
        return;
      }

      animationRef.current = requestAnimationFrame(updateImageProgress);
    };

    animationRef.current = requestAnimationFrame(updateImageProgress);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    currentIndex,
    stories.length,
    currentStory?.id,
    currentStory?.type,
    isPreloading,
    mediaLoading,
    currentStory?.duration,
    menuOpen,
    isHeld,
  ]);

  // freeze/resume video playback while the manage menu / confirm is open
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !open) return;
    if (menuOpen || isHeld) {
      video.pause();
    } else if (!isPreloading && !mediaLoading) {
      video.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, open, isHeld]);

  const handleVideoTimeUpdate = () => {
    if (menuOpen || isHeld) return;
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const percent = (video.currentTime / video.duration) * 100;
    setProgress(percent);
  };

  const handleVideoEnded = () => {
    if (menuOpen) return; // never auto-advance under the menu
    sessionCompletionsRef.current += 1;
    void captureClientEvent("story_complete", storyEventProps({}));
    goToNext();
  };

  const handleVideoLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {
      // autoplay can fail depending on browser policy
    });
  };

  const handleStoryClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // a click right after releasing a hold is the tail of the pointer-up;
    // it must never be treated as a tap on the story
    if (suppressClickRef.current) return;
    // never navigate while the manage menu / confirm dialog is open —
    // a click meant for the menu must never advance the story
    if (menuOpen) return;
    if (!stories.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normalized = normalizedPointer(rect, e.clientX, e.clientY);
    const clickX = e.clientX - rect.left;
    const half = rect.width / 2;
    const previous = clickX < half;
    const direction = previous ? "back" : "next";

    if (previous) {
      sessionTapsBackRef.current += 1;
      goToPrevious();
    } else {
      sessionTapsNextRef.current += 1;
      goToNext();
    }
    void captureClientEvent("story_tap", storyEventProps({
      direction,
      pointer_type: lastPointerTypeRef.current || "pointer",
      pointer_x: normalized.x,
      pointer_y: normalized.y,
    }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (menuOpen || isPreloading || mediaLoading || !currentStory) return;
    if ((e.target as HTMLElement).closest("button")) return;

    pointerDownAtRef.current = performance.now();
    const rect = e.currentTarget.getBoundingClientRect();
    pointerDownPosRef.current = normalizedPointer(rect, e.clientX, e.clientY);
    lastPointerTypeRef.current = e.pointerType || "pointer";
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = setTimeout(() => {
      if (pointerDownAtRef.current !== null) {
        setIsHeld(true);
        sessionHoldsRef.current += 1;
        void captureClientEvent("story_hold_start", storyEventProps({
          pointer_x: pointerDownPosRef.current?.x ?? 0.5,
          pointer_y: pointerDownPosRef.current?.y ?? 0.5,
          pointer_type: lastPointerTypeRef.current,
        }));
      }
    }, HOLD_THRESHOLD_MS);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasHeld = isHeld;
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    const start = pointerDownAtRef.current;
    pointerDownAtRef.current = null;
    if (wasHeld) {
      const durationMs = start !== null ? performance.now() - start : 0;
      let pointer: { x: number; y: number };
      if (e.clientX === 0 && e.clientY === 0) {
        pointer = pointerDownPosRef.current ?? { x: 0.5, y: 0.5 };
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        pointer = normalizedPointer(rect, e.clientX, e.clientY);
      }
      void captureClientEvent("story_hold_end", storyEventProps({
        duration_ms: Math.round(durationMs),
        pointer_x: pointer.x,
        pointer_y: pointer.y,
        pointer_type: lastPointerTypeRef.current,
      }));
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 200);
    }
    pointerDownPosRef.current = null;
    setIsHeld(false);
  };

  const handlePointerLeave = () => {
    releaseHold();
  };

  const handlePointerCancel = () => {
    releaseHold();
  };

  // When dialog opens or story index changes, do a 500ms pre-load delay
  useEffect(() => {
    if (!open || !currentStory) {
      if (!open) {
        // dialog closed: reset everything
        // eslint-disable-next-line react-hooks/set-state-in-effect
        resetStoryState();
        setCurrentIndex(0);
        setMenuPos(null);
        setConfirmOpen(false);
        if (!deleting) setPendingDeleteId(null);
      }
      return;
    }

    // start fresh for this story
    resetStoryState();
    setIsPreloading(true);
    setMediaLoading(false);

    preloadingTimeoutRef.current = setTimeout(() => {
      setIsPreloading(false);
      setMediaLoading(true); // will stay true until onLoad/onCanPlay
    }, 500);

    return () => {
      clearPreloadingTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentIndex, currentStory?.id]);

  // --- API: increment views when story is actually watched ---
  useEffect(() => {
    if (!open || !currentStoryId) return;

    // "watched" when media is ready and overlays are visible
    if (isPreloading || mediaLoading) return;

    let canceled = false;

    const incrementView = async () => {
      try {
        const data = await incrementStoryViews(currentStoryId);

        if (canceled) return;

        // Optimistically update local views
        setStories((prev) =>
          prev.map((story) =>
            story.id === currentStoryId
              ? {
                  ...story,
                  views:
                    typeof data?.views === "number"
                      ? data.views
                      : story.views + 1,
                }
              : story,
          ),
        );
      } catch (err) {
        console.error("Error incrementing view", err);
      }
    };

    incrementView();

    sessionStoriesRef.current += 1;
    sessionSeenStoryIdsRef.current.add(currentStoryId);
    void captureClientEvent("story_open", storyEventProps({}));

    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentStoryId, isPreloading, mediaLoading]);

  // per-carousel-session analytics: start on open, capture aggregate on close
  useEffect(() => {
    if (open) {
      sessionStartRef.current = performance.now();
      sessionStoriesRef.current = 0;
      sessionCompletionsRef.current = 0;
      sessionHoldsRef.current = 0;
      sessionTapsNextRef.current = 0;
      sessionTapsBackRef.current = 0;
      sessionLikesRef.current = 0;
      sessionUnlikesRef.current = 0;
      sessionSeenStoryIdsRef.current = new Set();
      return;
    }

    if (sessionStartRef.current === null) return;
    const durationMs = performance.now() - sessionStartRef.current;
    void captureClientEvent("story_carousel_session", {
      duration_ms: Math.round(durationMs),
      stories_opened: sessionStoriesRef.current,
      stories_completed: sessionCompletionsRef.current,
      distinct_stories: sessionSeenStoryIdsRef.current.size,
      holds: sessionHoldsRef.current,
      taps_next: sessionTapsNextRef.current,
      taps_back: sessionTapsBackRef.current,
      likes: sessionLikesRef.current,
      unlikes: sessionUnlikesRef.current,
    });
    sessionStartRef.current = null;
  }, [open]);

  // per-story like toggle (API + optimistic UI)
  const toggleLike = (index: number) => {
    const story = stories[index];
    if (!story) return;

    const wasLiked = likedStates[index];
    const newDirection = wasLiked ? "dec" : "inc";

    // optimistic UI update
    setLikedStates((prev) => {
      const next = [...prev];
      next[index] = !wasLiked;
      return next;
    });

    setLikeCounts((prevCounts) => {
      const countsCopy = [...prevCounts];
      countsCopy[index] = countsCopy[index] + (wasLiked ? -1 : 1);
      return countsCopy;
    });

    // analytics: optimistic like count on the story
    const optimisticCount = (likeCounts[index] ?? 0) + (wasLiked ? -1 : 1);
    if (wasLiked) {
      sessionUnlikesRef.current += 1;
      void captureClientEvent("story_unlike", storyEventProps({
        story_id: story.id,
        story_index: index,
        likes: optimisticCount,
      }));
    } else {
      sessionLikesRef.current += 1;
      void captureClientEvent("story_like", storyEventProps({
        story_id: story.id,
        story_index: index,
        likes: optimisticCount,
      }));
    }

    // fire & forget API
    (async () => {
      try {
        const data = await toggleStoryLike(story.id, newDirection);

        if (data && data.likes != null) {
          setLikeCounts((prevCounts) => {
            const countsCopy = [...prevCounts];
            countsCopy[index] = Number(data.likes);
            return countsCopy;
          });
        }
      } catch (err) {
        console.error("Error toggling like", err);
      }
    })();
  };

  const handleImageLoaded = () => {
    // image is ready, stop showing loader
    setMediaLoading(false);
  };

  const handleImageError = () => {
    // broken asset: never freeze the reel on it — skip the story
    setMediaLoading(false);
    goToNext();
  };

  // close manage menu on outside click
  useEffect(() => {
    if (!menuPos) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (ellipsisRef.current?.contains(target)) return;
      setMenuPos(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuPos]);

  const handleDeleteStory = async () => {
    if (!pendingDeleteId || deleting) return;
    setDeleting(true);
    try {
      await deleteStoryAction(pendingDeleteId);
      // refresh the whole stories list so the deleted story is gone
      await loadStories(true);
    } catch (err) {
      console.error("Error deleting story", err);
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const handleVideoCanPlay = () => {
    // video is ready, stop showing loader
    setMediaLoading(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPreloadingTimeout();
      clearHoldTimeout();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const hasStories = stories.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <SafeImage
            src="/profile-image.png"
            alt=""
            width={size}
            height={size}
            loading="lazy"
            className="rounded-full border border-secondary/15 p-[2px] aspect-square cursor-pointer object-cover"
          />
        </DialogTrigger>

        {(!opened || hasStories) && (
          <DialogContent
            dir="ltr"
            className="py-5"
            onInteractOutside={(e) => {
              // keep the story dialog stable while the manage menu or the
              // delete confirmation (both portaled to body) are being used
              if (menuPos || confirmOpen) e.preventDefault();
            }}
          >
            {loading && <ProfileModal opened={true} />}

            {!loading && error && (
              <div className="relative w-full aspect-9/16 flex items-center justify-center border border-secondary/5 bg-white/50 text-sm text-primary">
                {error}
              </div>
            )}

            {!loading && !error && !hasStories && (
              <ProfileModal opened={true} />
            )}

            {!loading && !error && hasStories && currentStory && (
              <div
                onClick={handleStoryClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onPointerCancel={handlePointerCancel}
                className="relative w-full cursor-pointer overflow-hidden flex flex-col border border-secondary/5 backdrop-blur-3xl bg-white/50 aspect-9/16 min-w-xs select-none"
              >
                {/* media area */}
                <div className="p-1 absolute inset-0">
                  {/* Only render media after pre-load delay */}
                  {!isPreloading && (
                    <>
                      {currentStory.type === "image" ? (
                        <SafeImage
                          src={currentStory.url}
                          alt=""
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 80vw, 320px"
                          className="p-1 object-cover"
                          loading="lazy"
                          onLoad={handleImageLoaded}
                          onError={handleImageError}
                        />
                      ) : (
                        <video
                          ref={videoRef}
                          src={currentStory.url}
                          className="h-full w-full object-cover"
                          autoPlay
                          playsInline
                          onTimeUpdate={handleVideoTimeUpdate}
                          onEnded={handleVideoEnded}
                          onLoadedMetadata={handleVideoLoadedMetadata}
                          onCanPlay={handleVideoCanPlay}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Loader: during pre-load delay OR while media is loading */}
                {(isPreloading || mediaLoading) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader className="size-12 border-1 border-primary/5 text-primary/50 p-2 rounded-full" />
                  </div>
                )}

                {/* overlays should NOT show during pre-load or media load */}
                {!isPreloading && !mediaLoading && (
                  <>
                    {/* top gradient */}
                    <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/30 to-transparent z-5" />
                    {/* bottom gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-80 sm:mx-1 sm:mb-1 bg-gradient-to-t from-black/30 via-black/20 to-transparent z-[5]" />
                  </>
                )}

                {/* progress bars */}
                <div
                  className={cn(
                    "relative z-10 w-full pt-3 px-3.5 transition-opacity duration-300",
                    isHeld && "opacity-0 pointer-events-none",
                  )}
                >
                  <div className="h-0.5 w-full flex gap-x-1">
                    {stories.map((story, index) => {
                      let width = "0%";
                      if (index < currentIndex) width = "100%";
                      else if (index === currentIndex) width = `${progress}%`;

                      return (
                        <div
                          key={story.id}
                          className={cn(
                            "rounded-full bg-secondary/5 flex-1 backdrop-blur-3xl",
                            isPreloading || mediaLoading
                              ? "bg-secondary/5"
                              : "bg-white/50",
                          )}
                        >
                          <div
                            className={cn(
                              "h-full bg-white transition-all duration-100 linear rounded-full",
                              isPreloading || mediaLoading
                                ? "bg-secondary/10"
                                : "bg-white",
                            )}
                            style={{ width }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* header */}
                <div
                  dir={dir}
                  className={cn(
                    "relative z-10 flex gap-x-1.5 px-3 py-2 items-center transition-opacity duration-300",
                    isHeld && "opacity-0 pointer-events-none",
                  )}
                >
                  <SafeImage
                    src="/profile-image.png"
                    unoptimized
                    alt=""
                    width={35}
                    height={35}
                    loading="lazy"
                    className={cn(
                      "rounded-full border p-[2px] aspect-square cursor-pointer",
                      isPreloading || mediaLoading
                        ? "border-secondary/20"
                        : "border-white/35",
                    )}
                  />
                  <div
                    className={cn(
                      "flex-1 min-w-0",
                      isPreloading || mediaLoading
                        ? "text-secondary"
                        : "text-white",
                    )}
                  >
                    {app_config[locale].name}&nbsp;—&nbsp;
                    <span className="text-sm opacity-60">
                      {(() => {
                        const { key, values } = formatTimeAgo(
                          new Date(currentStory.createdAt),
                        );
                        return tLastTime(key, values);
                      })()}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      ref={ellipsisRef}
                      type="button"
                      aria-label="Story options"
                      // keep Radix from auto-focusing this on dialog open
                      // (it is the only focusable inside — its focus ring
                      // would flash a blue circle on first open)
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos(
                          menuPos
                            ? null
                            : {
                                x: rect.right,
                                y: rect.bottom + 4,
                                storyIndex: currentIndex,
                              },
                        );
                      }}
                      className="shrink-0 p-1.5 rounded-full cursor-pointer transition-colors border border-transparent hover:bg-white/5 hover:border-white/10 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                    >
                      <EllipsisVerticalIcon
                        className={cn(
                          "size-4 stroke-[1.5]",
                          isPreloading || mediaLoading
                            ? "text-secondary"
                            : "text-white",
                        )}
                      />
                    </button>
                  )}
                </div>

                {/* bottom right stats */}
                {!(isPreloading || mediaLoading) && (
                  <div
                    className={cn(
                      "absolute flex bottom-0 text-white z-10 w-full px-5 py-4 items=end transition-opacity duration-300",
                      isHeld && "opacity-0 pointer-events-none",
                    )}
                  >
                    <div className="flex-1" />
                    <div className="flex flex-col gap-y-2.5 items-center">
                      {/* LIKE */}
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(currentIndex);
                        }}
                        className="text-sm flex flex-col items-center cursor-pointer"
                      >
                        {likedStates[currentIndex] ? (
                          <HeartIcon className="size-6 fill-current text-primary/50 stroke-primary/50 stroke-[1.5]" />
                        ) : (
                          <HeartIcon className="size-6 stroke-1" />
                        )}
                        {likeCounts[currentIndex] > 0 ? (
                          <div>
                            {formatCount(likeCounts[currentIndex] ?? 0)}
                          </div>
                        ) : (
                          "Like"
                        )}
                      </div>

                      {/* VIEWS */}
                      {currentStory.views > 0 && (
                        <div className="text-[12px] leading-3 text-center opacity-60">
                          {formatCount(currentStory.views)}
                          <br />
                          {t("general.views")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* story manage menu — anchored exactly at bottom-right of the ellipsis icon */}
      {canManage &&
        menuPos &&
        menuPos.storyIndex === currentIndex &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            dir={dir}
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[60] w-36 px-1 py-1 rounded-xl border border-secondary/10 bg-white/80 backdrop-blur-3xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 outline-0 ring-0"
            style={{
              top: menuPos.y,
              left: Math.max(8, menuPos.x - MENU_WIDTH),
            }}
          >
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                // capture the exact story being viewed right now
                setPendingDeleteId(
                  stories[menuPos?.storyIndex ?? currentIndex]?.id ?? null,
                );
                setMenuPos(null);
                setConfirmOpen(true);
              }}
              className="w-full relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none ring-0 focus:outline-0 focus:bg-secondary/5 border border-transparent hover:bg-secondary/3 hover:border-secondary/3 transition-all duration-500 disabled:opacity-60"
            >
              <div className="flex-1 text-start">Delete Story —</div>
              <EraserIcon className="stroke-[1.5px] size-4" />
            </button>
          </div>,
          document.body,
        )}

      {/* delete confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!deleting) {
            setConfirmOpen(o);
            // cancelled/dismissed: release the frozen story so playback resumes
            if (!o) setPendingDeleteId(null);
          }
        }}
        description="This story will be permanently deleted."
        confirmLabel="Yes, Delete It"
        cancelLabel="No, Keep It"
        onConfirm={() => void handleDeleteStory()}
      />
    </>
  );
};

export default Stories;
