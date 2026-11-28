import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/catalog";
import { CATEGORY_PHOTOS, HERO_PHOTOS, JOIN_PHOTO, photoSrc, photoSrcSet } from "@/lib/homeImages";
import { previewsOf } from "@/lib/thumbnail";

const PUBLIC = join(__dirname, "..", "..", "public");
const all = [...Object.values(CATEGORY_PHOTOS), ...Object.values(HERO_PHOTOS), JOIN_PHOTO];

describe("home page photographs", () => {
  it("has one for every direction, and no other", () => {
    expect(Object.keys(CATEGORY_PHOTOS).sort()).toEqual(CATALOG.map((c) => c.slug).sort());
  });

  it("never uses the same picture twice", () => {
    expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.source)).size).toBe(all.length);
  });

  it("has every file on disk, small enough for a phone connection", () => {
    for (const p of all) {
      for (const width of p.widths) {
        const bytes = statSync(join(PUBLIC, photoSrc(p, width))).size;
        expect(bytes, photoSrc(p, width)).toBeGreaterThan(1000);
        expect(bytes, photoSrc(p, width)).toBeLessThan(120_000);
      }
    }
  });

  it("offers the browser both widths", () => {
    expect(photoSrcSet(CATEGORY_PHOTOS.drone!)).toBe("/images/home/cat-drone-400.webp 400w, /images/home/cat-drone-800.webp 800w");
  });
});

describe("the preview of work on a creator's card", () => {
  const picture = (n: number) => ({ imageUrl: `https://a.test/${n}.jpg`, videoUrl: null });

  it("takes up to three pictures in the portfolio's order, skipping items with none", () => {
    const items = [picture(1), { imageUrl: null, videoUrl: "https://instagram.com/reel/x" }, picture(2), picture(3), picture(4)];
    expect(previewsOf(items).map((p) => p.image)).toEqual(["https://a.test/1.jpg", "https://a.test/2.jpg", "https://a.test/3.jpg"]);
  });

  it("uses a YouTube video's picture, marked as a video, and shows no picture twice", () => {
    const video = { imageUrl: null, videoUrl: "https://youtu.be/dQw4w9WgXcQ" };
    expect(previewsOf([video, video])).toEqual([{ image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", video: true }]);
  });

  it("is empty when there is nothing to show: no stand-in picture is made up", () => {
    expect(previewsOf([])).toEqual([]);
    expect(previewsOf([{ imageUrl: null, videoUrl: null }])).toEqual([]);
  });
});
