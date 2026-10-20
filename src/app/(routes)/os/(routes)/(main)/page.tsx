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
  PauseIcon,
  PlayIcon,
  ChevronDownIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  UploadIcon,
  XIcon,
  XCircleIcon,
  EyeIcon,
  DoorOpenIcon,
} from "lucide-react";
import { filterString } from "@/lib/filters";
import Header from "@/components/header";
import PinnedBar from "@/components/pinned-bar";
import LazyImageLoader from "@/components/lazy-image-loader";
import { IconButton, IconFileButton } from "@/components/icon-button";
import FolderIcon from "@/components/icons/folder-icon";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/context-menu";
import UpdateBanner from "@/components/update-banner";
import ScrollSafeZone from "@/components/scroll-safe-zone";
import WorkspaceShell from "@/components/workspace-shell";
import { raiseError } from "@/lib/error-bar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog";
import type { MediaPayload, PostWithReactions } from "@/lib/api/posts";
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          dir="ltr"
          className={cn(
            "relative rounded-2xl border border-primary/5 bg-primary/5 px-3 py-2 flex items-center gap-3",
            error && "cursor-pointer",
          )}
          onClick={error ? onRetry : undefined}
        >
          {/* Progress button — same ring as posts' download circle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (error) onRetry();
              else if (ready) togglePlay();
            }}
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
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-36">
        {/* Same as clicking the waveform: toggles playback in place. */}
        {ready && (
          <ContextMenuItem
            className="flex gap-x-2 py-1.5"
            onClick={() => {
              if (audioRef.current?.paused) void audioRef.current.play();
              else audioRef.current?.pause();
              setPlaying(!(audioRef.current?.paused ?? true));
            }}
          >
            <div className="flex-1">
              {playing ? "Pause audio" : "Play audio"}
            </div>
            {playing ? (
              <PauseIcon className="stroke-[1.5px] size-4" />
            ) : (
              <PlayIcon className="stroke-[1.5px] size-4" />
            )}
          </ContextMenuItem>
        )}

        <ContextMenuItem
          className="flex gap-x-2 py-1.5"
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <div className="flex-1">
            {uploading ? "cancel upload" : "remove —"}
          </div>
          <XIcon className="stroke-[1.5px] size-4" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
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
        "relative rounded-2xl border border-primary/5 bg-primary/5 px-3 py-3 flex items-center gap-3 min-w-[200px] max-w-full self-center",
        error && "cursor-pointer",
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

/* Overlay glass for image/video thumbnails. Deliberately barely-there: a hint
   of tint plus the blur and rim, so the media reads through it rather than
   being hidden behind a scrim. */
const overlayGlass =
  "liquid-glass-dark [--liquid-glass-bg:color-mix(in_srgb,black_6%,transparent)] " +
  "[--liquid-glass-wash-top:color-mix(in_srgb,white_4%,transparent)] " +
  "[--liquid-glass-wash-bottom:transparent] " +
  "[--liquid-glass-border-color:transparent]";

/* The small centred control needs real contrast, which a 6% wash cannot give
   over an arbitrary photo. It carries its own opaque chip — small enough that
   the picture still shows around it. This is also what keeps the white ring
   stroke and white icon legible now that the ring colours are tokens. */
const controlGlass =
  "liquid-glass-dark [--liquid-glass-bg:color-mix(in_srgb,black_55%,transparent)] " +
  "[--liquid-glass-wash-top:color-mix(in_srgb,white_12%,transparent)]";

/* Upload progress — a full-round ring on the image.

   The glass chip and the progress ring MUST be separate elements: both
   `.liquid-glass` and `.progress-ring` paint through `::before`, so sharing one
   element makes them collide and the ring never renders at all (design-system
   §4.6).

   Module scope, not inside `Page`: a component declared in a render is a new
   type on every render, so React unmounts and remounts the subtree — which
   restarts the ring's `--ring-progress` transition from 0 each time and makes
   the progress appear frozen. */
const UploadRingOverlay = ({ progress }: { progress: number }) => (
  <div
    className={cn(
      "absolute inset-[2px] z-10 grid place-items-center pointer-events-none",
      overlayGlass,
    )}
  >
    <div
      className={cn(
        "relative grid place-items-center size-8 rounded-full",
        controlGlass,
      )}
    >
      <span
        className="progress-ring progress-ring-sm absolute inset-0 rounded-full"
        style={{ "--ring-progress": `${progress}%` } as React.CSSProperties}
      />
    </div>
  </div>
);

/* Failed — retry icon on the image, larger, still clickable. The label moves
   below the image; nothing on the overlay tints it red. Same chip/ring split
   as above, minus the ring: there is no progress to show once it has failed.
   Module scope for the same reason as `UploadRingOverlay`. */
const RetryOverlay = ({ onRetry }: { onRetry: () => void }) => (
  <div
    className={cn(
      "absolute inset-[2px] z-10 grid place-items-center",
      overlayGlass,
    )}
  >
    <button
      type="button"
      aria-label="Retry upload"
      onClick={(e) => {
        e.stopPropagation();
        onRetry();
      }}
      className={cn(
        "relative grid place-items-center text-white rounded-full size-8 cursor-pointer outline-none",
        controlGlass,
      )}
    >
      <RotateCcwIcon className="size-5 stroke-[1.5px] shrink-0 relative z-10 opacity-80" />
    </button>
  </div>
);

/* Status line — outside the bordered media box, below it. Clamped to two
   lines at the thumbnail width so long labels wrap instead of overflowing. */
const StatusText = ({ children }: { children: React.ReactNode }) => (
  <div className="pt-1 text-center text-[12px] leading-[1.3] text-foreground/60 line-clamp-2 break-words px-0.5">
    {children}
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
  const [viewerOpen, setViewerOpen] = useState(false);

  const viewable = error === null && media !== null && objectUrl !== null;

  const viewLabel = isImage ? "view image" : "view video";
  const removeLabel = uploading ? "cancel upload" : "remove —";

  /* Square, unrounded media box — matches how images and videos are rendered
     everywhere else in the app (see post.tsx renderMedia). Only the surrounding
     glass panel is rounded, never the media itself. */
  const thumbClasses =
    "relative block w-24 h-24 border border-primary/5 bg-primary/3";

  /* The media itself sits 2px inside the border and carries 1px of its own
     padding, mirroring the parent's 1px border. */
  const mediaBox = "absolute inset-[2px] p-px overflow-hidden";

  const mediaFrame = (
    <div className={mediaBox}>
      {objectUrl ? (
        isImage ? (
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
        )
      ) : (
        /* Nothing decoded yet — the WebGL effect fills the gap, armed only
           if the upload is slow enough to still be loading at 300ms. */
        <LazyImageLoader />
      )}
    </div>
  );

  /* Persists once finished — "— uploaded" never fades, unlike the overlay
     above it, which still clears so the picture is revealed. */
  const statusText = uploading
    ? `${Math.round(progress)} / 100`
    : error
      ? "Failed — Try Again"
      : "— uploaded";

  const dialogContent = (
    <DialogContent>
      <div className="liquid-glass flex items-center justify-center overflow-hidden p-1">
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
  );

  /* Box only. The viewer is controlled so the context menu can open it with
     the exact same result as clicking the media. */
  const box = (
    <div className={thumbClasses}>
      {viewable ? (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogTrigger asChild>
            <div className="absolute inset-0 cursor-pointer outline-none">
              {mediaFrame}
            </div>
          </DialogTrigger>
          {dialogContent}
        </Dialog>
      ) : (
        mediaFrame
      )}

      {/* Held over the media for 2s after the transfer completes, so the ring
          can actually reach 100% and the user sees the upload land before the
          picture is revealed (see useDoneRevealTimer). */}
      {showOverlay && <UploadRingOverlay progress={progress} />}
      {error && <RetryOverlay onRetry={onRetry} />}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-24 shrink-0">
          {box}
          {statusText && <StatusText>{statusText}</StatusText>}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-36">
        {/* Same action as clicking the media — opens the viewer. */}
        {viewable && (
          <ContextMenuItem
            className="flex gap-x-2 py-1.5"
            onClick={() => setViewerOpen(true)}
          >
            <div className="flex-1">{viewLabel}</div>
            <DoorOpenIcon className="stroke-[1.5px] size-4" />
          </ContextMenuItem>
        )}

        {/* Verb changes with state: you cannot "remove from post" a transfer
            that is still in flight. */}
        <ContextMenuItem
          className="flex gap-x-2 py-1.5"
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <div className="flex-1">{removeLabel}</div>
          <XIcon className="stroke-[1.5px] size-4" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
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
      // Where the global error bar floats from the viewport bottom. Declared
      // here (not inside the bar) because only this page knows its own footer,
      // and the update banner's height is not known until it decides to show.
      document.documentElement.style.setProperty(
        "--error-bar-bottom",
        "calc(var(--chat-footer-height) + var(--update-banner-height, 0px) - 5px)",
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

  // Transient write/notice failures go to the global error bar
  // (`@/lib/error-bar`), which this page no longer renders locally.

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

  // Initial load / empty states are centered overlays — never scrollable and
  // never rendered together with the min-height posts list (which would add
  // a second viewport height below the loader).
  const isInitialLoading = isLoading && posts.length === 0;
  const isEmpty = !isLoading && posts.length === 0;

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
    refreshPinnedPosts().catch((err) => raiseError(err));
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
          raiseError(err);
          updatePost(target);
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
      media:
        validUrls.length > 0 ? ({ url: validUrls[0] } as MediaPayload) : null,
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
      replacePost(tempId, createdPost);
    } catch (err) {
      console.error("Error sending message", err);
      // Mark optimistic post as error instead of removing it
      const failedPost = posts.find((p) => p.id === tempId);
      if (failedPost) {
        updatePost({ ...failedPost, _status: "error" });
      }
      raiseError(err);
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
      addPost(createdPost);
    } catch (err) {
      console.error("Retry failed", err);
      updatePost({ ...post, _status: "error" });
      raiseError(err);
    }
  };

  // handle file selection - accept multiple files

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Allow re-selecting the same file
    e.target.value = "";

    // Only one media type per post — the hook enforces it and reports back.
    const result = selectFiles(files);
    raiseError(result.error, t("general.error_generic"));
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
    const content = post.content?.trim();
    if (content) return content;
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
      // Land the post exactly where the newest post rests: bottom edge above
      // the input (+ update banner), matching the list bottom padding.
      const rootStyles = getComputedStyle(document.documentElement);
      const footerH =
        parseFloat(rootStyles.getPropertyValue("--chat-footer-height")) || 0;
      const bannerH =
        parseFloat(rootStyles.getPropertyValue("--update-banner-height")) || 0;
      const prevScrollMargin = el.style.scrollMarginBottom;
      el.style.scrollMarginBottom = `${footerH + bannerH}px`;
      el.scrollIntoView({ behavior: "smooth", block: "end" });
      window.setTimeout(() => {
        el.style.scrollMarginBottom = prevScrollMargin;
      }, 1000);
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
    setInputValue(post.content ?? "");
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
      raiseError(err);
    }
  };

  // When selectedFiles/editing/pinned changes, the height changes, so update offsets
  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [selectedFiles.length, editingPostId, pinnedPosts.length]);

  return (
    <WorkspaceShell>
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
          className={`flex flex-col-reverse w-full outline-none border-x border-secondary/5 ${
            isInitialLoading || isEmpty
              ? "overflow-hidden"
              : "overflow-y-scroll none-scroll-bar"
          }`}
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
            {isInitialLoading && (
              <div className="w-full grid place-items-center overflow-hidden min-h-[calc(var(--page-height)+var(--pinned-bar-height,0px))] pt-[calc(var(--chat-header-height)+var(--pinned-bar-height,0px))] pb-[calc(var(--chat-footer-height)+var(--update-banner-height,0px)+var(--error-bar-height,0px))]">
                {error ? (
                  <p className="text-xl text-center w-full text-red-500">
                    Failed to Load Posts — {error}
                  </p>
                ) : (
                  <Loader className="size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
                )}
              </div>
            )}

            {isEmpty && (
              <div className="w-full grid place-items-center overflow-hidden px-[25px] min-h-[calc(var(--page-height)+var(--pinned-bar-height,0px))] pt-[calc(var(--chat-header-height)+var(--pinned-bar-height,0px))] pb-[calc(var(--chat-footer-height)+var(--update-banner-height,0px)+var(--error-bar-height,0px))]">
                {error ? (
                  <p className="text-xl text-center w-full text-red-500">
                    Failed to Load Posts — {error}
                  </p>
                ) : (
                  <p className="text-xl text-center w-full">
                    {t.rich("general.publish_first_content", {
                      highlight: (chunks) => (
                        <span className="text-primary">{chunks}</span>
                      ),
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Error — pinned-bar layer, just below the pinned banner, above posts */}
            {error && (
              <div
                className="fixed left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-2xl pointer-events-none"
                style={{
                  top: `calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) + 8px)`,
                  marginLeft: "var(--workspace-shift, 0px)",
                }}
              >
                <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-md px-4 py-3 text-center text-sm text-red-500">
                  Failed to Load Posts — {error}
                </div>
              </div>
            )}

            {/* Posts */}
            {!isInitialLoading && !isEmpty && (
              <div
                ref={listRef}
                className="flex flex-col-reverse min-h-[var(--page-height)] pt-[calc(var(--chat-header-height)+var(--pinned-bar-height,0px))] pb-[calc(var(--chat-footer-height)+var(--update-banner-height,0px)+var(--error-bar-height,0px))]"
              >
                {posts.map((msg: PostWithReactions) => (
                  <div
                    key={msg.id}
                    id={`message-${msg.id}`}
                    data-message-id={msg.id}
                    className="message-wrapper"
                  >
                    <Message
                      can_pin_post
                      can_edit_post
                      can_delete_post
                      can_copy_text
                      post={msg}
                      highlighted={highlightedPostId === msg.id}
                      pinned={msg.pinnedAt != null}
                      onDelete={(id) => {
                        const wasPinned = msg.pinnedAt != null;
                        removePost(id);
                        if (wasPinned) refreshPinnedPosts();
                      }}
                      onDeleteError={(err) => {
                        raiseError(err);
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
                  <div className="grid place-items-center py-4">
                    <Loader />
                  </div>
                )}

                {/* Sentinel for infinite scroll at visual TOP (DOM bottom because of flex-col-reverse) */}
                <div ref={sentinelRef} />
              </div>
            )}
          </div>
        </div>

        {/* Scroll safe zone — blurs the feed where it passes under the chrome.
            Edges with nothing behind them stay clear. */}
        <ScrollSafeZone
          scrollRef={pageRef}
          topInset="calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) / 2)"
          bottomInset="calc(var(--chat-footer-height) + (var(--update-banner-height, 0px) + var(--error-bar-height, 0px)) / 2)"
          enabled={!isInitialLoading && !isEmpty}
        />

        {/* Scroll to bottom — anchored to the feed column, hidden while at the bottom */}
        {showScrollToBottom && (
          <div
            onClick={scrollToBottom}
            style={{
              bottom: `calc(var(--chat-footer-height) + var(--update-banner-height, 0px) + var(--error-bar-height, 0px) - 5px)`,
            }}
            className="liquid-glass absolute right-4 z-40 p-1 rounded-full cursor-pointer text-foreground/80"
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
                className="liquid-glass w-full max-w-3xl cursor-pointer px-3 py-2 rounded-2xl"
                onClick={() => scrollToPost(activeEditPost.id)}
              >
                <div className="flex items-center gap-x-2.5">
                  <div className="flex flex-col flex-1 text-xs">
                    <span>{t("general.editing_post")}</span>
                    <span className="font-bidi line-clamp-1 whitespace-pre-wrap wrap-break-word opacity-60">
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

          <div className="liquid-glass flex w-full gap-x-3 px-4 pb-3 lg:pb-5 justify-center items-center">
            <div className="flex flex-col max-w-3xl w-full gap-y-2">
              {/* selected attachments preview — hidden during edit mode */}
              {!editingPostId && selectedFiles.length > 0 && (
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2 mt-2 pb-2 border-b border-secondary/5">
                  {selectedFiles.map((item, index) => (
                    <MediaAttachmentThumb
                      key={item.id ?? `${item.file.name}-${index}`}
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
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey) return;
                      if (isOffline) return;
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    ref={inputRef}
                    // Deliberately NOT swapped for an offline string — the
                    // header already says the connection is down, and the
                    // send/attach controls below carry the disabled state.
                    placeholder={t("general.message_input_placeholder")}
                    autoComplete="off"
                    autoCorrect="off"
                    autoFocus={false}
                    rows={1}
                    maxLength={4096}
                    disabled={isOffline}
                    className={cn(
                      "font-bidi text-start resize-none w-full flex py-2 pt-3 lg:pt-6 none-scroll-bar focus:outline-none active:outline-none overflow-y-hidden",
                      isOffline && "opacity-50 cursor-not-allowed",
                    )}
                  />
                </div>

                {/* Attach media. Disabled offline — the header already carries the message,
                    so the state is expressed here by the control itself. */}
                {!editingPostId && (
                  <IconFileButton
                    label={t("general.attach_media")}
                    accept="image/*,video/*,audio/*,application/*"
                    multiple
                    onChange={handleFileChange}
                    disabled={isOffline}
                    className="mt-3 lg:mt-5 shrink-0"
                  >
                    <FolderIcon className="stroke-[1px] size-full" />
                  </IconFileButton>
                )}

                <IconButton
                  label={t("general.send")}
                  onClick={handleSendMessage}
                  disabled={
                    isOffline ||
                    (!inputValue.trim() && completedMedia.length === 0) ||
                    isUploading ||
                    hasError
                  }
                  className="mt-3 lg:mt-5 shrink-0"
                >
                  <SendHorizonalIcon className="stroke-[1.5px] size-full rtl:rotate-180" />
                </IconButton>
              </div>
              <div className="line-clamp-2 md:line-clamp-1 text-sm tracking-tighter opacity-60">
                {t("general.lorem_ipsum")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <UpdateBanner />
    </WorkspaceShell>
  );
};

export default Page;
