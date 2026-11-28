import { photoSrc, photoSrcSet, type HomePhoto } from "@/lib/homeImages";

/**
 * A home page photograph that fills its box (give the box a size or an aspect ratio, `relative` and `overflow-hidden`).
 * Decorative: the words beside or on it carry the meaning, so it has no alternative text.
 * `sizes` is how wide the box is, so the browser picks the smaller file where that is enough.
 */
export function Photo({ photo, sizes, priority, lazy = true, className = "" }: { photo: HomePhoto; sizes: string; priority?: boolean; lazy?: boolean; className?: string }) {
  const [, wide] = photo.widths;
  const [w, h] = photo.ratio.split(":").map(Number) as [number, number];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoSrc(photo, wide)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      width={wide}
      height={Math.round((wide * h) / w)}
      alt=""
      loading={priority || !lazy ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`absolute inset-0 h-full w-full object-cover ${className}`.trim()}
    />
  );
}
