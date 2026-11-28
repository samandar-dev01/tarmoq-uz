// The pictures on the package and creator cards, taken from the creator's portfolio. Pure.

/** The video id in a YouTube address (watch, share, shorts or embed form), or null. */
export function youtubeId(url: string | null | undefined): string | null {
  let u: URL;
  try {
    u = new URL(url ?? "");
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null | undefined = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com") id = u.pathname === "/watch" ? u.searchParams.get("v") : /^\/(?:shorts|embed|live)\/([^/]+)/.exec(u.pathname)?.[1];
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

export type Thumb = { image: string | null; video: boolean };

type Item = { imageUrl: string | null; videoUrl: string | null };

/** An item's picture: its own, or its YouTube video's. */
function pictureOf(item: Item): string | null {
  const yt = youtubeId(item.videoUrl);
  return item.imageUrl ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
}

/** The first portfolio item with a picture; `video` when it links to a video. */
export function thumbnailOf(items: readonly Item[]): Thumb {
  for (const item of items) {
    const image = pictureOf(item);
    if (image) return { image, video: !!item.videoUrl };
  }
  return { image: null, video: items.some((i) => !!i.videoUrl) };
}

/** Up to `max` different pictures from a portfolio, in its order: the preview on a creator's card. */
export function previewsOf(items: readonly Item[], max = 3): { image: string; video: boolean }[] {
  const out: { image: string; video: boolean }[] = [];
  for (const item of items) {
    if (out.length === max) break;
    const image = pictureOf(item);
    if (image && !out.some((p) => p.image === image)) out.push({ image, video: !!item.videoUrl });
  }
  return out;
}
