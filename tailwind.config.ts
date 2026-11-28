import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// The theme lives in one place: every colour is a CSS variable (an RGB triplet, defined in
// src/app/globals.css), so the whole look can change by editing those variables, and
// opacity modifiers such as `bg-ink/10` keep working. The variables have two sets of values, a dark one (the default)
// and a light one under `html[data-theme="light"]`; nothing here knows which is showing.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // `ink` is the foreground (light on the dark scheme, dark on the light one); `paper` is the page ground,
        // `surface` an elevated card, `paper-deep` a hover or recessed state.
        ink: { DEFAULT: c("ink"), soft: c("ink-soft"), mute: c("ink-mute") },
        paper: { DEFAULT: c("paper"), deep: c("paper-deep") },
        surface: c("surface"),
        // A warm off-white band (a shade above the ground in the dark scheme), behind the home page's top.
        warm: c("warm"),
        // These do not change with the scheme: `night` is the dark text that sits on the bright saffron and turquoise fills,
        // `on-accent` the white text on the cobalt and pomegranate fills, `media` the black behind a video, and `cover-ink` /
        // `cover-night` the strokes of the logo mark and the generated creator art.
        night: c("night"),
        "on-accent": c("on-accent"),
        media: c("media"),
        cover: { ink: c("cover-ink"), night: c("cover-night") },
        // The filled rating star.
        star: c("star"),
        // Hairlines, and the stronger edge where a control needs to be found. The colour and the strength are per scheme.
        line: { DEFAULT: "rgb(var(--c-line) / var(--c-line-a))", strong: "rgb(var(--c-line) / var(--c-line-strong-a))" },
        // For the accents, `-dark` and `-deep` are the readable shade on a tint (text and icons), not a hover shade.
        cobalt: { DEFAULT: c("cobalt"), dark: c("cobalt-dark"), tint: c("cobalt-tint") },
        saffron: { DEFAULT: c("saffron"), deep: c("saffron-deep"), tint: c("saffron-tint") },
        pomegranate: { DEFAULT: c("pomegranate"), deep: c("pomegranate-deep"), tint: c("pomegranate-tint") },
        turquoise: { DEFAULT: c("turquoise"), deep: c("turquoise-deep"), tint: c("turquoise-tint") },
        lilac: { DEFAULT: c("lilac"), tint: c("lilac-tint") },
      },
      borderColor: { DEFAULT: "rgb(var(--c-line) / var(--c-line-a))" },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // The home page headline only. Other headings get their size from the base styles in globals.css.
        display: ["clamp(2rem, 1.1rem + 3.6vw, 3.25rem)", { lineHeight: "1.1", letterSpacing: "-0.035em", fontWeight: "800" }],
      },
      // Radius follows hierarchy: controls (16px) < cards (20px) < hero blocks (24px). Pills and avatars use rounded-full.
      borderRadius: { ctl: "1rem", card: "1.25rem", hero: "1.5rem" },
      // Soft depth, only on things you can press or that lift on hover, and on floating layers. The values are per scheme
      // (a lighter shadow on the light ground), in globals.css.
      boxShadow: {
        "lift-sm": "var(--shadow-lift-sm)",
        lift: "var(--shadow-lift)",
        "lift-lg": "var(--shadow-lift-lg)",
      },
      transitionTimingFunction: { snap: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      keyframes: {
        "drift-up": { from: { transform: "translateY(0)" }, to: { transform: "translateY(-50%)" } },
        "drift-down": { from: { transform: "translateY(-50%)" }, to: { transform: "translateY(0)" } },
        shimmer: { "100%": { backgroundPosition: "-200% 0" } },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(.94)" },
          "60%": { opacity: "1", transform: "scale(1.025)" },
          "100%": { transform: "scale(1)" },
        },
        "star-pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.35) rotate(-8deg)" },
          "100%": { transform: "scale(1)" },
        },
        rise: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } },
        // The search field's examples taking turns (src/components/SearchBox.tsx): the old one leaves upward, the next rises.
        "swap-in": { from: { opacity: "0", transform: "translateY(0.75rem)" }, to: { opacity: "1", transform: "none" } },
        "swap-out": { from: { opacity: "1", transform: "none" }, to: { opacity: "0", transform: "translateY(-0.75rem)" } },
        // A dropdown panel (src/components/ui/Menu.tsx) settling under its button.
        "menu-in": { from: { opacity: "0", transform: "translateY(-4px) scale(.97)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "drift-up": "drift-up 52s linear infinite",
        "drift-down": "drift-down 60s linear infinite",
        shimmer: "shimmer 1.4s linear infinite",
        "pop-in": "pop-in .45s cubic-bezier(.2,.9,.3,1.2) both",
        "star-pop": "star-pop .35s ease-out",
        rise: "rise .6s cubic-bezier(.2,.7,.2,1) both",
        "swap-in": "swap-in .45s cubic-bezier(.2,.7,.2,1) both",
        "swap-out": "swap-out .35s cubic-bezier(.2,.7,.2,1) both",
        "menu-in": "menu-in .14s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
