"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackClassName?: string;
}

function BrokenFallback({
  isProfile,
  className,
  useFill,
}: {
  isProfile: boolean;
  className?: string;
  useFill: boolean;
}) {
  return (
    <div
      className={cn(
        useFill ? "absolute inset-0" : "",
        "flex items-center justify-center bg-secondary/10",
        isProfile && "rounded-full",
        className,
      )}
    >
      {isProfile ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-[40%] h-[40%] text-secondary/40"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-[30%] h-[30%] text-secondary/30"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      )}
    </div>
  );
}

export default function SafeImage({
  src,
  fallbackClassName,
  className,
  ...props
}: SafeImageProps) {
  const [error, setError] = useState(false);
  const useFill = "fill" in props;

  if (error) {
    const isProfile =
      typeof src === "string" && src.includes("profile-image");
    return (
      <BrokenFallback
        isProfile={isProfile}
        useFill={useFill}
        className={fallbackClassName}
      />
    );
  }

  return (
    <Image
      src={src}
      className={className}
      {...props}
      onError={() => setError(true)}
    />
  );
}
