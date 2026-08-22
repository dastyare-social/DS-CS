"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Loader from "./loader";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackClassName?: string;
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
      <Loader
        className={
          fallbackClassName ??
          cn(
            useFill ? "absolute inset-0 m-auto" : "",
            "size-12 border-1 border-primary/5 text-primary/50 p-2 rounded-full",
          )
        }
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
