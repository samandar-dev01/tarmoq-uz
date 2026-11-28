"use client";
import { useState } from "react";

/**
 * A picture from a creator's portfolio, filling its card cover. The address is the creator's own, so it may stop
 * working: then the picture takes itself away (no broken-image mark) and the quiet panel under it shows.
 */
export function CardPicture({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      // One that failed before the script arrived has no error event left to send.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setBroken(true);
      }}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-snap group-hover:scale-105"
    />
  );
}
