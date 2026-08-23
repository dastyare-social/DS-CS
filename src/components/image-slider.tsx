"use client";

import { useState, useEffect } from "react";
import SafeImage from "./safe-image";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
import Loader from "./loader";
import { cn } from "@/lib/utils";

type MediaItem = {
  url: string;
  width: number;
  height: number;
};

type ImageSliderProps = {
  media: MediaItem[];
  content?: string | null;
};

export default function ImageSlider({ media, content }: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(true);

  const currentMedia = media[currentIndex];
  const aspectRatio = currentMedia?.width && currentMedia?.height
    ? currentMedia.width / currentMedia.height
    : 16 / 9;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  // Click right/left halves to navigate — same pattern as stories.tsx
  const handleSlideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (media.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 2) {
      handlePrevious();
    } else {
      handleNext();
    }
  };

  // Auto-advance with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setMediaLoading(true);
  }, [currentIndex]);

  if (!media || media.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger className="outline-none">
        <div
          className="relative w-full max-w-2xs max-h-[960px] overflow-hidden border border-secondary/5 cursor-pointer select-none"
          style={{ aspectRatio }}
        >
          <SafeImage
            src={currentMedia.url}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 768px) 80vw, 320px"
            loading="lazy"
            onLoad={() => setMediaLoading(false)}
            className={cn("object-cover p-1", mediaLoading && "opacity-0")}
          />

          {/* Loader while media loads */}
          {mediaLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="size-10 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
            </div>
          )}

          {/* Slide counter — same style as "wait — creating story" pill, thinner border */}
          {media.length > 1 && (
            <div className="absolute top-3 right-3 text-white bg-white/10 backdrop-blur-xs border border-white/40 rounded-full px-2.5 py-0.5 text-xs leading-none">
              {currentIndex + 1} / {media.length}
            </div>
          )}
        </div>
      </DialogTrigger>
      <DialogContent>
        <div
          onClick={handleSlideClick}
          className="relative w-full min-w-sm max-w-xl max-h-[560px] overflow-hidden backdrop-blur-3xl p-1 border border-secondary/5 bg-white/50 cursor-pointer select-none"
          style={{ aspectRatio }}
        >
          <SafeImage
            src={currentMedia.url}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 768px) 80vw, 320px"
            loading="lazy"
            onLoad={() => setMediaLoading(false)}
            className={cn("object-contain p-1", mediaLoading && "opacity-0")}
          />

          {/* Loader while media loads */}
          {mediaLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
            </div>
          )}

          {/* Bottom dots — glassy pills, no text */}
          {media.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-x-1.5 z-10">
              {media.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-6 h-3 rounded-full border backdrop-blur-xs transition-all duration-200",
                    index === currentIndex
                      ? "bg-white/80 border-white/60"
                      : "bg-white/10 border-white/40",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
