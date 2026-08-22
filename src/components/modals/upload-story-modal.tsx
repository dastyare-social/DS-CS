"use client";

import { Dialog, DialogContent } from "@/components/dialog";
import { streamingTransport } from "@/lib/hooks/use-media-upload";
import type { UploadResult } from "@/lib/hooks/use-media-upload";
import { ArrowRightIcon, Loader2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface UploadStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file?: File | null;
}

export default function UploadStoryModal({
  open,
  onOpenChange,
  file,
}: UploadStoryModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = file?.type.startsWith("video/");
  const uploadComplete = uploadResult !== null;
  const uploadError = uploadResult && !uploadResult.ok;

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setProgress(0);
      setUploading(false);
      setUploadResult(null);
      setMuted(true);
      return;
    }
    setMediaLoading(true);
    setProgress(0);
    setUploading(false);
    setUploadResult(null);
    setMuted(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file || !open || uploadResult) return;

    let cancelled = false;

    const doUpload = async () => {
      setUploading(true);
      const result = await streamingTransport(file, (percent) => {
        if (!cancelled) setProgress(percent);
      });
      if (!cancelled) {
        setUploadResult(result);
        setUploading(false);
      }
    };

    doUpload();

    return () => {
      cancelled = true;
    };
  }, [file, open, uploadResult]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = uploading ? 2 : 1;
  }, [uploading]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const borderOpacity = uploading
    ? Math.max(0.1, (progress / 100) * 0.8)
    : uploadComplete && uploadResult?.ok
      ? 0.8
      : 0.1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <div className="relative w-full overflow-hidden flex items-center justify-center border border-secondary/5 backdrop-blur-3xl bg-white/50 aspect-9/16 min-w-xs max-w-xs">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 z-20 p-2 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
          >
            <XIcon className="size-5 stroke-1" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="absolute bottom-3 right-3 z-20 p-2 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
          >
            {uploading ? (
              <Loader2Icon className="size-5 stroke-1 animate-spin" />
            ) : (
              <ArrowRightIcon className="size-5 stroke-1" />
            )}
          </button>

          {(uploading || (uploadComplete && uploadResult?.ok)) && (
            <div className="absolute inset-0 z-10 bg-black/10 pointer-events-none" />
          )}

          {(uploading || (uploadComplete && uploadResult?.ok)) && (
            <div className="absolute flex flex-col justify-center items-center gap-y-2 z-10">
              <div
                className="text-white bg-white/10 backdrop-blur-xs border-2 rounded-full px-2.5 text-md transition-all duration-300"
                style={{ borderColor: `rgba(255,255,255,${borderOpacity})` }}
              >
                {uploadComplete && uploadResult?.ok
                  ? "done"
                  : `${progress} / 100`}
              </div>
            </div>
          )}

          {mediaLoading && (
            <Loader2Icon className="size-12 text-primary/50 animate-spin" />
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
                uploading && "animate-stutter-2x",
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
