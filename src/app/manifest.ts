import type { MetadataRoute } from "next";

// A manifest cannot read CSS variables, so this mirrors --c-paper in globals.css (as THEME_COLOR in layout.tsx does).
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
