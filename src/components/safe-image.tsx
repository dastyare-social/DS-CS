"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackClassName?: string;
}

function ImageLoader({ className }: { className?: string }) {
  return (
    <Loader2Icon
      className={cn(
        "animate-spin text-secondary/30",
        className,
      )}
    />
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
    return (
      <ImageLoader
        className={cn(
          useFill ? "absolute inset-0 m-auto" : "",
          fallbackClassName,
        )}
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
