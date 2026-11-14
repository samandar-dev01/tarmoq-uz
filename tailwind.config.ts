import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// The theme lives in one place: every colour is a CSS variable (an RGB triplet, defined in
// src/app/globals.css), so the whole look can change by editing those variables, and
// opacity modifiers such as `bg-ink/10` keep working.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // `ink` is the foreground (light, because the site is dark); `paper` is the page ground,
        // `surface` an elevated card, `paper-deep` a hover or recessed state, `night` the dark text that sits on bright fills.
        ink: { DEFAULT: c("ink"), soft: c("ink-soft"), mute: c("ink-mute") },
        paper: { DEFAULT: c("paper"), deep: c("paper-deep") },
        surface: c("surface"),
        night: c("night"),
        // Hairlines: white at 8%, and 16% where a control needs to be found.
        line: { DEFAULT: "rgb(var(--c-line) / 0.08)", strong: "rgb(var(--c-line) / 0.16)" },
        // For the accents, `-dark` and `-deep` are the readable shade on a dark tint (text and icons), not a hover shade.
        cobalt: { DEFAULT: c("cobalt"), dark: c("cobalt-dark"), tint: c("cobalt-tint") },
        saffron: { DEFAULT: c("saffron"), deep: c("saffron-deep"), tint: c("saffron-tint") },
        pomegranate: { DEFAULT: c("pomegranate"), deep: c("pomegranate-deep"), tint: c("pomegranate-tint") },
        turquoise: { DEFAULT: c("turquoise"), deep: c("turquoise-deep"), tint: c("turquoise-tint") },
        lilac: { DEFAULT: c("lilac"), tint: c("lilac-tint") },
      },
      borderColor: { DEFAULT: "rgb(var(--c-line) / 0.08)" },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        // The home page headline only. Other headings get their size from the base styles in globals.css.
        display: ["clamp(2.25rem, 1.2rem + 4.2vw, 3.5rem)", { lineHeight: "1.06", letterSpacing: "-0.035em", fontWeight: "800" }],
      },
      // Radius follows hierarchy: controls (16px) < cards (20px) < hero blocks (24px). Pills and avatars use rounded-full.
      borderRadius: { ctl: "1rem", card: "1.25rem", hero: "1.5rem" },
      // Soft depth, only on things you can press or that lift on hover, and on floating layers.
      boxShadow: {
        "lift-sm": "0 1px 2px 0 rgb(var(--c-shadow) / 0.4)",
        lift: "0 10px 28px -10px rgb(var(--c-shadow) / 0.6), 0 2px 6px -2px rgb(var(--c-shadow) / 0.4)",
        "lift-lg": "0 28px 64px -24px rgb(var(--c-shadow) / 0.75), 0 8px 20px -8px rgb(var(--c-shadow) / 0.45)",
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
      },
      animation: {
        "drift-up": "drift-up 52s linear infinite",
        "drift-down": "drift-down 60s linear infinite",
        shimmer: "shimmer 1.4s linear infinite",
        "pop-in": "pop-in .45s cubic-bezier(.2,.9,.3,1.2) both",
        "star-pop": "star-pop .35s ease-out",
        rise: "rise .6s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
