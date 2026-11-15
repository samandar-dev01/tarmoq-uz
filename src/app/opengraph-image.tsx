import { ImageResponse } from "next/og";

// The card shown when a link to the site is shared. One static picture for every page.
export const alt = "Tarmoq.uz";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The image renderer cannot read CSS variables, so these mirror the theme in globals.css:
// --c-paper, --c-surface, --c-ink, --c-ink-soft, --c-cobalt, --c-cobalt-dark, --c-saffron.
const C = { paper: "#090D16", surface: "#111827", ink: "#F1F5F9", soft: "#CBD5E1", cobalt: "#2563EB", cobaltDark: "#93C5FD", saffron: "#F59E0B" };

// The built-in font has no "ʻ", so the text here uses only letters it can draw.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 80, backgroundColor: C.paper, color: C.ink,
          backgroundImage: `radial-gradient(circle at 8% 0%, rgba(245,158,11,0.18), transparent 45%), radial-gradient(circle at 95% 0%, rgba(37,99,235,0.35), transparent 50%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* The Tarmoq mark from icon.svg: three joined nodes. */}
          <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 32 32">
            <rect x="1" y="1" width="30" height="30" rx="9" fill={C.cobalt} />
            <path d="M9 11.5h14M16 11.5V23" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="9" cy="11.5" r="2.8" fill={C.saffron} />
            <circle cx="23" cy="11.5" r="2.8" fill={C.saffron} />
            <circle cx="16" cy="23" r="2.8" fill={C.saffron} />
          </svg>
          <div style={{ display: "flex", marginLeft: 28, fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>
            <span>tarmoq</span>
            <span style={{ color: C.cobaltDark }}>.uz</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>Ijodkorni shu yerdan toping</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: C.soft }}>Videograf, fotograf va montajchilar bir tarmoqda</div>
        </div>
      </div>
    ),
    size,
  );
}
