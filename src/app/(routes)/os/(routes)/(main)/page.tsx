"use client";

import Message from "@/components/post";
import Loader from "@/components/loader";
import { usePosts } from "@/lib/hooks/use-posts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  createPost,
  togglePinPost,
  updatePostContent,
  viewPost,
  getPinnedPosts,
} from "@/lib/actions/posts";
import {
  CheckIcon,
  FileIcon,
  HardDriveIcon,
  PauseIcon,
  PlayIcon,
  ChevronDownIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  UploadIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { filterString } from "@/lib/filters";
import Header from "@/components/header";
import PinnedBar from "@/components/pinned-bar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import type { PostWithReactions } from "@/lib/api/posts";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import {
  buildMediaInputs,
  inferPostType,
  presignedTransport,
  useMediaUpload,
  type MediaUploadItem,
} from "@/lib/hooks/use-media-upload";

// Voice attachment — mirrors VoicePlayer's download phase on posts:
// circled progress icon + filling bars, then a playable local preview
const VoiceAttachment = ({
  item,
  onRemove,
  onRetry,
}: {
  item: MediaUploadItem;
  onRemove: () => void;
  onRetry: () => void;
}) => {
  const { file, progress, error } = item;
  const ratio = Math.min(Math.max(progress / 100, 0), 1);
  const uploading = error === null && progress < 100;
  const done = error === null && progress >= 100;
  const circumference = 2 * Math.PI * (0.45 * 36);

  // Check mark phase: keep ✓ for 2s after finishing, then become playable
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!done) {
      setReady(false);
      return;
    }
    const timer = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(timer);
  }, [done]);

  const objectUrl = useObjectUrl(file);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (s: number) => {
    if (!Number.isFinite(s)) return "";
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  // Played portion of the waveform once playable — like posts' VoicePlayer
  const playedRatio =
    ready && duration && duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!ready || !el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const r = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    el.currentTime = r * duration;
    setCurrentTime(r * duration);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const bars = useMemo(
    () =>
      Array.from({ length: 40 }, () => {
        return 8 + Math.round(Math.random() * 20);
      }),
    [],
  );

  return (
    <div
      dir="ltr"
      className={cn(
        "relative rounded-2xl border bg-primary/5 px-3 py-2 flex items-center gap-3",
        error ? "cursor-pointer" : "border-primary/5",
      )}
      onClick={error ? onRetry : undefined}
    >
      {/* Progress button — same ring as posts' download circle */}
      <button
        type="button"
        onClick={error ? onRetry : ready ? togglePlay : undefined}
        disabled={!ready && !error}
        className="relative flex items-center justify-center rounded-full outline-none border-[1.5px] border-primary/10 hover:bg-primary/3 cursor-pointer text-primary/60 w-9 h-9 disabled:cursor-default disabled:hover:bg-transparent"
      >
        {!error && !ready && (
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-primary/20"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-primary"
              strokeWidth="2"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={(1 - ratio) * circumference}
              strokeLinecap="round"
            />
          </svg>
        )}
        {error ? (
          <RotateCcwIcon className="w-5 h-5 relative z-10 stroke-1" />
        ) : !ready ? (
          done ? (
            <CheckIcon className="w-5 h-5 relative z-10 stroke-1" />
          ) : (
            <UploadIcon className="w-5 h-5 relative z-10 stroke-1 animate-pulse" />
          )
        ) : playing ? (
          <PauseIcon className="w-5 h-5 relative z-10 stroke-1" />
        ) : (
          <PlayIcon className="w-5 h-5 relative z-10 stroke-1" />
        )}
      </button>

      {ready && (
        <audio
          ref={audioRef}
          src={objectUrl ?? undefined}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      <div className="flex-1 flex flex-col gap-1">
        <div
          onClick={handleWaveformClick}
          className={cn(
            "w-40 max-w-full h-10 flex items-center gap-[2px]",
            ready && "cursor-pointer select-none",
          )}
        >
          {bars.map((h, idx) => {
            const barRatio = bars.length > 1 ? idx / (bars.length - 1) : 0;
            // Upload progress tint before ready, playback fill after — same
            // colors as posts' VoicePlayer (download /20, played /50)
            let bgClass = "bg-primary/10";
            if (!ready && !error && ratio >= barRatio)
              bgClass = "bg-primary/20";
            if (ready && playedRatio >= barRatio) bgClass = "bg-primary/50";
            return (
              <div
                key={idx}
                className={cn(
                  "flex-1 rounded-full transition-colors duration-150",
                  bgClass,
                )}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-primary">
          {uploading ? (
            <span>Uploading {Math.floor(ratio * 100)}%</span>
          ) : error ? (
            <span>Failed — Try Again</span>
          ) : ready && duration ? (
            <>
              <span className="opacity-60 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className="opacity-60">{formatSize(file.size)}</span>
            </>
          ) : (
            <span className="opacity-60">done</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 z-10 p-1 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
      >
        <XIcon className="size-2.5 stroke-[1.5px]" />
      </button>
    </div>
  );
};

// File attachment — original card style: thumb box + name + size + X
const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// File attachment — same chip style as voice upload: circled progress icon,
// name + status/size row, fully rounded border
const FileAttachment = ({
  item,
  onRemove,
  onRetry,
}: {
  item: MediaUploadItem;
  onRemove: () => void;
  onRetry: () => void;
}) => {
  const { file, progress, error } = item;
  const ratio = Math.min(Math.max(progress / 100, 0), 1);
  const uploading = error === null && progress < 100;
  const done = error === null && progress >= 100;
  const circumference = 2 * Math.PI * (0.45 * 36);

  // "done" phase for 2s after finishing, then settle on the file size
  const [doneExpired, setDoneExpired] = useState(false);
  useEffect(() => {
    if (!done) {
      setDoneExpired(false);
      return;
    }
    const timer = setTimeout(() => setDoneExpired(true), 2000);
    return () => clearTimeout(timer);
  }, [done]);

  return (
    <div
      dir="ltr"
      onClick={error ? onRetry : undefined}
      className={cn(
        "relative rounded-2xl border bg-primary/5 px-3 py-3 flex items-center gap-3 min-w-[200px] max-w-full self-center",
        error ? "cursor-pointer" : "border-primary/5",
      )}
    >
      {/* Progress circle — same ring as voice/posts download circle */}
      <div className="relative flex items-center justify-center rounded-full outline-none border-[1.5px] border-primary/10 text-primary/60 w-9 h-9 shrink-0">
        {!error && !doneExpired && (
          <svg className="absolute inset-0 h-full w-full -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-primary/20"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="50%"
              cy="50%"
              r="45%"
              className="stroke-primary"
              strokeWidth="2"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={(1 - ratio) * circumference}
              strokeLinecap="round"
            />
          </svg>
        )}
        {error ? (
          <RotateCcwIcon className="w-5 h-5 relative z-10 stroke-1" />
        ) : doneExpired ? (
          <FileIcon className="w-5 h-5 relative z-10 stroke-1" />
        ) : done ? (
          <CheckIcon className="w-5 h-5 relative z-10 stroke-1" />
        ) : (
          <UploadIcon className="w-5 h-5 relative z-10 stroke-1 animate-pulse" />
        )}
      </div>

      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <span className="truncate text-xs">{file.name}</span>
        <span
          className={`text-[11px] ${
            error ? "truncate" : "opacity-60 tabular-nums"
          }`}
        >
          {uploading
            ? `Uploading ${Math.floor(ratio * 100)}%`
            : error
              ? "Failed — Try Again"
              : doneExpired
                ? formatFileSize(file.size)
                : "done"}
        </span>
      </div>

      <div
        onClick={onRemove}
        className="cursor-pointer hover:opacity-60 mr-1 shrink-0"
      >
        <XIcon className="size-3 stroke-1" />
      </div>
    </div>
  );
};

// StrictMode-safe blob URL: create per effect run, revoke on cleanup
function useObjectUrl(file: File) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

// Keep the "done" pill + dark overlay for 2s after finishing, then reveal media
function useDoneRevealTimer(done: boolean) {
  const [doneExpired, setDoneExpired] = useState(false);
  useEffect(() => {
    if (!done) {
      setDoneExpired(false);
      return;
    }
    const timer = setTimeout(() => setDoneExpired(true), 2000);
    return () => clearTimeout(timer);
  }, [done]);
  return doneExpired;
}

const UploadPillOverlay = ({
  progress,
  uploading,
}: {
  progress: number;
  uploading: boolean;
}) => (
  <div className="absolute inset-0 z-10 bg-black/50 rounded-2xl flex items-center justify-center p-1 pointer-events-none">
    <div
      className="progress-ring progress-ring-sm text-white bg-white/10 backdrop-blur-xs rounded-full px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap transition-all duration-300"
      style={{ "--ring-progress": `${progress}%` } as React.CSSProperties}
    >
      {uploading ? `${Math.round(progress)} / 100` : "done"}
    </div>
  </div>
);

const ErrorOverlay = ({ onRetry }: { onRetry: () => void }) => (
  <div className="absolute inset-0 z-10 bg-black/50 rounded-2xl flex items-center justify-center p-1">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRetry();
      }}
      className="progress-ring progress-ring-sm text-white bg-white/10 backdrop-blur-xs rounded-full px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap transition-all duration-300 flex items-center gap-x-1 cursor-pointer outline-none"
      style={{ "--ring-progress": "0%" } as React.CSSProperties}
    >
      <RotateCcwIcon className="size-2.5 stroke-[1.5]" />
      Failed — Try Again
    </button>
  </div>
);

const RemoveBadge = ({ onClick }: { onClick: () => void }) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="absolute -top-1 -right-1 z-20 p-0.5 cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
  >
    <XIcon className="size-3 stroke-[1.5px]" />
  </div>
);

// Image / video attachment: pill progress while uploading, then click-to-view
// in a glassy modal exactly like post media
const MediaAttachment = ({
  item,
  onRemove,
  onRetry,
  isImage,
}: {
  item: MediaUploadItem;
  onRemove: () => void;
  onRetry: () => void;
  isImage: boolean;
}) => {
  const { file, progress, error, media } = item;
  const uploading = error === null && progress < 100;
  const done = error === null && progress >= 100;
  const doneExpired = useDoneRevealTimer(done);
  const showOverlay = uploading || (done && !doneExpired);
  const objectUrl = useObjectUrl(file);

  const viewable = error === null && media !== null && objectUrl !== null;

  const thumbClasses =
    "relative block w-20 h-20 border border-primary/5 bg-primary/3 flex justify-center items-center rounded-2xl";

  const thumb = (
    <>
      <div className="w-full h-full overflow-hidden rounded-2xl">
        {objectUrl &&
          (isImage ? (
            <img
              src={objectUrl}
              alt=""
              draggable={false}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={objectUrl}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ))}
      </div>

      {showOverlay && (
        <UploadPillOverlay progress={progress} uploading={uploading} />
      )}
      {error && <ErrorOverlay onRetry={onRetry} />}
      <RemoveBadge onClick={onRemove} />
    </>
  );

  if (!viewable) {
    return <div className={thumbClasses}>{thumb}</div>;
  }

  return (
    <Dialog>
      <DialogTrigger className={`${thumbClasses} cursor-pointer outline-none`}>
        {thumb}
      </DialogTrigger>
      <DialogContent>
        <div className="flex items-center justify-center overflow-hidden backdrop-blur-3xl p-1 border border-secondary/5 bg-white/50">
          {isImage ? (
            <img
              src={objectUrl!}
              alt=""
              className="object-contain max-w-full max-h-[70vh]"
            />
          ) : (
            <video
              src={objectUrl!}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[70vh]"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MediaAttachmentThumb = ({
  item,
  onRemove,
  onRetry,
}: {
  item: MediaUploadItem;
  onRemove: () => void;
  onRetry: () => void;
}) => {
  const { file } = item;
  const isAudio = file.type.startsWith("audio/");
  if (isAudio) {
    return (
      <VoiceAttachment item={item} onRemove={onRemove} onRetry={onRetry} />
    );
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isImage && !isVideo) {
    return <FileAttachment item={item} onRemove={onRemove} onRetry={onRetry} />;
  }

  return (
    <MediaAttachment
      item={item}
      onRemove={onRemove}
      onRetry={onRetry}
      isImage={isImage}
    />
  );
};

const Page = () => {
  const t = useTranslations();

  const locale = useLocale() as Locale;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);

  // Selected media state (upload + progress handled by the hook)
  const {
    items: selectedFiles,
    isUploading,
    completedMedia,
    hasError,
    selectFiles,
    removeFile,
    retryFile,
    clear,
  } = useMediaUpload(presignedTransport);

  // only update header/footer CSS variables
  const updateHeaderFooterOffsets = () => {
    requestAnimationFrame(() => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--chat-header-height",
        `${headerHeight + 20}px`,
      );
      document.documentElement.style.setProperty(
        "--chat-footer-height",
        `${footerHeight + 20}px`,
      );
    });
  };

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

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState<string>("");
  const MAX_LINES = 16;

  // Offline detection
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Transient error shown when a create/update/delete fails (e.g. demo mode)
  const [writeError, setWriteError] = useState<string | null>(null);
  const writeErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showWriteError = (err: unknown) => {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Operation failed";
    setWriteError(message);
    if (writeErrorTimerRef.current) clearTimeout(writeErrorTimerRef.current);
    writeErrorTimerRef.current = setTimeout(() => setWriteError(null), 5000);
  };

  useEffect(() => {
    return () => {
      if (writeErrorTimerRef.current) clearTimeout(writeErrorTimerRef.current);
    };
  }, []);

  // Reference to the scroll container (root div)
  const pageRef = useRef<HTMLDivElement | null>(null);

  // scroll-to-bottom chevron — hidden while at (or near) the visual bottom
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    // column-reverse: scrollTop is 0 at the visual bottom
    setShowScrollToBottom(Math.abs(target.scrollTop) > 80);
  };

  const scrollToBottom = () => {
    if (!pageRef.current) return;
    pageRef.current.scrollTo({ top: 0, behavior: "smooth" });
    setShowScrollToBottom(false);
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    // Auto-resize textarea
    el.style.height = "auto"; // reset to let scrollHeight shrink when deleting
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight || "20");
    const paddingTop = parseFloat(computed.paddingTop || "0");
    const paddingBottom = parseFloat(computed.paddingBottom || "0");

    const maxHeight = lineHeight * MAX_LINES + paddingTop + paddingBottom;

    // scrollHeight includes padding, so just cap it directly
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;

    const reachedMaxLines = el.scrollHeight >= maxHeight;
    el.style.overflowY = reachedMaxLines ? "auto" : "hidden";

    // keep header/footer offsets in sync
    updateHeaderFooterOffsets();
  }, [inputValue]);

  const {
    posts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    addPost,
    removePost,
    updatePost,
    replacePost,
  } = usePosts(8);

  // Pinned posts + editing state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(
    null,
  );
  const [displayIndex, setDisplayIndex] = useState(0);
  const [dbPinnedPosts, setDbPinnedPosts] = useState<PostWithReactions[]>([]);
  const programmaticScrollRef = useRef(false);
  // Ref tracks the user's cycle position — only changes on tap, never by scroll
  // Starts at -1 so first click goes to index 0 (the first pinned post)
  const cycleIndexRef = useRef(-1);

  // Fetch pinned posts from DB
  const refreshPinnedPosts = useCallback(async () => {
    const pinned = await getPinnedPosts();
    setDbPinnedPosts(pinned);
  }, []);

  useEffect(() => {
    refreshPinnedPosts().catch((err) => showWriteError(err));
  }, [refreshPinnedPosts]);

  // Re-fetch pinned posts when a post is pinned/unpinned
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

  const activeEditPost = useMemo(
    () =>
      editingPostId
        ? posts.find((post) => post.id === editingPostId)
        : undefined,
    [editingPostId, posts],
  );

  useEffect(() => {
    // when posts change, header height might change, so just update offsets
    updateHeaderFooterOffsets();
  }, [posts.length]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const viewedIdsRef = useRef<Set<string>>(new Set());

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
      {
        root: null,
        rootMargin: "200px",
        threshold: 0.1,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

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
          } catch (err) {
            console.error("Failed to send view", err);
          }
        });
      },
      {
        root: container,
        threshold: 0.4,
      },
    );

    const items =
      container.querySelectorAll<HTMLDivElement>("[data-message-id]");
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [posts.length]);

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

  // =========================
  // send text message with media (with optimistic UI)
  // =========================
  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();

    // Editing an existing post
    if (editingPostId) {
      if (!trimmed) return;
      const target = posts.find((p) => p.id === editingPostId);
      if (target) {
        // Optimistically update
        updatePost({ ...target, content: trimmed, updatedAt: new Date() });
        try {
          await updatePostContent(editingPostId, trimmed);
        } catch (err) {
          console.error("Failed to edit post", err);
          showWriteError(err);
          updatePost({ ...target, content: trimmed });
        }
      }
      setEditingPostId(null);
      setInputValue("");
      return;
    }

    const validUrls = completedMedia.map((m) => m.url);
    if (!trimmed && validUrls.length === 0) return;
    if (isUploading) return; // Don't send while uploading

    // Prepare media inputs from successfully uploaded URLs (with type + dimensions)
    const mediaInputs = buildMediaInputs(selectedFiles);

    // Determine post type based on the uploaded media kind
    const postType = inferPostType(selectedFiles);

    // Optimistic post: must conform to PostWithReactions
    const tempId = `temp-${Date.now()}`;

    const optimisticPost: PostWithReactions = {
      id: tempId,
      type: postType,
      content: trimmed || null,
      views: "0",
      pinnedAt: null,
      media: validUrls.length > 0 ? ({ url: validUrls[0] } as any) : null,
      createdAt: new Date(),
      updatedAt: null,
      reactions: [],
      _status: "sending",
      _pendingContent: trimmed || null,
      _pendingMedia: mediaInputs.length > 0 ? mediaInputs : undefined,
    };

    // 1) Optimistically add post
    addPost(optimisticPost);

    // 2) Clear input + reset media state
    setInputValue("");
    clear();
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.overflowY = "hidden";
    }

    // 3) Scroll to latest
    const pageEl = pageRef.current;
    if (pageEl) {
      requestAnimationFrame(() => {
        pageEl.scrollTop = pageEl.scrollHeight;
      });
    }

    try {
      const createdPost = await createPost(
        trimmed || null,
        mediaInputs.length > 0 ? mediaInputs : undefined,
      );

      // 4) Atomically replace the optimistic post with the real one
      if ((createdPost as any)._multiple) {
        const multipleResult = createdPost as any;
        removePost(tempId);
        multipleResult.posts.forEach((post: PostWithReactions) =>
          addPost(post),
        );
      } else {
        replacePost(tempId, createdPost);
      }
    } catch (err) {
      console.error("Error sending message", err);
      // Mark optimistic post as error instead of removing it
      const failedPost = posts.find((p) => p.id === tempId);
      if (failedPost) {
        updatePost({ ...failedPost, _status: "error" });
      }
      showWriteError(err);
    }
  };

  // Retry sending a failed post
  const handleRetryPost = async (post: PostWithReactions) => {
    if (!post._pendingContent && !post._pendingMedia) return;

    // Mark as sending again
    updatePost({ ...post, _status: "sending" });

    try {
      const createdPost = await createPost(
        post._pendingContent || null,
        post._pendingMedia && post._pendingMedia.length > 0
          ? post._pendingMedia
          : undefined,
      );

      // Remove the failed post and add the real one
      removePost(post.id);

      if ((createdPost as any)._multiple) {
        const multipleResult = createdPost as any;
        multipleResult.posts.forEach((p: PostWithReactions) => addPost(p));
      } else {
        addPost(createdPost);
      }
    } catch (err) {
      console.error("Retry failed", err);
      updatePost({ ...post, _status: "error" });
      showWriteError(err);
    }
  };

  // handle file selection - accept multiple files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Allow re-selecting the same file
    e.target.value = "";

    // Add new files to selection (up to max) and start uploading
    selectFiles(files);
  };

  // remove a selected file from the preview
  const handleRemoveFile = (index: number) => {
    removeFile(index);
  };

  // =========================
  // pinned posts
  // =========================
  const resolvePostPreview = (post?: PostWithReactions) => {
    if (!post) return "";
    if (post.type === "text") return post.content ?? "";
    return `${post.type.charAt(0).toUpperCase()}${post.type.slice(1)} Post`;
  };

  const scrollToPost = useCallback(
    async (targetId: string) => {
      // If the post isn't loaded yet, keep loading more pages until we find it or run out
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
          current === targetId ? null : current,
        );
      };

      if ("onscrollend" in el) {
        el.addEventListener("scrollend", releaseLock, { once: true });
        setTimeout(releaseLock, 3000);
      } else {
        setTimeout(releaseLock, 1500);
      }
    },
    [hasMore, isLoading, isLoadingMore, loadMore],
  );

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
      let bestIndex = -1;
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

      // Only update if a pinned post is actually visible (at least 10px)
      if (bestIndex >= 0 && bestVisibility >= 10) {
        setDisplayIndex(bestIndex);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [pinnedPosts]);

  const handleEditPost = (post: PostWithReactions) => {
    if (!post.content) return;
    setInputValue(post.content);
    setEditingPostId(post.id);
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setInputValue("");
  };

  const handleTogglePinPost = async (post: PostWithReactions) => {
    const currentlyPinned = post.pinnedAt != null;
    // Optimistically toggle in the post list
    updatePost({ ...post, pinnedAt: currentlyPinned ? null : new Date() });
    // Optimistically update pinned bar
    if (currentlyPinned) {
      setDbPinnedPosts((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      setDbPinnedPosts((prev) =>
        [...prev, { ...post, pinnedAt: new Date() }].sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime(),
        ),
      );
    }
    try {
      await togglePinPost(post.id, !currentlyPinned);
      // Confirm with server data
      await refreshPinnedPosts();
      refetch();
    } catch (err) {
      // Rollback on failure
      updatePost({
        ...post,
        pinnedAt: currentlyPinned ? new Date() : null,
      });
      await refreshPinnedPosts().catch(() => {});
      refetch();
      showWriteError(err);
    }
  };

  // When selectedFiles/editing/pinned changes, the height changes, so update offsets
  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [selectedFiles.length, editingPostId, pinnedPosts.length]);

  return (
    <>
      {/* Pinned posts — outside scroll container, fixed at top */}
      <PinnedBar
        pinnedPosts={pinnedPosts}
        activeIndex={displayIndex}
        onCycle={handleCyclePinned}
        onUnpin={handleTogglePinPost}
      />

      {/* Feed column — positioning context for overlays anchored to the posts feed */}
      <div className="relative w-full max-w-2xl">
        <div
          ref={pageRef}
          onScroll={handleListScroll}
          style={{ height: `${pageHeight}px` }}
          className="flex flex-col-reverse overflow-y-scroll none-scroll-bar w-full outline-none border-x border-secondary/5"
        >
          {/* Header */}
          <Header
            new_story={true}
            headerRef={headerRef}
            container_className="max-w-2xl"
          />

          {/* —— List —— */}
          <div className="flex-1 px-2.5 w-full">
            {/* Initial load */}
            {isLoading && posts.length === 0 && (
              <div className="w-full h-full flex justify-center items-center text-xl text-center">
                <Loader className="size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
              </div>
            )}

            {!isLoading && posts.length === 0 && (
              <div className="w-full h-full flex justify-center items-center text-xl text-center">
                {t.rich("general.wait_for_first_content", {
                  owner_name: app_config[locale].name,
                  highlight: (chunks) => (
                    <span className="text-primary">&nbsp;{chunks}&nbsp;</span>
                  ),
                })}
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 w-full max-w-2xl pointer-events-none"
                style={{
                  top: `calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) + 8px)`,
                }}
              >
                <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-md px-4 py-3 text-center text-sm text-red-500">
                  Failed to Load Posts — {error}
                </div>
              </div>
            )}

            {/* Posts */}
            <div
              ref={listRef}
              className="flex flex-col-reverse min-h-[var(--page-height)] pt-[calc(var(--chat-header-height)+var(--pinned-bar-height))] pb-[var(--chat-footer-height)]"
            >
              {posts.map((msg: PostWithReactions) => (
                <div
                  key={msg.id}
                  id={`message-${msg.id}`}
                  data-message-id={msg.id}
                  className={cn(
                    "rounded-2xl",
                    highlightedPostId === msg.id &&
                      "bg-primary/5 ring-2 ring-primary/40",
                  )}
                >
                  <Message
                    can_pin_post
                    can_edit_post
                    can_delete_post
                    can_copy_text
                    post={msg}
                    pinned={msg.pinnedAt != null}
                    onDelete={(id) => {
                      const wasPinned = msg.pinnedAt != null;
                      removePost(id);
                      if (wasPinned) refreshPinnedPosts();
                    }}
                    onDeleteError={(err) => {
                      showWriteError(err);
                      addPost(msg);
                    }}
                    onPin={handleTogglePinPost}
                    onEdit={handleEditPost}
                    onRetry={handleRetryPost}
                  />
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
        </div>

        {/* Write error toast */}
        {writeError && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[60] px-4 w-full max-w-2xl pointer-events-none"
            style={{
              top: `calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) + 8px)`,
            }}
          >
            <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-md px-4 py-3 text-center text-sm text-red-500">
              {writeError}
            </div>
          </div>
        )}

        {/* Scroll to bottom — anchored to the feed column, hidden while at the bottom */}
        {showScrollToBottom && (
          <div
            onClick={scrollToBottom}
            style={{ bottom: `calc(var(--chat-footer-height) - 5px)` }}
            className="absolute right-4 z-40 border border-secondary/5 p-1 rounded-full backdrop-blur-sm cursor-pointer hover:bg-secondary/3 text-foreground/80"
          >
            <ChevronDownIcon className="size-6 stroke-1 text-foreground/60" />
          </div>
        )}

        {/* Footer */}
        <div ref={footerRef} className="fixed bottom-0 max-w-2xl w-full z-50">
          {/* Editing post bar */}
          {activeEditPost && (
            <div className="w-full flex justify-center items-center tracking-tight px-4 pb-3">
              <div
                className="w-full max-w-3xl backdrop-blur-md border border-secondary/5 cursor-pointer px-3 py-2 rounded-2xl bg-background/50"
                onClick={() => scrollToPost(activeEditPost.id)}
              >
                <div className="flex items-center gap-x-2.5">
                  <div className="flex flex-col flex-1 text-xs">
                    <span>{t("general.editing_post")}</span>
                    <span className="line-clamp-1 whitespace-pre-wrap wrap-break-word opacity-60">
                      {resolvePostPreview(activeEditPost)}
                    </span>
                  </div>
                  <div
                    className="p-1 -m-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelEdit();
                    }}
                  >
                    <XIcon className="size-3 stroke-[1.5px] cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex w-full gap-x-3 px-4 pb-3 lg:pb-5 justify-center items-center border-t border-x border-secondary/5 backdrop-blur-md bg-white/50">
            <div className="flex flex-col max-w-3xl w-full gap-y-2">
              {/* selected attachments preview — hidden during edit mode */}
              {!editingPostId && selectedFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-2 pb-2 border-b border-secondary/5">
                  {selectedFiles.map((item, index) => (
                    <MediaAttachmentThumb
                      key={`${item.file.name}-${index}`}
                      item={item}
                      onRemove={() => handleRemoveFile(index)}
                      onRetry={() => retryFile(index)}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-x-2 w-full items-end">
                <div className="flex-1 sm:px-0 border-b border-secondary/5">
                  <textarea
                    value={filterString(inputValue)}
                    onChange={(e) => {
                      if (isOffline) return;
                      const newValue = e.target.value;
                      const lines = newValue.split("\n");
                      if (lines.length > MAX_LINES) {
                        setInputValue(lines.slice(0, MAX_LINES).join("\n"));
                        return;
                      }
                      setInputValue(newValue);
                    }}
                    onPaste={(e) => {
                      if (isOffline) return;
                      const pasted = e.clipboardData.getData("text");
                      if (!pasted) return;
                      const currentLines = inputValue.split("\n");
                      const pastedLines = pasted.split("\n");
                      if (currentLines.length + pastedLines.length <= MAX_LINES)
                        return;
                      e.preventDefault();
                      const remaining = MAX_LINES - currentLines.length;
                      if (remaining <= 0) return;
                      const truncated = pastedLines
                        .slice(0, remaining)
                        .join("\n");
                      setInputValue(inputValue + truncated);
                    }}
                    ref={inputRef}
                    placeholder={
                      isOffline
                        ? "You are offline"
                        : t("general.message_input_placeholder")
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    autoFocus={false}
                    rows={1}
                    maxLength={4096}
                    disabled={isOffline}
                    className={cn(
                      "text-start resize-none w-full flex py-2 pt-3 lg:pt-6 none-scroll-bar focus:outline-none active:outline-none overflow-y-hidden",
                      isOffline && "opacity-50 cursor-not-allowed",
                    )}
                  />
                </div>

                {/* hidden input + clickable icon to open file picker — hidden during edit */}
                {!editingPostId && (
                  <label className="relative">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,application/*"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isOffline}
                    />
                    <HardDriveIcon
                      className={`stroke-[1px] flex justify-center items-center opacity-80 w-10 h-10 mt-3 lg:mt-5 border border-secondary/3 p-2 rounded-full cursor-pointer ${isOffline ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                  </label>
                )}

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={
                    isOffline ||
                    (!inputValue.trim() && completedMedia.length === 0) ||
                    isUploading ||
                    hasError
                  }
                  className={cn(
                    "flex justify-center items-center w-10 h-10 mt-3 lg:mt-5 border border-secondary/3 p-2 rounded-full",
                    (isOffline ||
                      (!inputValue.trim() && completedMedia.length === 0) ||
                      isUploading ||
                      hasError) &&
                      "opacity-60",
                  )}
                >
                  <SendHorizonalIcon className="size-5 stroke-[1.5px] rtl:rotate-180 opacity-80" />
                </button>
              </div>
              <div className="line-clamp-2 md:line-clamp-1 text-sm tracking-tighter opacity-60">
                {isOffline ? (
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <WifiOffIcon className="size-3.5" />
                    You are offline. Viewing cached content.
                  </span>
                ) : (
                  t("general.lorem_ipsum")
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Page;
