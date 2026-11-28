// The picture on a package card, taken from the creator's portfolio. Pure.

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

/** The first portfolio item with a picture (its own, or its YouTube video's); `video` when it links to a video. */
export function thumbnailOf(items: readonly { imageUrl: string | null; videoUrl: string | null }[]): Thumb {
  for (const item of items) {
    const yt = youtubeId(item.videoUrl);
    const image = item.imageUrl ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null);
    if (image) return { image, video: !!item.videoUrl };
  }
  return { image: null, video: items.some((i) => !!i.videoUrl) };
}
