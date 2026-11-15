import type { MetadataRoute } from "next";

// A manifest cannot read CSS variables, and one file serves every visitor, so it cannot follow a visitor's colour scheme
// either: an installed app starts on the dark paper colour (the dark --c-paper in globals.css, THEME_BROWSER_COLOR.dark).
const PAPER = "#090D16";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tarmoq.uz",
    short_name: "Tarmoq",
    description: "Oʻzbekistondagi videograf, fotograf va montajchilar tarmogʻi.",
    lang: "uz",
    start_url: "/",
    display: "standalone",
    background_color: PAPER,
    theme_color: PAPER,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
