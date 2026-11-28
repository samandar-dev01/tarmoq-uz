import { describe, expect, it } from "vitest";
import { thumbnailOf, youtubeId } from "@/lib/thumbnail";
import { parseSaved, toggleSaved } from "@/lib/recentPure";

describe("package card pictures", () => {
  it("reads YouTube addresses in their forms and nothing else", () => {
    for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1", "https://m.youtube.com/shorts/dQw4w9WgXcQ"]) {
      expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
    }
    for (const bad of ["https://youtube.evil.com/watch?v=dQw4w9WgXcQ", "https://instagram.com/reel/abc", "not a url", "", null, "https://youtu.be/<x>"]) {
      expect(youtubeId(bad)).toBeNull();
    }
  });

  it("takes the first item with a picture and says whether it is a video", () => {
    expect(thumbnailOf([])).toEqual({ image: null, video: false });
    expect(thumbnailOf([{ imageUrl: null, videoUrl: "https://instagram.com/x" }])).toEqual({ image: null, video: true });
    expect(thumbnailOf([{ imageUrl: "https://a.test/1.jpg", videoUrl: null }])).toEqual({ image: "https://a.test/1.jpg", video: false });
    expect(thumbnailOf([{ imageUrl: null, videoUrl: "https://youtu.be/dQw4w9WgXcQ" }]).image).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("keeps saved packages in the browser, newest first", () => {
    expect(toggleSaved(["a"], "b")).toEqual(["b", "a"]);
    expect(toggleSaved(["b", "a"], "b")).toEqual(["a"]);
    expect(parseSaved("a.<x>.a.B.c2")).toEqual(["a", "c2"]);
  });
});
