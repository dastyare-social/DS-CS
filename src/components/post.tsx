"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import SafeImage from "./safe-image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuEmojiBar,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./context-menu";
import Stories from "./stories";
import Reaction from "./reaction";
import Loader from "./loader";
import ImageSlider from "./image-slider";
import type { PostWithReactions } from "@/lib/api/posts";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { addReaction, deletePost, viewPost } from "@/lib/actions/posts";
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  BoxIcon,
  EraserIcon,
  PinIcon,
  CopyIcon,
  Clock8Icon,
  Edit3Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { quickReactionEmojis } from "@/config/constants";
import ConfirmDialog from "./confirm-dialog";
import { pally } from "@/lib/fonts";
import { renderSimpleMarkdown } from "@/lib/render-post-markdown";

// Accept both Date and string
const formatTime = (date: Date | string | null) => {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// --- URL NORMALIZER (handles old "http:/..." values too) ---
const normalizeMediaUrl = (raw?: string | null): string => {
  if (!raw) return "";
  let url = raw.trim();

  // Fix common typo: "http:/host" -> "http://host"
  // and "https:/host" -> "https://host"
  url = url.replace(
    /^([a-zA-Z][a-zA-Z0-9+\-.]*:)(\/)([^/])/, // protocol + single slash + non-slash
    "$1//$3",
  );

  return url;
};

type PostProps = {
  post: PostWithReactions;
  can_pin_post?: boolean;
  can_edit_post?: boolean;
  can_delete_post?: boolean;
  can_copy_text?: boolean;
  pinned?: boolean;
  highlighted?: boolean;
  // allow parent to remove from list optimistically
  onDelete?: (id: string) => void;
  onDeleteError?: (err: unknown) => void;
  // allow parent to pin/unpin and edit from context menu
  onPin?: (post: PostWithReactions) => void;
  onEdit?: (post: PostWithReactions) => void;
  // retry sending a failed post
  onRetry?: (post: PostWithReactions) => void;
};

/* -------------------- VOICE PLAYER COMPONENT -------------------- */

type VoicePlayerProps = {
  src: string;
  storedDurationMs?: number | null;
};

const VoicePlayer = ({ src, storedDurationMs }: VoicePlayerProps) => {
  const t = useTranslations();

  const [downloadProgress, setDownloadProgress] = useState(0); // 0..1
  const [isDownloading, setIsDownloading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  // restore downloaded audio from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `voice_downloaded_${src}`;
    const wasDownloaded = window.localStorage.getItem(storageKey);
    if (wasDownloaded === "1") {
      // If browser cache still has it, just point audio src to original URL
      setAudioUrl(src);
      setDownloadProgress(1);
      setIsDownloading(false);
    }
  }, [src]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const timeUpdate = () => {
      const ct = audio.currentTime || 0;
      const dur = audio.duration || 0;
      setCurrentTime(ct);
      setDuration(dur);
    };

    const onEnded = () => {
      setIsPlaying(false);
    };

    const onCanPlay = () => {
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    };

    const onPause = () => {
      if (audio.paused) {
        setIsPlaying(false);
      }
    };

    const onForcedPause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", timeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("forcedpause", onForcedPause as EventListener);

    return () => {
      audio.removeEventListener("timeupdate", timeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("forcedpause", onForcedPause as EventListener);
    };
  }, [isPlaying]);

  const handleDownloadAndTogglePlay = async () => {
    // Already downloaded: just toggle play/pause
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      if (audio.paused) {
        audio.play().catch(() => {});
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Not downloaded yet: start download
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const minDuration = 5; // seconds
    const startTime = performance.now();

    try {
      const response = await fetch(src);
      if (!response.ok || !response.body) {
        throw new Error("Failed to download audio");
      }

      const contentLengthHeader = response.headers.get("Content-Length");
      const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        const timeFactor = Math.min(elapsed / minDuration, 1); // 0..1

        if (done) {
          // stream finished: progress should be at least real progress, but capped by timeFactor
          setDownloadProgress((prev) => {
            const next = Math.max(prev, timeFactor);
            return Math.min(next, 1);
          });
          break;
        }

        if (value) {
          const chunk = value as Uint8Array;
          chunks.push(chunk);
          received += chunk.byteLength;

          let realProgress: number;
          if (total > 0) {
            realProgress = received / total;
          } else {
            // Fallback: treat up to ~1MB as full
            realProgress = Math.min(received / (1024 * 1024), 0.99);
          }

          // visible = min(real, timeFactor) but never less than a very small >0 once we have data
          const visibleProgress = Math.min(realProgress, timeFactor);
          const safeVisible = visibleProgress > 0 ? visibleProgress : 0.01; // avoid being stuck at exactly 0

          setDownloadProgress((prev) =>
            safeVisible > prev ? safeVisible : prev,
          );
        }
      }

      // Ensure total visible time is at least minDuration
      const totalElapsed = (performance.now() - startTime) / 1000;
      if (totalElapsed < minDuration) {
        const remaining = minDuration - totalElapsed;
        await new Promise((resolve) => setTimeout(resolve, remaining * 1000));
      }

      setDownloadProgress(1);

      const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setIsDownloading(false);

      if (typeof window !== "undefined") {
        const storageKey = `voice_downloaded_${src}`;
        window.localStorage.setItem(storageKey, "1");
      }

      setIsPlaying(true);

      requestAnimationFrame(() => {
        if (audioRef.current) {
          audioRef.current.load();
        }
      });
    } catch (e) {
      console.error(e);
      setIsDownloading(false);
      setDownloadProgress(0);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration || !audioUrl) return;
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const ratio = Math.min(Math.max(clickX / rect.width, 0), 1);
    const newTime = duration * ratio;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatSeconds = (secs: number) => {
    if (!secs || !Number.isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const playbackProgress =
    duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const bars = useMemo(
    () =>
      Array.from({ length: 50 }, () => {
        return 8 + Math.round(Math.random() * 20);
      }),
    [],
  );

  const showDownloadPhase = !audioUrl;

  return (
    <div
      dir="ltr"
      className="w-3xs rounded-2xl border border-primary/5 bg-primary/5 px-3 py-2 flex items-center gap-3"
    >
      <button
        type="button"
        onClick={handleDownloadAndTogglePlay}
        className="relative flex items-center justify-center rounded-full outline-none border-[1.5px] border-primary/10 hover:bg-primary/3 cursor-pointer text-primary/60 w-9 h-9 disabled:opacity-60"
        disabled={isDownloading && showDownloadPhase}
      >
        {showDownloadPhase ? (
          <>
            {isDownloading && (
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
                  strokeDasharray={2 * Math.PI * (0.45 * 36)}
                  strokeDashoffset={
                    (1 - Math.min(downloadProgress, 1)) *
                    2 *
                    Math.PI *
                    (0.45 * 36)
                  }
                  strokeLinecap="round"
                />
              </svg>
            )}
            <DownloadIcon className="w-5 h-5 relative z-10 stroke-1" />
          </>
        ) : isPlaying ? (
          <PauseIcon className="w-5 h-5 stroke-1" />
        ) : (
          <PlayIcon className="w-5 h-5 stroke-1" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          ref={waveformRef}
          className="relative h-10 cursor-pointer select-none flex items-center gap-[2px]"
          onClick={handleSeek}
        >
          {bars.map((h, idx) => {
            const barCount = bars.length;
            const barRatio = barCount > 1 ? idx / (barCount - 1) : 0;
            const isPlayed = !showDownloadPhase && playbackProgress >= barRatio;

            let bgClass = "bg-primary/10";
            if (showDownloadPhase && downloadProgress >= barRatio) {
              bgClass = "bg-primary/20";
            }
            if (!showDownloadPhase && isPlayed) {
              bgClass = "bg-primary/50";
            }

            return (
              <div
                key={idx}
                className={`flex-1 rounded-full transition-colors duration-150 ${bgClass}`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-primary">
          <span>
            {showDownloadPhase
              ? isDownloading
                ? `Downloading ${Math.floor(
                    Math.min(downloadProgress, 1) * 100,
                  )}%`
                : t("general.tap_to_download")
              : isPlaying
                ? ""
                : ""}
          </span>
          <span>
            {showDownloadPhase
              ? storedDurationMs
                ? formatSeconds(storedDurationMs / 1000)
                : formatSeconds(currentTime)
              : `${formatSeconds(currentTime)} / ${formatSeconds(duration)}`}
          </span>
        </div>
      </div>

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" />
    </div>
  );
};

/* -------------------- FILE DOWNLOAD COMPONENT -------------------- */

type FileDownloadProps = {
  src: string;
  filename?: string | null;
  filesize?: number | null;
  mimeType?: string | null;
};

const FileDownload = ({
  src,
  filename,
  filesize,
  mimeType,
}: FileDownloadProps) => {
  const t = useTranslations();

  const [downloadProgress, setDownloadProgress] = useState(0); // 0..1
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const prettyName = filename
    ? decodeURIComponent(filename)
    : src.split("/").pop() || "Downloaded file";

  const formatFileSize = (size?: number | null) => {
    if (!size || !Number.isFinite(size)) return "";
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const response = await fetch(src);
      if (!response.ok || !response.body) {
        throw new Error("Failed to download file");
      }

      const contentLengthHeader = response.headers.get("Content-Length");
      const total = contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : filesize || 0;

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setDownloadProgress(1);
          break;
        }
        if (value) {
          const chunk = value as Uint8Array;
          chunks.push(chunk);
          received += chunk.byteLength;

          if (total > 0) {
            setDownloadProgress(Math.min(received / total, 0.99)); // smooth a bit
          }
        }
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: mimeType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = prettyName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setIsDownloading(false);
      setIsDownloaded(true);
      setDownloadProgress(1);
    } catch (e) {
      console.error(e);
      setIsDownloading(false);
      setIsDownloaded(false);
      setDownloadProgress(0);
    }
  };

  const circleRadius = 0.45 * 36;
  const circumference = 2 * Math.PI * circleRadius;

  return (
    <div
      dir="ltr"
      className="w-3xs rounded-2xl border border-primary/5 bg-primary/5 px-3 py-3 flex items-center gap-3"
    >
      <button
        type="button"
        onClick={handleDownload}
        className="relative flex items-center justify-center rounded-full outline-none border-[1.5px] border-primary/10 hover:bg-primary/3 cursor-pointer text-primary/60 w-9 h-9 disabled:opacity-60"
        disabled={isDownloading}
      >
        {isDownloading && (
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
              strokeDashoffset={
                (1 - Math.min(downloadProgress, 1)) * circumference
              }
              strokeLinecap="round"
            />
          </svg>
        )}
        <DownloadIcon className="w-5 h-5 relative z-10 stroke-1" />
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[13px] font-medium truncate max-w-[150px]">
              {prettyName}
            </span>
            <span className="text-[11px] text-primary/70">
              {formatFileSize(filesize)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-primary">
          {isDownloading
            ? `${t("general.downloading")} ${Math.floor(
                Math.min(downloadProgress, 1) * 100,
              )}%`
            : t("general.tap_to_download")}
        </div>
      </div>
    </div>
  );
};

/* -------------------- MAIN MESSAGE COMPONENT -------------------- */

// ──────────────────────────────────────────────────────────────────────
// Shared inline-video preview coordinator.
//
// Only the single most-visible video post may auto-preview on view. A post
// is measured as the fraction of its media box that sits inside the "view
// band": the region between the header/pinned-bar bottom and the top of the
// post input footer (`--chat-header-height` + `--pinned-bar-height` at the
// top, `--chat-footer-height` at the bottom). The post with the largest
// such fraction is the leader; the preview starts only when the leader
// keeps more than 50% of itself in the band while the view stays idle for
// ~2s, and stops the previous leader.
// ──────────────────────────────────────────────────────────────────────

type VideoPreviewReg = {
  el: HTMLElement;
  controls: { start: () => void; stop: () => void };
};

const videoPreviewRegistry = new Set<VideoPreviewReg>();

let videoPreviewObserver: IntersectionObserver | null = null;
let videoPreviewBound = false;
let videoPreviewTick = 0;
let videoPreviewOwner: VideoPreviewReg | null = null;
let videoPreviewTimer: ReturnType<typeof setTimeout> | null = null;
let videoPreviewPending = false;

const readViewBandRect = (): { top: number; bottom: number } | null => {
  if (typeof window === "undefined") return null;
  const styles = getComputedStyle(document.documentElement);
  const toPx = (name: string) => {
    const n = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: toPx("--chat-header-height") + toPx("--pinned-bar-height"),
    bottom: window.innerHeight - toPx("--chat-footer-height"),
  };
};

// Fraction of the media box that is visible inside the view band.
const readBandFraction = (reg: VideoPreviewReg): number => {
  const band = readViewBandRect();
  if (!band) return 0;
  const rect = reg.el.getBoundingClientRect();
  const top = Math.max(rect.top, band.top);
  const bottom = Math.min(rect.bottom, band.bottom);
  if (bottom <= top || rect.height <= 0) return 0;
  return (bottom - top) / rect.height;
};

const onVideoPreviewScroll = () => {
  if (videoPreviewTimer) {
    clearTimeout(videoPreviewTimer);
    videoPreviewTimer = null;
  }
  videoPreviewPending = false;
  scheduleVideoPreviewRecompute();
};

const scheduleVideoPreviewRecompute = () => {
  if (videoPreviewTick) return;
  videoPreviewTick = window.requestAnimationFrame(() => {
    videoPreviewTick = 0;
    recomputeVideoPreviews();
  });
};

const recomputeVideoPreviews = () => {
  if (videoPreviewRegistry.size === 0) {
    if (videoPreviewTimer) {
      clearTimeout(videoPreviewTimer);
      videoPreviewTimer = null;
    }
    return;
  }

  let leader: VideoPreviewReg | null = null;
  let best = 0;
  for (const reg of videoPreviewRegistry) {
    const frac = readBandFraction(reg);
    if (frac > best) {
      best = frac;
      leader = reg;
    }
  }

  if (leader && best > 0.5 && leader !== videoPreviewOwner) {
    if (videoPreviewPending) {
      // The 2s idle window has elapsed; the leader is still the top post.
      videoPreviewPending = false;
      videoPreviewOwner = leader;
      leader.controls.start();
    } else if (!videoPreviewTimer) {
      videoPreviewTimer = setTimeout(() => {
        videoPreviewTimer = null;
        videoPreviewPending = true;
        recomputeVideoPreviews();
      }, 2000);
    }
  } else if (videoPreviewOwner && (!leader || best <= 0.5)) {
    // The leader lost the top spot or dropped below 50% – stop it.
    videoPreviewOwner.controls.stop();
    videoPreviewOwner = null;
    videoPreviewPending = false;
    if (videoPreviewTimer) {
      clearTimeout(videoPreviewTimer);
      videoPreviewTimer = null;
    }
  }
};

const registerVideoPreview = (reg: VideoPreviewReg) => {
  videoPreviewRegistry.add(reg);
  if (!videoPreviewObserver) {
    videoPreviewObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scheduleVideoPreviewRecompute();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
  }
  videoPreviewObserver.observe(reg.el);
  if (!videoPreviewBound) {
    videoPreviewBound = true;
    document.addEventListener("scroll", onVideoPreviewScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", scheduleVideoPreviewRecompute);
  }
  scheduleVideoPreviewRecompute();
};

const unregisterVideoPreview = (reg: VideoPreviewReg) => {
  videoPreviewRegistry.delete(reg);
  videoPreviewObserver?.unobserve(reg.el);
  if (videoPreviewOwner === reg) {
    reg.controls.stop();
    videoPreviewOwner = null;
    videoPreviewPending = false;
  }
  scheduleVideoPreviewRecompute();
};

const Post = memo(
  function Post({
    post,
    can_pin_post = false,
    can_edit_post = false,
    can_delete_post = false,
    can_copy_text = false,
    pinned = false,
    highlighted = false,
    onDelete,
    onDeleteError,
    onPin,
    onEdit,
    onRetry,
  }: PostProps) {
    const t = useTranslations();

    const { id, content, createdAt, views, reactions, type, media } = post;
    const postStatus = post._status;

    const hasMedia = media != null && type !== "text";

    // Local state so UI updates immediately for reactions + views
    const [localReactions, setLocalReactions] = useState(
      reactions ?? [], // <- defensive default
    );
    const [localViews, setLocalViews] = useState<number>(Number(views || "0"));

    // Emoji whose reaction request failed, so the user can retry it
    const [failedReaction, setFailedReaction] = useState<string | null>(null);

    // Tracks duplicate view *inside one mounted instance*
    const hasSentViewRef = useRef(false);

    // For video posts: inline thumbnail + segmented silent preview + modal playback
    const [inlineVideoReady, setInlineVideoReady] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogVideoState, setDialogVideoState] = useState<
      "loading" | "ready" | "buffering"
    >("loading");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
    const mediaBoxRef = useRef<HTMLDivElement | null>(null);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdTriggeredRef = useRef(false);
    const dialogOpenRef = useRef(false);
    const isPreviewingRef = useRef(false);
    const segmentStartsRef = useRef<number[]>([]);
    const segmentIndexRef = useRef(0);
    // Live controls so the shared preview leader always calls the latest
    // render's start/stop handlers.
    const previewControlsRef = useRef({ start: () => {}, stop: () => {} });

    // 2s per segment, at most 5 segments => at most 10s of preview, from
    // random parts of the clip arranged in ascending (start -> end) order.
    const PREVIEW_SEGMENT_MS = 2000;

    const buildPreviewSegments = (v: HTMLVideoElement) => {
      const dur = v.duration;
      if (!Number.isFinite(dur) || dur <= 0) {
        segmentStartsRef.current = [];
        return;
      }
      const SEG = PREVIEW_SEGMENT_MS / 1000;
      const maxSegments = Math.min(5, Math.max(1, Math.floor(dur / SEG)));
      const candidates: number[] = [];
      for (let t = 0; t + SEG <= dur; t += SEG * 2) candidates.push(t);
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      segmentStartsRef.current =
        maxSegments === 1 && candidates.length === 0
          ? [0]
          : candidates.slice(0, maxSegments).sort((a, b) => a - b);
    };

    // Drive the loop across the random 2s segments in ascending order.
    const handlePreviewTimeUpdate = () => {
      const v = inlineVideoRef.current;
      if (!v || !isPreviewingRef.current) return;
      const segs = segmentStartsRef.current;
      if (segs.length === 0) return;
      const SEG = PREVIEW_SEGMENT_MS / 1000;
      if (v.currentTime >= segs[segmentIndexRef.current] + SEG - 0.05) {
        segmentIndexRef.current += 1;
        if (segmentIndexRef.current >= segs.length) {
          segmentIndexRef.current = 0;
          buildPreviewSegments(v);
        }
        const next = segmentStartsRef.current[segmentIndexRef.current];
        if (next !== undefined) {
          try {
            v.currentTime = next;
          } catch {
            // ignore seek errors
          }
        }
      }
    };

    const getCount = (emoji: string) =>
      (localReactions ?? []).find(
        (r: { emoji: string; count: number }) => r.emoji === emoji,
      )?.count ?? 0;

    // Move a single emoji count by `delta`, dropping it when it reaches zero
    const bumpReaction = (emoji: string, delta: number) =>
      setLocalReactions((prev) => {
        const safePrev = prev ?? [];
        const existing = safePrev.find((r) => r.emoji === emoji);
        if (existing) {
          return safePrev
            .map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + delta } : r,
            )
            .filter((r) => r.count > 0);
        }
        if (delta <= 0) return safePrev;
        return [...safePrev, { emoji, count: delta }];
      });

    const handleReact = async (emoji: string) => {
      // optimistic reaction update
      setFailedReaction(null);
      bumpReaction(emoji, 1);

      try {
        await addReaction(id, emoji);
      } catch (err) {
        // The server never recorded the reaction, so undo the optimistic bump
        // and surface a retry instead of leaving the count drifting.
        console.error("Failed to send reaction", err);
        bumpReaction(emoji, -1);
        setFailedReaction(emoji);
      }
    };

    const handleViewed = async () => {
      if (hasSentViewRef.current) return;

      const storageKey = `message_viewed_${id}`;

      if (typeof window !== "undefined") {
        const alreadyViewed = window.localStorage.getItem(storageKey);
        if (alreadyViewed === "1") {
          hasSentViewRef.current = true;
          return;
        }
      }

      hasSentViewRef.current = true;

      setLocalViews((prev) => prev + 1);

      try {
        const result = await viewPost(id);
        if (result) {
          setLocalViews(Number(result.views));
        }
        // Persist the marker only after the server recorded the view. A failed
        // request leaves no marker, so the view is retried on the next mount.
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, "1");
        }
      } catch (err) {
        console.error("Failed to send view", err);
        // Undo the optimistic count; the view retries on the next mount because
        // no marker was written.
        setLocalViews((prev) => Math.max(0, prev - 1));
      }
    };

    useEffect(() => {
      handleViewed();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const normalizedReactions = (localReactions ?? []).filter(
      (r: { emoji: string; count: number }) => getCount(r.emoji) > 0,
    );

    // Seek the inline video to the very first frames so browsers paint a
    // thumbnail frame even though only metadata is preloaded.
    const showFirstFrame = (v: HTMLVideoElement) => {
      if (v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0) {
        try {
          if (Math.abs(v.currentTime - 0.05) > 0.001) v.currentTime = 0.05;
        } catch {
          // ignore seek errors
        }
      }
    };

    // Start the silent segmented preview on the post thumbnail (long-press or
    // the shared view-leader manager). Never while the modal is open.
    const startPreview = () => {
      const v = inlineVideoRef.current;
      if (!v || dialogOpenRef.current || isPreviewingRef.current) return;
      v.muted = true;
      v.loop = true;
      if (segmentStartsRef.current.length === 0) buildPreviewSegments(v);
      segmentIndexRef.current = 0;
      isPreviewingRef.current = true;
      const first = segmentStartsRef.current[0];
      if (first !== undefined && Math.abs(v.currentTime - first) > 0.001) {
        try {
          v.currentTime = first;
        } catch {
          // ignore seek errors
        }
      }
      const result = v.play();
      if (result) result.catch(() => {});
    };

    // Pause the preview and restore the thumbnail frame.
    const stopPreview = () => {
      const v = inlineVideoRef.current;
      if (!v) return;
      isPreviewingRef.current = false;
      v.pause();
      showFirstFrame(v);
    };

    // Expose the latest handlers to the shared view-leader manager.
    useEffect(() => {
      previewControlsRef.current.start = startPreview;
      previewControlsRef.current.stop = stopPreview;
    });

    // Long-press: start the preview instead of opening the modal.
    const handleHoldStart = () => {
      holdTriggeredRef.current = false;
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        holdTriggeredRef.current = true;
        startPreview();
      }, 450);
    };

    const handleHoldEnd = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    // Short press opens the modal; a completed long-press is swallowed.
    const handleMediaClick = () => {
      if (holdTriggeredRef.current) {
        holdTriggeredRef.current = false;
        return;
      }
      dialogOpenRef.current = true;
      stopPreview();
      setDialogOpen(true);
    };

    // Register with the shared leader so only the single most-visible (>50%)
    // video post auto-previews while the view is idle.
    useEffect(() => {
      if (type !== "video") return;
      const el = mediaBoxRef.current;
      if (!el) return;
      const reg: VideoPreviewReg = { el, controls: previewControlsRef.current };
      registerVideoPreview(reg);
      return () => {
        unregisterVideoPreview(reg);
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
      };
    }, [type]);

    const renderMedia = () => {
      if (!hasMedia || !media) return null;

      // Check if media is an array (multiple images)
      if (Array.isArray(media) && media.length > 0) {
        const normalizedMedia = media.map(
          (item: { url: string; width?: number; height?: number }) => ({
            url: normalizeMediaUrl(item.url),
            width: item.width || 0,
            height: item.height || 0,
          }),
        );
        return <ImageSlider media={normalizedMedia} content={content} />;
      }

      const src = normalizeMediaUrl(media.url);

      if (!src) return null;

      if (type === "image") {
        const aspectRatio =
          "width" in media && media["width"] && media["height"]
            ? media["width"] / media["height"]
            : 16 / 9;

        return (
          <Dialog>
            <DialogTrigger className="outline-none">
              <div
                className="relative w-full max-w-2xs max-h-[960px] overflow-hidden border border-secondary/5 cursor-pointer"
                style={{ aspectRatio }}
              >
                <SafeImage
                  src={src}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 80vw, 320px"
                  loading="lazy"
                  className="object-cover p-1"
                />
              </div>
            </DialogTrigger>
            <DialogContent>
              <div
                className="relative w-full min-w-sm max-w-xl max-h-[560px] overflow-hidden backdrop-blur-3xl p-1 border border-secondary/5 bg-white/50"
                style={{ aspectRatio }}
              >
                <SafeImage
                  src={src}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 80vw, 320px"
                  loading="lazy"
                  className="object-contain p-1"
                />
              </div>
            </DialogContent>
          </Dialog>
        );
      }

      if (type === "video") {
        const aspectRatio =
          "width" in media && media["width"] && media["height"]
            ? media["width"] / media["height"]
            : 16 / 9;

        return (
          <Dialog
            open={dialogOpen}
            onOpenChange={(o) => {
              dialogOpenRef.current = o;
              setDialogOpen(o);
              if (!o) {
                setDialogVideoState("loading");
              } else {
                stopPreview();
              }
            }}
          >
            <div
              ref={mediaBoxRef}
              role="button"
              aria-label={t("general.preview")}
              className="relative w-full max-w-2xs max-h-[960px] overflow-hidden border border-secondary/5 cursor-pointer select-none touch-manipulation [-webkit-touch-callout:none]"
              style={{ aspectRatio }}
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerLeave={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              onContextMenu={(e) => e.preventDefault()}
              onClick={handleMediaClick}
            >
              <video
                ref={inlineVideoRef}
                src={src}
                preload="metadata"
                muted
                loop
                playsInline
                disablePictureInPicture
                controlsList="nodownload noplaybackrate"
                onLoadedMetadata={(e) => showFirstFrame(e.currentTarget)}
                onSeeked={() => setInlineVideoReady(true)}
                onLoadedData={() => setInlineVideoReady(true)}
                onCanPlay={() => setInlineVideoReady(true)}
                onError={() => setInlineVideoReady(true)}
                onTimeUpdate={handlePreviewTimeUpdate}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover p-1 outline-none"
              />

              {!inlineVideoReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader className="size-10 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
                </div>
              )}

              <div
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center text-white/60 transition-opacity",
                  !inlineVideoReady && "opacity-0",
                )}
              >
                <PlayIcon className="stroke-1 rounded-full bg-black/10 backdrop-blur-sm border-[1.5px] border-white/20 p-2 size-12" />
              </div>
            </div>
            <DialogContent>
              <div className="relative flex items-center justify-center w-[calc(100vw-70px)] sm:w-fit overflow-hidden backdrop-blur-3xl border border-secondary/5 bg-white/50">
                {dialogVideoState !== "ready" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader className="size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
                  </div>
                )}
                <video
                  src={src}
                  controls
                  autoPlay
                  playsInline
                  onLoadedData={() => setDialogVideoState("ready")}
                  onCanPlay={() => setDialogVideoState("ready")}
                  onWaiting={() => setDialogVideoState("buffering")}
                  onStalled={() => setDialogVideoState("buffering")}
                  onPlaying={() => setDialogVideoState("ready")}
                  onError={() => setDialogVideoState("ready")}
                  className={cn(
                    "block w-full h-auto max-h-[calc(100dvh-70px)] object-contain p-1",
                    "sm:max-h-[85vh] sm:w-auto",
                    dialogVideoState !== "ready" && "opacity-0",
                  )}
                />
              </div>
            </DialogContent>
          </Dialog>
        );
      }

      if (type === "voice") {
        return (
          <VoicePlayer
            src={src}
            storedDurationMs={"duration" in media ? media["duration"] : null}
          />
        );
      }

      if (type === "file") {
        const fileMedia = "filename" in media ? media : null;
        return (
          <FileDownload
            src={src}
            filename={fileMedia?.filename ?? null}
            filesize={fileMedia?.filesize ?? null}
            mimeType={fileMedia?.mimeType ?? null}
          />
        );
      }

      return null;
    };

    const handleDelete = async () => {
      // optimistic removal from parent list
      if (onDelete) {
        onDelete(id);
      }

      try {
        await deletePost(id);
      } catch (err) {
        console.error("Failed to delete message", err);
        onDeleteError?.(err);
        // NOTE: you could add rollback logic here if needed
      }
    };

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>
            <div className="flex gap-x-2 items-end cursor-pointer mt-5">
              <Stories size={35} />

              <div
                className={cn(
                  "flex flex-col gap-y-1.5",
                  postStatus === "sending" && "animate-pulse opacity-60",
                )}
              >
                {pinned && (
                  <div
                    className={cn(
                      "flex items-center gap-x-1.5 text-[11px] opacity-60 pl-1",
                      highlighted && "text-primary opacity-100",
                    )}
                  >
                    <PinIcon className="size-3.5 stroke-[1.5px] rotate-45" />
                    <span>{t("general.pinned_to_top")}</span>
                  </div>
                )}

                {hasMedia && (
                  <div
                    className={cn(
                      "relative",
                      highlighted && "rounded-2xl ring-2 ring-primary/5 bg-primary/3",
                    )}
                  >
                    {renderMedia()}
                  </div>
                )}

                <div
                  className={cn(
                    "rounded-2xl border border-secondary/5 bg-secondary/1 px-3.5 py-2 max-w-2xs min-w-[220px] backdrop-blur-sm bg-white/10",
                    highlighted && "ring-2 ring-primary/5 bg-primary/3 text-primary",
                  )}
                >
                  {renderSimpleMarkdown(content)}

                  {normalizedReactions.length > 0 && (
                    <div className="flex flex-wrap text-[12px] mt-2.5 ml-[-1px] gap-x-1 gap-y-1">
                      {normalizedReactions.map((r) => (
                        <Reaction
                          key={r.emoji}
                          emoji={r.emoji}
                          count={r.count}
                          onClick={() => handleReact(r.emoji)}
                        />
                      ))}
                    </div>
                  )}

                  {failedReaction && (
                    <button
                      type="button"
                      onClick={() => handleReact(failedReaction)}
                      className="flex items-center gap-x-1.5 text-[12px] mt-2 text-red-500/80 hover:text-red-500 cursor-pointer"
                    >
                      <span>{failedReaction}</span>
                      <span>{t("general.reaction_failed")}</span>
                    </button>
                  )}

                  <div className="flex justify-between items-center opacity-60 mt-1.5">
                    <div className="text-[12px]">
                      {postStatus === "sending" ? (
                        <Clock8Icon className="size-2.5 animate-spin inline" />
                      ) : (
                        <>
                          {localViews.toLocaleString()} {t("general.views")}
                        </>
                      )}
                    </div>
                    <div
                      className={cn(pally.className, "text-[12px]")}
                      dir="ltr"
                    >
                      {formatTime(createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-36">
            <ContextMenuItem
              className="flex gap-x-2 py-1.5"
              onClick={() => {
                if (typeof window === "undefined") return;
                const url = new URL(window.location.href);
                url.pathname = `/posts/${id}`;
                const full = url.toString();

                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(full).catch(() => {});
                } else {
                  const textarea = document.createElement("textarea");
                  textarea.value = full;
                  textarea.style.position = "fixed";
                  textarea.style.left = "-9999px";
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand("copy");
                  } catch {
                  } finally {
                    document.body.removeChild(textarea);
                  }
                }
              }}
            >
              <div className="flex-1">{t("general.copy_post_link")} —</div>
              <BoxIcon className="stroke-[1.5px] size-4" />
            </ContextMenuItem>

            {can_copy_text && content && (
              <ContextMenuItem
                className="flex gap-x-2 py-1.5"
                onClick={() => {
                  if (!content) return;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(content).catch(() => {});
                  } else {
                    const textarea = document.createElement("textarea");
                    textarea.value = content;
                    textarea.style.position = "fixed";
                    textarea.style.left = "-9999px";
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand("copy");
                    } catch {
                    } finally {
                      document.body.removeChild(textarea);
                    }
                  }
                }}
              >
                <div className="flex-1">{t("general.copy_text")} —</div>
                <CopyIcon className="stroke-[1.5px] size-4" />
              </ContextMenuItem>
            )}

            {can_pin_post && (
              <ContextMenuItem
                className="flex gap-x-2 py-1.5"
                onClick={() => onPin?.(post)}
              >
                <div className="flex-1">
                  {pinned ? t("general.unpin") : t("general.pin_to_top")} —
                </div>
                <PinIcon className="stroke-[1.5px] size-4 rotate-45" />
              </ContextMenuItem>
            )}

            {can_edit_post && (
              <ContextMenuItem
                className="flex gap-x-2 py-1.5"
                onClick={() => onEdit?.(post)}
              >
                <div className="flex-1">{t("general.edit_post")} —</div>
                <Edit3Icon className="stroke-[1.5px] size-4" />
              </ContextMenuItem>
            )}

            {can_delete_post && (
              <ContextMenuItem
                className="flex gap-x-2 py-1.5"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <div className="flex-1">{t("general.delete_post")} —</div>
                <EraserIcon className="stroke-[1.5px] size-4" />
              </ContextMenuItem>
            )}

            {postStatus === "error" && onRetry && (
              <ContextMenuItem
                className="flex gap-x-2 py-1.5"
                onClick={() => onRetry(post)}
              >
                <div className="flex-1">{t("general.try_again")} —</div>
                <BoxIcon className="stroke-[1.5px] size-4" />
              </ContextMenuItem>
            )}
          </ContextMenuContent>

          {/* quick reactions — rounded strip floating on top of the menu */}
          <ContextMenuEmojiBar
            emojis={quickReactionEmojis}
            onSelect={(emoji) => handleReact(emoji)}
          />
        </ContextMenu>

        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          description="This Post will be Permanently deleted"
          confirmLabel="Yes, Delete It"
          cancelLabel="No, Keep It"
          onConfirm={() => void handleDelete()}
        />
      </>
    );
  },
);

export default Post;
