"use client";

import { Dialog, DialogContent } from "@/components/dialog";
import { ArrowRightIcon, XIcon } from "lucide-react";
import Loader from "@/components/loader";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    setMediaLoading(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <div className="relative w-full overflow-hidden flex items-center justify-center border border-secondary/5 backdrop-blur-3xl bg-white/50 aspect-9/16 min-w-xs max-w-xs">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 p-2 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
          >
            <XIcon className="size-5 stroke-1" />
          </button>

          <button
            type="button"
            className="absolute bottom-3 right-3 p-2 hover:cursor-pointer rounded-full bg-black/10 backdrop-blur-xs border border-white/10 hover:bg-black/20 transition-colors text-white"
          >
            <ArrowRightIcon className="size-5 stroke-1" />
          </button>

          <div className="absolute flex flex-col justify-center items-center gap-y-2">
            <div className="text-white bg-white/10 backdrop-blur-xs border-white/10 border-2 rounded-full px-2.5 text-md">
              37 / 100 — uploaded
            </div>
          </div>

          {preview && file?.type.startsWith("video/") ? (
            <video
              src={preview}
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setMediaLoading(false)}
              className={cn(
                "w-full h-full object-contain",
                mediaLoading && "hidden",
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

          {/* <div className="absolute bg-black/100 w-full h-full" /> */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
