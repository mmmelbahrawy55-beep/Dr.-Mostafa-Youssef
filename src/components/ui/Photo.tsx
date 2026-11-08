import { useState, type ImgHTMLAttributes } from "react";
import { fallbackImage } from "../../lib/images";
import { cn } from "../../lib/utils";

interface PhotoProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  wrapperClassName?: string;
  aspect?: string;
  overlay?: boolean;
}

/**
 * Image with a branded local fallback + optional gradient overlay.
 * Remote stock images can fail (offline / blocked host); the site never breaks.
 */
export function Photo({
  src,
  alt,
  className,
  wrapperClassName,
  aspect,
  overlay = false,
  loading = "lazy",
  ...rest
}: PhotoProps) {
  const [failed, setFailed] = useState(false);
  const source = !src || failed ? fallbackImage : src;

  return (
    <span className={cn("block overflow-hidden bg-ink-2", !wrapperClassName && "relative", aspect, wrapperClassName)}>
      <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] to-transparent" aria-hidden />
      <img
        src={source}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        className={cn("relative size-full object-cover", className)}
        {...rest}
      />
      {overlay && (
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" aria-hidden />
      )}
    </span>
  );
}
