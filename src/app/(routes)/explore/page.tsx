"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AsteriskIcon } from "lucide-react";
import Header from "@/components/header";
import Loader from "@/components/loader";
import Shorts from "@/components/shorts";
import Threads from "@/components/threads";
import { cn } from "@/lib/utils";
import { Locale } from "@/config/locale";
import type { PostWithReactions } from "@/lib/api/posts";
import {
  addReaction,
  batchIncrementViews,
  getExploreInitial,
  getPosts,
} from "@/lib/actions/posts";

type ExploreStateType = "shorts" | "threads";

export default function Page() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [exploreState, setExploreState] = useState<ExploreStateType>("shorts");
  const [isLoading, setIsLoading] = useState(true);
  const [shorts, setShorts] = useState<PostWithReactions[]>([]);
  const [threads, setThreads] = useState<PostWithReactions[]>([]);

  const [threadsPage, setThreadsPage] = useState(1);
  const [hasMoreThreads, setHasMoreThreads] = useState(true);
  const [isLoadingMoreThreads, setIsLoadingMoreThreads] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [isRefreshingThreads, setIsRefreshingThreads] = useState(false);
  const [isCheckingNewThreads, setIsCheckingNewThreads] = useState(false);
  const [isApplyingNewThreads, setIsApplyingNewThreads] = useState(false);
  const [pendingNewThreads, setPendingNewThreads] = useState<PostWithReactions[]>([]);
  const [newThreadsCount, setNewThreadsCount] = useState(0);

  const newPostsBannerRef = useRef<HTMLDivElement | null>(null);
  const threadsScrollRef = useRef<HTMLDivElement | null>(null);
  const threadsListRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const isPullingRef = useRef(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const threadsPageRef = useRef<HTMLDivElement | null>(null);
  const threadsSentinelRef = useRef<HTMLDivElement | null>(null);
  const threadVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const threadObserver = useRef<IntersectionObserver | null>(null);
  const hasAutoRefreshedRef = useRef(false);

  const [likedStates, setLikedStates] = useState<boolean[]>([]);
  const [likeCounts, setLikeCounts] = useState<number[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const clickCount = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastSecondsVisibleIndex, setLastSecondsVisibleIndex] = useState<number | null>(null);
  const viewedShorts = useRef<Set<string>>(new Set());
  const viewedThreads = useRef<Set<string>>(new Set());
  const pendingViewIdsRef = useRef<Set<string>>(new Set());
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [videoLoadingStates, setVideoLoadingStates] = useState<boolean[]>([]);
  const [videoPreloadStates, setVideoPreloadStates] = useState<boolean[]>([]);

  // Header/footer offset calculation
  const updateHeaderFooterOffsets = useCallback(() => {
    requestAnimationFrame(() => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const footerHeight = footerRef.current?.offsetHeight ?? 0;

      document.documentElement.style.setProperty(
        "--chat-header-height",
        `${headerHeight}px`
      );
      document.documentElement.style.setProperty(
        "--chat-footer-height",
        `${footerHeight + 20}px`
      );
    });
  }, []);

  // Initialize on mount
  useEffect(() => {
    updateHeaderFooterOffsets();
    window.addEventListener("resize", updateHeaderFooterOffsets);
    return () => window.removeEventListener("resize", updateHeaderFooterOffsets);
  }, [updateHeaderFooterOffsets]);

  // Update offsets on threads change
  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [threads.length, updateHeaderFooterOffsets]);

  // Update on explore state change
  useEffect(() => {
    const id = setTimeout(() => {
      updateHeaderFooterOffsets();
    }, 50);
    return () => clearTimeout(id);
  }, [exploreState, updateHeaderFooterOffsets]);

  // Video helpers
  const pauseAllVideos = useCallback(() => {
    videoRefs.current.forEach((v) => { if (v) v.pause(); });
    threadVideoRefs.current.forEach((v) => { if (v) v.pause(); });
  }, []);

  const pauseAllExcept = useCallback((videoToKeep?: HTMLVideoElement | null) => {
    videoRefs.current.forEach((v) => { if (v && v !== videoToKeep) v.pause(); });
    threadVideoRefs.current.forEach((v) => { if (v && v !== videoToKeep) v.pause(); });
  }, []);

  // Filter for threads
  const filterThreadPost = useCallback((m: PostWithReactions) => {
    if (m.type === "text") return true;
    if (m.type === "image" || m.type === "video") {
      const w = m.media?.width || 0;
      const h = m.media?.height || 0;
      return w >= h;
    }
    return false;
  }, []);

  // Refresh threads
  const refreshThreads = useCallback(async () => {
    if (isRefreshingThreads) return;
    try {
      setIsRefreshingThreads(true);
      setThreadsError(null);
      const data = await getPosts({ page: 1, limit: 10, type: "list" });
      const fetchedRaw = data.items || [];
      const refreshedThreads = fetchedRaw.filter(filterThreadPost);
      setThreads(refreshedThreads);
      setThreadsPage(1);
      setHasMoreThreads(fetchedRaw.length >= 10);
    } catch (error: any) {
      console.error("Failed to refresh threads", error);
      setThreadsError(error?.message ?? "Unknown error");
    } finally {
      setIsRefreshingThreads(false);
      setPullDistance(0);
    }
  }, [isRefreshingThreads, filterThreadPost]);

  // Initial fetch
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setIsLoading(true);
        setThreadsError(null);
        const combined = await getExploreInitial();
        const shortsData = combined.shorts;
        const threadsData = combined.threads;
        const fetchedShorts = shortsData.items || [];
        setShorts(fetchedShorts);
        if (fetchedShorts.length === 0) {
          setExploreState("threads");
        }
        setLikedStates(fetchedShorts.map(() => false));
        setLikeCounts(fetchedShorts.map((s) => {
          const heart = s.reactions?.find((r: any) => r.emoji === "❤️");
          return heart ? heart.count : 0;
        }));
        setVideoLoadingStates(fetchedShorts.map(() => true));
        setVideoPreloadStates(fetchedShorts.map(() => true));
        const initialThreadsRaw = threadsData.items || [];
        const initialThreads = initialThreadsRaw.filter(filterThreadPost);
        setThreads(initialThreads);
        setHasMoreThreads(initialThreadsRaw.length >= 10);
        setThreadsPage(1);
      } catch (error: any) {
        console.error("Failed to fetch explore data", error);
        setThreadsError(error?.message ?? "Unknown error");
        setHasMoreThreads(false);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialData();
  }, [filterThreadPost]);

  // Custom pull-to-refresh
  useEffect(() => {
    const container = threadsScrollRef.current;
    if (!container) return;

    let startY = 0;
    let isPulling = false;
    const PULL_THRESHOLD = 60;

    const onTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0 && !isRefreshingThreads) {
        startY = e.touches[0].clientY;
        isPulling = true;
        isPullingRef.current = true;
      } else {
        isPulling = false;
        isPullingRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0) {
        e.preventDefault();
        const damped = diff * 0.5;
        setPullDistance(damped);
      } else if (diff < -10) {
        isPulling = false;
        setPullDistance(0);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isPulling) {
        isPullingRef.current = false;
        return;
      }
      const endY = e.changedTouches[0].clientY;
      const diff = endY - startY;
      isPulling = false;
      isPullingRef.current = false;
      setPullDistance(0);

      if (
        diff > PULL_THRESHOLD &&
        container.scrollTop === 0 &&
        !isRefreshingThreads
      ) {
        refreshThreads();
      }
    };

    container.addEventListener("touchstart", onTouchStart, {
      passive: false,
      capture: true,
    });
    container.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    container.addEventListener("touchend", onTouchEnd, {
      capture: true,
    });

    return () => {
      container.removeEventListener("touchstart", onTouchStart, {
        capture: true,
      });
      container.removeEventListener("touchmove", onTouchMove, {
        capture: true,
      });
      container.removeEventListener("touchend", onTouchEnd, {
        capture: true,
      });
    };
  }, [isRefreshingThreads, threadsScrollRef, isPullingRef, refreshThreads]);

  // Auto refresh on initial load done
  useEffect(() => {
    if (!isLoading && threads.length > 0 && !isRefreshingThreads && !hasAutoRefreshedRef.current) {
      hasAutoRefreshedRef.current = true;
      refreshThreads();
    }
  }, [isLoading, threads.length, isRefreshingThreads, refreshThreads]);

  // Keep ref arrays synced
  if (videoRefs.current.length !== shorts.length) {
    videoRefs.current = Array(shorts.length).fill(null);
  }
  if (containerRefs.current.length !== shorts.length) {
    containerRefs.current = Array(shorts.length).fill(null);
  }
  if (videoLoadingStates.length !== shorts.length) {
    setVideoLoadingStates((prev) => {
      const next = [...prev];
      while (next.length < shorts.length) next.push(true);
      if (next.length > shorts.length) next.length = shorts.length;
      return next;
    });
  }
  if (videoPreloadStates.length !== shorts.length) {
    setVideoPreloadStates((prev) => {
      const next = [...prev];
      while (next.length < shorts.length) next.push(true);
      if (next.length > shorts.length) next.length = shorts.length;
      return next;
    });
  }
  if (threadVideoRefs.current.length !== threads.length) {
    threadVideoRefs.current = Array(threads.length).fill(null);
  }

  // Handle container click
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, index: number) => {
      if (index !== activeIndex) return;
      clickCount.current += 1;
      if (clickTimeout.current) clearTimeout(clickTimeout.current);
      clickTimeout.current = setTimeout(() => {
        if (clickCount.current === 1) {
          const video = videoRefs.current[index];
          if (!video) return;
          if (video.paused) {
            pauseAllExcept(video);
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
        if (clickCount.current === 2) {
          const currentlyLiked = likedStates[index];
          if (!currentlyLiked) {
            setLikedStates((prev) => {
              const next = [...prev];
              next[index] = true;
              return next;
            });
            setLikeCounts((prevCounts) => {
              const countsCopy = [...prevCounts];
              countsCopy[index] = countsCopy[index] + 1;
              return countsCopy;
            });
            addReaction(shorts[index].id, "❤️").catch(console.error);
          }
        }
        clickCount.current = 0;
      }, 250);
    },
    [activeIndex, likedStates, pauseAllExcept, shorts]
  );

  const toggleLike = useCallback(
    (index: number) => {
      const currentlyLiked = likedStates[index];
      setLikedStates((prev) => {
        const next = [...prev];
        next[index] = !currentlyLiked;
        return next;
      });
      setLikeCounts((prevCounts) => {
        const countsCopy = [...prevCounts];
        countsCopy[index] = countsCopy[index] + (currentlyLiked ? -1 : 1);
        return countsCopy;
      });
      if (!currentlyLiked) {
        addReaction(shorts[index].id, "❤️").catch(console.error);
      }
    },
    [likedStates, shorts]
  );

  const handleThreadReact = useCallback(
    (threadId: string, emoji: string) => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const existing = t.reactions.find((r: any) => r.emoji === emoji);
          const newReactions = existing
            ? t.reactions.map((r: any) =>
              r.emoji === emoji ? { ...r, count: r.count + 1 } : r
            )
            : [...t.reactions, { emoji, count: 1 }];
          return { ...t, reactions: newReactions };
        })
      );
      addReaction(threadId, emoji).catch(console.error);
    },
    []
  );

  // Scroll to index
  const scrollToIndex = useCallback(
    (index: number) => {
      const container = scrollContainerRef.current;
      const target = containerRefs.current[index];
      if (!container || !target) return;
      container.scrollTo({
        top:
          target.offsetTop -
          container.offsetTop -
          (container.clientHeight - target.clientHeight) / 2,
        behavior: "smooth",
      });
    },
    []
  );

  const handleVideoEnded = useCallback(
    (index: number) => {
      const isLast = index === shorts.length - 1;
      const nextIndex = isLast ? 0 : index + 1;
      scrollToIndex(nextIndex);
    },
    [scrollToIndex, shorts.length]
  );

  const loadMoreThreads = useCallback(async () => {
    if (isLoadingMoreThreads || !hasMoreThreads) return;
    try {
      setIsLoadingMoreThreads(true);
      setThreadsError(null);
      const nextPage = threadsPage + 1;
      const data = await getPosts({ type: "list", limit: 10, page: nextPage });
      const fetchedRaw = data.items || [];
      const moreThreads = fetchedRaw.filter(filterThreadPost);
      setThreads((prev) => [...prev, ...moreThreads]);
      setThreadsPage(nextPage);
      if (fetchedRaw.length < 10) setHasMoreThreads(false);
    } catch (error: any) {
      console.error("Failed to load more threads", error);
      setThreadsError(error?.message ?? "Unknown error");
      setHasMoreThreads(false);
    } finally {
      setIsLoadingMoreThreads(false);
    }
  }, [isLoadingMoreThreads, hasMoreThreads, threadsPage, filterThreadPost]);

  // Show new threads
  const handleShowNewThreads = useCallback(async () => {
    if (pendingNewThreads.length === 0 || isApplyingNewThreads) return;
    try {
      setIsApplyingNewThreads(true);
      const start = Date.now();
      setThreads((prev) => [...pendingNewThreads, ...prev]);
      setPendingNewThreads([]);
      setNewThreadsCount(0);
      const minDuration = 500;
      const elapsed = Date.now() - start;
      const remaining = minDuration - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      threadsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsApplyingNewThreads(false);
    }
  }, [pendingNewThreads, isApplyingNewThreads]);

  // Auto poll new threads every 30 seconds
  useEffect(() => {
    if (isLoading) return;
    const interval = setInterval(async () => {
      if (isCheckingNewThreads) return;
      try {
        setIsCheckingNewThreads(true);
        setThreadsError(null);
        const latestCreatedAt =
          threads.length > 0
            ? threads
                .slice()
                .sort(
                  (a, b) =>
                    (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
                    (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                )[0].createdAt
            : null;
        const data = await getPosts({ type: "list", limit: 10, page: 1 });
        const fetchedRaw = data.items || [];
        const fetchedFiltered = fetchedRaw.filter(filterThreadPost);
        if (fetchedFiltered.length === 0) {
          setIsCheckingNewThreads(false);
          return;
        }
        const existingIds = new Set(threads.map((t) => t.id));
        const pendingIds = new Set(pendingNewThreads.map((t) => t.id));
        const freshOnes = fetchedFiltered.filter(
          (m) => !existingIds.has(m.id) && !pendingIds.has(m.id)
        );
        const reallyNew =
          latestCreatedAt != null
            ? freshOnes.filter(
              (m) =>
                m.createdAt &&
                new Date(m.createdAt).getTime() > new Date(latestCreatedAt).getTime()
            )
            : freshOnes;
        if (reallyNew.length > 0) {
          setPendingNewThreads((prev) => {
            const merged = [...prev, ...reallyNew];
            const seen = new Set<string>();
            const unique: PostWithReactions[] = [];
            for (const m of merged) {
              if (!seen.has(m.id)) {
                seen.add(m.id);
                unique.push(m);
              }
            }
            setNewThreadsCount(unique.length);
            return unique;
          });
        }
      } catch (error: any) {
        console.error("Failed to check new threads", error);
      } finally {
        setIsCheckingNewThreads(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [threads, pendingNewThreads, isCheckingNewThreads, isLoading, filterThreadPost]);

  // Flush views
  const flushViews = useCallback(async () => {
    if (pendingViewIdsRef.current.size === 0) return;
    const ids = Array.from(pendingViewIdsRef.current);
    pendingViewIdsRef.current.clear();
    try {
      await batchIncrementViews(ids);
    } catch (err) {
      console.error("Failed to send batch views", err);
    }
  }, []);

  const queueView = useCallback((id: string) => {
    pendingViewIdsRef.current.add(id);
    if (!viewTimeoutRef.current) {
      viewTimeoutRef.current = setTimeout(() => {
        flushViews();
        viewTimeoutRef.current = null;
      }, 2000);
    }
  }, [flushViews]);

  // Track short views
  useEffect(() => {
    if (shorts.length > 0 && activeIndex >= 0 && activeIndex < shorts.length) {
      const short = shorts[activeIndex];
      if (!viewedShorts.current.has(short.id)) {
        viewedShorts.current.add(short.id);
        setShorts((prev) => {
          const next = [...prev];
          next[activeIndex] = {
            ...next[activeIndex],
            views: String(Number(next[activeIndex].views || 0) + 1),
          };
          return next;
        });
        queueView(short.id);
      }
    }
  }, [activeIndex, shorts, queueView]);

  // Track threads views
  useEffect(() => {
    if (!threadObserver.current) {
      threadObserver.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const threadId = entry.target.getAttribute("data-thread-id");
              if (threadId && !viewedThreads.current.has(threadId)) {
                viewedThreads.current.add(threadId);
                setThreads((prev) =>
                  prev.map((t) =>
                    t.id === threadId
                      ? {
                          ...t,
                          views: String(Number(t.views || 0) + 1),
                        }
                      : t
                  )
                );
                queueView(threadId);
              }
            }
          });
        },
        { threshold: 0.5 }
      );
    }
    const elements = document.querySelectorAll(".thread-item-view");
    elements.forEach((el) => threadObserver.current?.observe(el));
    return () => {
      threadObserver.current?.disconnect();
      threadObserver.current = null;
    };
  }, [threads, queueView]);

  // Active index handling
  useEffect(() => {
    const options: IntersectionObserverInit = {
      root: null,
      threshold: 0.6,
    };
    const observer = new IntersectionObserver((entries) => {
      let bestIndex = activeIndex;
      let bestIntersection = 0;
      entries.forEach((entry) => {
        const indexString = entry.target.getAttribute("data-index");
        if (!indexString) return;
        const index = parseInt(indexString, 10);
        const ratio = entry.intersectionRatio;
        if (ratio > bestIntersection) {
          bestIntersection = ratio;
          bestIndex = index;
        }
      });
      if (bestIntersection > 0 && bestIndex !== activeIndex) {
        setActiveIndex(bestIndex);
      }
    }, options);
    containerRefs.current.forEach((el, index) => {
      if (el) {
        el.setAttribute("data-index", String(index));
        observer.observe(el);
      }
    });
    return () => {
      observer.disconnect();
    };
  }, [activeIndex, shorts]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) {
        pauseAllExcept(video);
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
    setLastSecondsVisibleIndex(null);
  }, [activeIndex, pauseAllExcept, shorts]);

  useEffect(() => {
    const video = videoRefs.current[activeIndex];
    if (!video) return;
    const handleTimeUpdate = () => {
      const { duration, currentTime } = video;
      if (!duration || Number.isNaN(duration)) {
        setLastSecondsVisibleIndex(null);
        return;
      }
      const remaining = duration - currentTime;
      if (remaining <= 3) {
        setLastSecondsVisibleIndex(activeIndex);
      } else {
        if (lastSecondsVisibleIndex === activeIndex) {
          setLastSecondsVisibleIndex(null);
        }
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [activeIndex, lastSecondsVisibleIndex, shorts]);

  // Pull refresh loader calculations
  const pullMax = 80;
  const clampedPull = Math.min(pullDistance, pullMax);
  const REFRESHING_HEIGHT = 80;
  const refreshLoaderHeight = isRefreshingThreads
    ? REFRESHING_HEIGHT
    : clampedPull > 0
    ? clampedPull
    : 0;
  const refreshLoaderOpacity =
    refreshLoaderHeight === 0 ? 0 : Math.min(refreshLoaderHeight / pullMax, 1);

  if (isLoading && shorts.length === 0 && threads.length === 0) {
    return (
      <div className="w-full h-screen flex justify-center items-center text-xl text-center">
        <Loader />
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      style={{ height: "100dvh" }}
      className="w-full flex justify-center items-center outline-none max-w-4xl sm:border-x border-secondary/5"
    >
      <Header
        back_to_channel
        headerRef={headerRef}
        container_className={cn(
          "w-full max-w-4xl",
          exploreState === "shorts" ? "max-sm:hidden" : "max-sm:flex"
        )}
        postsData={threads}
        loading={isLoading}
      />

      <div
        className={cn(
          "relative sm:flex flex-1 justify-center h-full",
          exploreState === "threads" ? "flex" : "hidden"
        )}
      >
        <div ref={footerRef} className="fixed bottom-0 w-full max-w-xl z-50">
          <div className="flex justify-end w-full px-5 pb-5 pointer-events-auto">
            <AsteriskIcon
              onClick={() => {
              pauseAllVideos();
              setExploreState("shorts");
            }}
              className="flex sm:hidden opacity-80 size-12 stroke-1 hover:opacity-100 bg-primary/5 border border-primary/10 rounded-full p-1 text-primary backdrop-blur-3xl"
            />
          </div>
        </div>

        <Threads
          threads={threads}
          threadsError={threadsError}
          isRefreshingThreads={isRefreshingThreads}
          isApplyingNewThreads={isApplyingNewThreads}
          newThreadsCount={newThreadsCount}
          isLoadingMoreThreads={isLoadingMoreThreads}
          hasMoreThreads={hasMoreThreads}
          threadsPageRef={threadsPageRef}
          threadsScrollRef={threadsScrollRef}
          threadsListRef={threadsListRef}
          threadsSentinelRef={threadsSentinelRef}
          threadVideoRefs={threadVideoRefs}
          isPullingRef={isPullingRef}
          refreshLoaderHeight={refreshLoaderHeight}
          refreshLoaderOpacity={refreshLoaderOpacity}
          clampedPull={clampedPull}
          onShowNewThreads={handleShowNewThreads}
          onThreadReact={handleThreadReact}
          onVideoPlay={pauseAllExcept}
          loadMore={loadMoreThreads}
        />
      </div>

      <div
        className={cn(
          "hidden sm:block w-1 h-full bg-secondary/5",
          shorts.length === 0 || threads.length === 0 && "sm:hidden"
        )}
      />

      {exploreState === "shorts" && shorts.length > 0 && (
        <Shorts
          shorts={shorts}
          likedStates={likedStates}
          likeCounts={likeCounts}
          videoLoadingStates={videoLoadingStates}
          videoPreloadStates={videoPreloadStates}
          activeIndex={activeIndex}
          lastSecondsVisibleIndex={lastSecondsVisibleIndex}
          videoRefs={videoRefs}
          containerRefs={containerRefs}
          scrollContainerRef={scrollContainerRef}
          onContainerClick={handleClick}
          onToggleLike={toggleLike}
          onVideoPlay={pauseAllExcept}
          onVideoEnded={handleVideoEnded}
          onSwitchToThreads={() => {
            pauseAllVideos();
            setExploreState("threads");
          }}
          onWaiting={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
            },
            []
          )}
          onLoadStart={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
              setVideoPreloadStates((prev) => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
            },
            []
          )}
          onLoadedData={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
              setVideoPreloadStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
            },
            []
          )}
          onCanPlay={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
              setVideoPreloadStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
            },
            []
          )}
          onPlaying={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
              setVideoPreloadStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
            },
            []
          )}
          onStalled={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
              setVideoPreloadStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
            },
            []
          )}
          onError={useCallback(
            (index: number) => {
              setVideoLoadingStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
              setVideoPreloadStates((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
            },
            []
          )}
        />
      )}
    </div>
  );
}
