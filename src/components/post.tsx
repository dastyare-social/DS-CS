"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import Image from "next/image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./context-menu";
import Stories from "./stories";
import Reaction from "./reaction";
import type { PostWithReactions } from "@/lib/api/posts";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import { addReaction, deletePost, viewPost } from "@/lib/actions/posts";
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  BoxIcon,
  EraserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { reactionEmojis } from "@/config/constants";
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
    "$1//$3"
  );

  return url;
};

type PostProps = {
  post: PostWithReactions;
  can_pin_post?: boolean;
  can_edit_post?: boolean;
  can_delete_post?: boolean;
  // NEW: allow parent to remove from list optimistically
  onDelete?: (id: string) => void;
};

/* -------------------- VOICE PLAYER COMPONENT -------------------- */

type VoicePlayerProps = {
  src: string;
};

const VoicePlayer = ({ src }: VoicePlayerProps) => {
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
            safeVisible > prev ? safeVisible : prev
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
    []
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
                    Math.min(downloadProgress, 1) * 100
                  )}%`
                : t("tap_to_download")
              : isPlaying
                ? ""
                : ""}
          </span>
          <span>
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
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
      className="w-3xs rounded-2xl border border-primary/5 bg-primary/5 px-3 py-2 flex items-center gap-3"
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
                Math.min(downloadProgress, 1) * 100
              )}%`
            : t("general.tap_to_download")}
        </div>
      </div>
    </div>
  );
};

/* -------------------- MAIN MESSAGE COMPONENT -------------------- */

const Post = memo(({
  post,
  can_pin_post = false,
  can_edit_post = false,
  can_delete_post = false,
  onDelete,
}: PostProps) => {
  const t = useTranslations();

  const { id, content, createdAt, views, reactions, type, media } = post;

  const hasMedia = media != null && type !== "text";

  // Local state so UI updates immediately for reactions + views
  const [localReactions, setLocalReactions] = useState(
    reactions ?? [] // <- defensive default
  );
  const [localViews, setLocalViews] = useState<number>(Number(views || "0"));

  // Tracks duplicate view *inside one mounted instance*
  const hasSentViewRef = useRef(false);

  // For video thumbnail
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  const getCount = (emoji: string) =>
    (localReactions ?? []).find((r: any) => r.emoji === emoji)?.count ?? 0;

  const handleReact = async (emoji: string) => {
    // optimistic reaction update
    setLocalReactions((prev: any[] | null) => {
      const safePrev = prev ?? [];
      const existing = safePrev.find((r: any) => r.emoji === emoji);
      if (existing) {
        return safePrev.map((r: any) =>
          r.emoji === emoji ? { ...r, count: r.count + 1 } : r
        );
      }
      return [...safePrev, { emoji, count: 1 }];
    });

    try {
      await addReaction(id, emoji);
    } catch (err) {
      console.error("Failed to send reaction", err);
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
      window.localStorage.setItem(storageKey, "1");
    }

    hasSentViewRef.current = true;

    setLocalViews((prev) => prev + 1);

    try {
      const result = await viewPost(id);
      if (result) {
        setLocalViews(Number(result.views));
      }
    } catch (err) {
      console.error("Failed to send view", err);
    }
  };

  useEffect(() => {
    handleViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate a random-frame thumbnail for video
  useEffect(() => {
    if (!hasMedia || !media || type !== "video") return;
    if (typeof window === "undefined") return;

    const video = document.createElement("video");
    hiddenVideoRef.current = video;
    video.src = normalizeMediaUrl(media.url);
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    const handleLoadedMetadata = () => {
      const duration = video.duration || 0;
      if (!duration || Number.isNaN(duration)) return;

      const targetTime = Math.random() * duration;
      const seekHandler = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg");
          setVideoThumb(dataUrl);
        } catch (e) {
          console.error("Failed to capture video frame", e);
        } finally {
          video.removeEventListener("seeked", seekHandler);
        }
      };

      video.currentTime = targetTime;
      video.addEventListener("seeked", seekHandler);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      hiddenVideoRef.current = null;
    };
  }, [hasMedia, media, type]);

  const normalizedReactions = reactionEmojis.map((emoji) => ({
    emoji,
    count: getCount(emoji),
  }));

  const renderMedia = () => {
    if (!hasMedia || !media) return null;

    const src = normalizeMediaUrl(media.url);

    if (!src) return null;

    if (type === "image") {
      const aspectRatio = post.media["width"] && post.media["height"]
        ? post.media["width"] / post.media["height"]
        : 16 / 9;

      return (
        <Dialog>
          <DialogTrigger className="outline-none">
            <div
              className="relative w-full max-w-2xs max-h-[960px] overflow-hidden border border-secondary/5 cursor-pointer"
              style={{ aspectRatio }}
            >
              <Image
                src={src}
                alt={content || "image_message"}
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
              <Image
                src={src}
                alt={content || "image_message"}
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
      const aspectRatio = post.media["width"] && post.media["height"]
        ? post.media["width"] / post.media["height"]
        : 16 / 9;

      return (
        <Dialog>
          <DialogTrigger className="outline-none">
            <div
              className="relative w-full max-w-2xs max-h-[960px] overflow-hidden border border-secondary/5 cursor-pointer"
              style={{ aspectRatio }}
            >
              {videoThumb && (
                <>
                  <Image
                    src={videoThumb}
                    unoptimized
                    alt={content || "video_thumbnail"}
                    fill
                    className="absolute inset-0 h-full w-full object-cover p-1"
                  />

                  <div className="absolute inset-0 flex items-center justify-center text-white/60">
                    <PlayIcon className="stroke-1 rounded-full bg-black/10 backdrop-blur-sm border-[1.5px] border-white/20 p-2 size-12 hover:scale-110" />
                  </div>
                </>
              )}
            </div>
          </DialogTrigger>
          {videoThumb && (
            <DialogContent>
              <div
                className="overflow-hidden backdrop-blur-3xl border border-secondary/5 bg-white/50"
                style={{ aspectRatio }}
              >
                <video
                  src={src}
                  controls
                  autoPlay
                  className="h-full w-full p-1"
                />
              </div>
            </DialogContent>
          )}
        </Dialog>
      );
    }

    if (type === "voice") {
      return <VoicePlayer src={src} />;
    }

    if (type === "file") {
      return (
        <FileDownload
          src={src}
          filename={media.filename}
          filesize={media.filesize}
          mimeType={media.mimeType}
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
      // NOTE: you could add rollback logic here if needed
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="flex gap-x-2 items-end cursor-pointer mt-5">
          <Stories size={35} />

          <div className="flex flex-col gap-y-2.5">
            {renderMedia()}

            <div className="rounded-2xl border border-secondary/5 bg-secondary/1 px-3.5 py-2 max-w-2xs min-w-[220px] backdrop-blur-sm bg-white/10">
              {renderSimpleMarkdown(content)}

              <div className="flex text-[12px] mt-2.5 ml-[-1px] gap-x-1">
                {normalizedReactions.map((r) => (
                  <Reaction
                    key={r.emoji}
                    emoji={r.emoji}
                    count={r.count}
                    onClick={() => handleReact(r.emoji)}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center opacity-60 mt-1.5">
                <div className="text-[12px]">
                  {localViews.toLocaleString()} {t("general.views")}
                </div>
                <div className={cn(pally.className, "text-[12px]")} dir="ltr">
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

        {can_pin_post && (
          <ContextMenuItem
            className="flex gap-x-2 py-1.5"
            onClick={() => console.log("deleted")}
          >
            <div className="flex-1">Pin To Top —</div>
            {/* <EraserIcon className="stroke-[1.5px] size-4" /> */}
          </ContextMenuItem>
        )}

        {can_edit_post && (
          <ContextMenuItem
            className="flex gap-x-2 py-1.5"
            onClick={() => console.log("deleted")}
          >
            <div className="flex-1">Edit Post —</div>
            {/* <EraserIcon className="stroke-[1.5px] size-4" /> */}
          </ContextMenuItem>
        )}

        {can_delete_post && (
          <ContextMenuItem
            className="flex gap-x-2 py-1.5"
            onClick={handleDelete}
          >
            <div className="flex-1">{t("general.delete_post")} —</div>
            <EraserIcon className="stroke-[1.5px] size-4" />
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

export default Post;
