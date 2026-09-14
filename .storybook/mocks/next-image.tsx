// Storybook-only mock for `next/image`. Aliased in .storybook/main.ts so
// stories render a plain <img> instead of requiring Next's image pipeline.
import React from "react";

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  unoptimized?: boolean;
  priority?: boolean;
  quality?: number | string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
};

const Image = React.forwardRef<HTMLImageElement, MockImageProps>(
  function Image(
    {
      fill,
      unoptimized: _unoptimized,
      priority: _priority,
      quality: _quality,
      onLoad,
      onError,
      style,
      className,
      sizes,
      alt,
      ...rest
    },
    ref,
  ) {
    const resolvedStyle: React.CSSProperties = fill
      ? {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          ...style,
        }
      : style;

    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        ref={ref}
        alt={alt ?? ""}
        className={className}
        sizes={sizes}
        style={resolvedStyle}
        onLoad={onLoad}
        onError={onError}
        {...rest}
      />
    );
  },
);

export default Image;

export type { MockImageProps as ImageProps };