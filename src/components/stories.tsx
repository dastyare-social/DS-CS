"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { useEffect, useRef, useState } from "react";
import { cn, formatCount, formatTimeAgo } from "@/lib/utils";
import { HeartIcon } from "lucide-react";
import Loader from "./loader";
import ProfileModal from "./modals/profile";
import { useLocale, useTranslations } from "next-intl";
import { LangDir } from "@/lib/fonts";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import {
  getStories,
  incrementStoryViews,
  toggleStoryLike,
} from "@/lib/actions/stories";

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const imageStartTimeRef = useRef<number | null>(null);

  const currentStory = stories[currentIndex];

  // pre-load delay state
  const [isPreloading, setIsPreloading] = useState<boolean>(false);
  const preloadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // media loading state (after delay – real image/video load)
  const [mediaLoading, setMediaLoading] = useState<boolean>(false);

  // --- Fetch stories from API on mount ---
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getStories({ page: 1, limit: 20 });
        const items = data.items || [];

        const mapped: StoryItem[] = items.map((item: any) => ({
          id: item.id,
          type: item.type,
          url: normalizeMediaUrl(item.media?.url ?? item.url),
          duration: item.media?.duration ?? item.duration,
          likes: Number(item.likes ?? 0),
          views: Number(item.views ?? 0),
          createdAt: new Date(item.createdAt),
        }));

        setStories(mapped);
        setLikedStates(mapped.map(() => false));
        setLikeCounts(mapped.map((s) => s.likes));
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load stories");
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

  const clearPreloadingTimeout = () => {
    if (preloadingTimeoutRef.current) {
      clearTimeout(preloadingTimeoutRef.current);
      preloadingTimeoutRef.current = null;
    }
  };

  const resetStoryState = () => {
    setProgress(0);
    imageStartTimeRef.current = null;

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
    }
  };

  // Autoplay effect for images
  // IMPORTANT: only run when story is visible (not preloading, not mediaLoading)
  useEffect(() => {
    if (
      !open ||
      !stories.length ||
      !currentStory ||
      currentStory.type !== "image" ||
      isPreloading ||
      mediaLoading
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
    imageStartTimeRef.current = performance.now();
    setProgress(0);

    const updateImageProgress = (now: number) => {
      if (!imageStartTimeRef.current) return;

      const elapsed = now - imageStartTimeRef.current;
      const percent = Math.min((elapsed / duration) * 100, 100);
      setProgress(percent);

      if (elapsed >= duration) {
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
  }, [
    open,
    currentIndex,
    stories.length,
    currentStory?.id,
    currentStory?.type,
    isPreloading,
    mediaLoading,
    currentStory?.duration,
  ]);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const percent = (video.currentTime / video.duration) * 100;
    setProgress(percent);
  };

  const handleVideoEnded = () => {
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
    if (!stories.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const half = rect.width / 2;

    if (clickX < half) {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  // When dialog opens or story index changes, do a 500ms pre-load delay
  useEffect(() => {
    if (!open || !currentStory) {
      if (!open) {
        // dialog closed: reset everything
        resetStoryState();
        setCurrentIndex(0);
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
    if (!open || !currentStory) return;

    // "watched" when media is ready and overlays are visible
    if (isPreloading || mediaLoading) return;

    let canceled = false;

    const incrementView = async () => {
      try {
        const data = await incrementStoryViews(currentStory.id);

        if (canceled) return;

        // Optimistically update local views
        setStories((prev) =>
          prev.map((story) =>
            story.id === currentStory.id
              ? {
                  ...story,
                  views:
                    typeof data?.views === "number"
                      ? data.views
                      : story.views + 1,
                }
              : story
          )
        );
      } catch (err) {
        console.error("Error incrementing view", err);
      }
    };

    incrementView();

    return () => {
      canceled = true;
    };
  }, [open, currentStory?.id, isPreloading, mediaLoading]);

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

  const handleVideoCanPlay = () => {
    // video is ready, stop showing loader
    setMediaLoading(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPreloadingTimeout();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const hasStories = stories.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Image
          src="/profile-image.png"
          alt="profile-image"
          width={size}
          height={size}
          loading="lazy"
          className="rounded-full border border-secondary/15 p-[2px] aspect-square cursor-pointer object-cover"
        />
      </DialogTrigger>

      {(!opened || hasStories) && (
        <DialogContent dir="ltr" className="py-5">
          {loading && <ProfileModal opened={true} />}

          {!loading && error && (
            <div className="relative w-full aspect-9/16 flex items-center justify-center border border-secondary/5 bg-white/50 text-sm text-primary">
              {error}
            </div>
          )}

          {!loading && !error && !hasStories && <ProfileModal opened={true} />}

          {!loading && !error && hasStories && currentStory && (
            <div
              onClick={handleStoryClick}
              className="relative w-full cursor-pointer overflow-hidden flex flex-col border border-secondary/5 backdrop-blur-3xl bg-white/50 aspect-9/16 min-w-xs"
            >
              {/* media area */}
              <div className="p-1 absolute inset-0">
                {/* Only render media after pre-load delay */}
                {!isPreloading && (
                  <>
                    {currentStory.type === "image" ? (
                      <Image
                        src={currentStory.url}
                        alt={`story_${currentIndex}`}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 80vw, 320px"
                        className="p-1 object-cover"
                        loading="lazy"
                        onLoad={handleImageLoaded}
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
              <div className="relative z-10 w-full pt-3 px-3.5">
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
                            : "bg-white/50"
                        )}
                      >
                        <div
                          className={cn(
                            "h-full bg-white transition-all duration-100 linear rounded-full",
                            isPreloading || mediaLoading
                              ? "bg-secondary/10"
                              : "bg-white"
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
                className="relative z-10 flex gap-x-1.5 px-3 py-2 items-center"
              >
                <Image
                  src="/profile-image.png"
                  unoptimized
                  alt="profile-image"
                  width={35}
                  height={35}
                  loading="lazy"
                  className={cn(
                    "rounded-full border p-[2px] aspect-square cursor-pointer",
                    isPreloading || mediaLoading
                      ? "border-secondary/20"
                      : "border-white/35"
                  )}
                />
                <div
                  className={cn(
                    isPreloading || mediaLoading
                      ? "text-secondary"
                      : "text-white"
                  )}
                >
                  {app_config[locale].name}&nbsp;—&nbsp;
                  <span className="text-sm opacity-60">
                    {(() => {
                      const { key, values } = formatTimeAgo(
                        new Date(currentStory.createdAt)
                      );
                      return tLastTime(key, values);
                    })()}
                  </span>
                </div>
              </div>

              {/* bottom right stats */}
              {!(isPreloading || mediaLoading) && (
                <div className="absolute flex bottom-0 text-white z-10 w-full px-5 py-4 items=end">
                  <div className="flex-1" />
                  <div className="flex flex-col gap-y-2.5 items-center">
                    {/* LIKE */}
                    <div
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
                        <div>{formatCount(likeCounts[currentIndex] ?? 0)}</div>
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
  );
};

export default Stories;
