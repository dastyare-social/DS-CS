"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";
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
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    const threshold = 50;

    if (diff > threshold) {
      handlePrevious();
      setIsDragging(false);
    } else if (diff < -threshold) {
      handleNext();
      setIsDragging(false);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX;
    const threshold = 50;

    if (diff > threshold) {
      handlePrevious();
      setIsDragging(false);
    } else if (diff < -threshold) {
      handleNext();
      setIsDragging(false);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
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

  if (!media || media.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger className="outline-none">
        <div
          ref={containerRef}
          className="relative w-full max-w-2xs max-h-[960px] overflow-hidden border border-secondary/5 cursor-pointer select-none"
          style={{ aspectRatio }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={currentMedia.url}
            alt={content || "image_message"}
            fill
            unoptimized
            sizes="(max-width: 768px) 80vw, 320px"
            loading="lazy"
            className="object-cover p-1"
          />

          {/* Dots indicator */}
          {media.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {media.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-200",
                    index === currentIndex
                      ? "bg-white/80"
                      : "bg-white/40"
                  )}
                />
              ))}
            </div>
          )}

          {/* Slide counter */}
          {media.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
              {currentIndex + 1}/{media.length}
            </div>
          )}
        </div>
      </DialogTrigger>
      <DialogContent>
        <div
          className="relative w-full min-w-sm max-w-xl max-h-[560px] overflow-hidden backdrop-blur-3xl p-1 border border-secondary/5 bg-white/50"
          style={{ aspectRatio }}
        >
          <Image
            src={currentMedia.url}
            alt={content || "image_message"}
            fill
            unoptimized
            sizes="(max-width: 768px) 80vw, 320px"
            loading="lazy"
            className="object-contain p-1"
          />

          {/* Navigation arrows in dialog */}
          {media.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-2 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-2 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Dots indicator in dialog */}
          {media.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {media.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-200",
                    index === currentIndex
                      ? "bg-black/80"
                      : "bg-black/40"
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
