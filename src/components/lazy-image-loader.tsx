"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/* `img-fx` drives a WebGL shader and pulls in `three`, so it must never run
   on the server. Loaded with `ssr: false` and only mounted after `delay`, so
   a fast load costs nothing beyond the existing CSS spinner. */
const ImageGeneration = dynamic(
  () => import("img-fx").then((mod) => mod.ImageGeneration),
  { ssr: false },
);

interface LazyImageLoaderProps {
  /** Existing loader/spinner content, kept on top of the effect. */
  children?: ReactNode;
  className?: string;
  /** ms a loader must stay visible before the WebGL effect arms. */
  delay?: number;
  preset?: "pixels-organic" | "pixels-mechanic" | "sweep-gradient";
  /** Final opacity multiplier for the shader, 0..1. */
  strength?: number;
}

/**
 * Stacks a `img-fx` shader under an existing loader.
 *
 * The shader is armed only after `delay` (default 300ms), so a media element
 * that resolves quickly never allocates WebGL work. `img-fx` renders every
 * instance through one shared `THREE.WebGLRenderer`, and its rAF loop sleeps
 * when nothing is on screen, so many mounted instances stay cheap — but the
 * delay is still what keeps a feed of fast-loading media off the GPU
 * entirely.
 */
export default function LazyImageLoader({
  children,
  className,
  delay = 300,
  preset = "pixels-organic",
  strength = 0.45,
}: LazyImageLoaderProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {armed && (
        <ImageGeneration
          className="absolute inset-0"
          preset={preset}
          theme="light"
          strength={strength}
          autoReveal={false}
        >
          <div className="h-full w-full" />
        </ImageGeneration>
      )}

      <div className="relative z-10 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}