// The home page's own photographs, kept in public/images/home as `<name>-<width>.webp`. Pure.
//
// They are stock photographs from Pexels (free for commercial use, no credit required: https://www.pexels.com/license/),
// cropped and compressed here. `source` is the photo's number: https://www.pexels.com/photo/<source>/
// They show the kind of work, never a creator of this site: do not put a creator's name, rating or price on them.
// Each is used in one place only, so the page never repeats a picture. To replace one, add the new files under a NEW
// name (browsers keep the old ones for a week, see next.config.mjs) and change the entry here.

export type HomePhoto = {
  name: string;
  source: number;
  /** The widths that exist on disk, narrow then wide. */
  widths: readonly [number, number];
  /** Width to height of both files. */
  ratio: "4:5" | "4:3";
};

const photo = (name: string, source: number, widths: readonly [number, number], ratio: HomePhoto["ratio"]): HomePhoto => ({ name, source, widths, ratio });

/** One picture for each direction, by the category's slug (src/lib/catalog.ts). */
export const CATEGORY_PHOTOS: Readonly<Record<string, HomePhoto>> = {
  "mobile-videography": photo("cat-mobile-videography", 13835575, [400, 800], "4:5"), // filming with a phone on a stabiliser
  photography: photo("cat-photography", 13444983, [400, 800], "4:5"), // a photographer shooting a model
  "video-editing": photo("cat-video-editing", 8102676, [400, 800], "4:5"), // an editing and colour desk
  drone: photo("cat-drone", 343238, [400, 800], "4:5"), // a camera drone in the air
};

/** The collage beside the headline. */
export const HERO_PHOTOS = {
  wedding: photo("hero-wedding", 17057198, [480, 840], "4:5"), // a couple on a camera's screen
  samarkand: photo("hero-samarkand", 5869122, [480, 960], "4:3"), // Registan in the evening
  cafe: photo("hero-cafe", 25409648, [400, 720], "4:5"), // coffee filmed on a phone
  filming: photo("hero-filming", 4914352, [480, 960], "4:3"), // a camera operator at work
} as const;

/** The invitation to creators at the foot of the page. */
export const JOIN_PHOTO = photo("join-camera", 3917682, [480, 960], "4:3"); // behind a cinema camera

export const photoSrc = (p: HomePhoto, width: number) => `/images/home/${p.name}-${width}.webp`;
export const photoSrcSet = (p: HomePhoto) => p.widths.map((w) => `${photoSrc(p, w)} ${w}w`).join(", ");
