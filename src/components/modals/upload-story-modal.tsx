"use client";

import { Dialog, DialogContent } from "@/components/dialog";
import { createStoryAction } from "@/lib/actions/stories";
import { presignedTransport } from "@/lib/hooks/use-media-upload";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

type UploadPhase = "idle" | "uploading" | "creating" | "done";

interface UploadStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file?: File | null;
  onStoryCreated?: () => void;
}

export default function UploadStoryModal({
  open,
  onOpenChange,
  file,
  onStoryCreated,
}: UploadStoryModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cancelledRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVideo = file?.type.startsWith("video/");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setProgress(0);
      setPhase("idle");
      setMuted(true);
      return;
    }
    setMediaLoading(true);
    setProgress(0);
    setPhase("idle");
    setMuted(true);
    cancelledRef.current = false;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setPhase("idle");
      setProgress(0);
    }
  }, [open]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = muted;
  }, [muted]);

  const handleStartUpload = useCallback(async () => {
    if (!file || phase !== "idle") return;

    cancelledRef.current = false;
    setPhase("uploading");
    setProgress(0);

    const result = await presignedTransport(file, (percent) => {
      if (!cancelledRef.current) setProgress(percent);
    });

    if (cancelledRef.current) return;

    if (result.ok) {
      setProgress(100);
      setPhase("creating");

      try {
        await createStoryAction({
          url: result.media.url,
          width: result.media.width,
          height: result.media.height,
          duration: result.media.duration,
        });
      } catch {
        // story creation failed — still show done
      }

      if (cancelledRef.current) return;

      setPhase("done");
      onStoryCreated?.();
      closeTimerRef.current = setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } else {
      setPhase("idle");
    }
  }, [file, phase, onOpenChange, onStoryCreated]);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    onOpenChange(false);
  }, [onOpenChange]);

  const borderOpacity =
    phase === "uploading"
      ? Math.max(0.1, (progress / 100) * 0.8)
      : phase === "creating" || phase === "done"
        ? 0.8
        : 0.1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <div className="relative w-full overflow-hidden flex items-center justify-center border border-secondary/5 backdrop-blur-3xl bg-white/50 aspect-9/16 min-w-xs max-w-xs">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-3 z-20 p-2 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
          >
            <XIcon className="size-5 stroke-1" />
          </button>

          {phase === "idle" && (
            <button
              type="button"
              onClick={handleStartUpload}
              className="absolute bottom-3 right-3 z-20 p-2 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
            >
              <ArrowRightIcon className="size-5 stroke-1" />
            </button>
          )}

          {(phase === "uploading" || phase === "creating" || phase === "done") && (
            <div className="absolute inset-0 z-10 bg-black/10 pointer-events-none" />
          )}

          {(phase === "uploading" || phase === "creating" || phase === "done") && (
            <div className="absolute flex flex-col justify-center items-center gap-y-2 z-10">
              <div
                className="text-white bg-white/10 backdrop-blur-xs border-2 rounded-full px-2.5 text-md transition-all duration-300"
                style={{ borderColor: `rgba(255,255,255,${borderOpacity})` }}
              >
                {phase === "uploading" && `${progress} / 100 — uploaded`}
                {phase === "creating" && "wait — creating story"}
                {phase === "done" && "done —"}
              </div>
            </div>
          )}

          {mediaLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-5">
              <div className="stroke-1 animate-spin size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
            </div>
          )}

          {preview && isVideo ? (
            <video
              ref={videoRef}
              src={preview}
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setMediaLoading(false)}
              className={cn(
                "w-full h-full object-contain",
                mediaLoading && "hidden",
                phase === "uploading" && "animate-stutter-freeze",
              )}
            />
          ) : preview ? (
            <img
              src={preview}
              alt=""
              onLoad={() => setMediaLoading(false)}
              className={cn(
                "w-full h-full object-contain",
                mediaLoading && "hidden",
              )}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
